import { type CoreMessage, generateText, tool } from 'ai';
import { activeDriverProcedure } from '../../trpc';
import { type gmail_v1 } from 'googleapis';
import { TRPCError } from '@trpc/server';
import { openai } from '@ai-sdk/openai';
import dedent from 'dedent';
import { z } from 'zod';

// Define our email search tool
const emailSearchTool = tool({
  description: 'Search through emails using Gmail-compatible search syntax',
  parameters: z.object({
    query: z.string().describe('The Gmail search query to use'),
    explanation: z.string().describe('A brief explanation of what this search will find'),
  }),
  execute: async ({ query, explanation }) => {
    return {
      query,
      explanation,
      status: 'success',
    };
  },
});

export const generateSearchQuery = activeDriverProcedure
  // TODO: find the messages type
  .input(z.object({ messages: z.array(z.unknown()) }))
  .mutation(async ({ input, ctx }) => {
    const { driver } = ctx;
    const { messages } = input as { messages: CoreMessage[] };

    try {
      // Create a system message to guide the AI
      const systemMessage = {
        role: 'system',
        content: dedent`
        You are an email search assistant. Your task is to:
        1. Understand the user's search intent
        2. Convert their request into a Gmail-compatible search query
        3. Focus on finding emails related to the search terms
        4. Consider both subject and content when searching
        5. Return the search query in a format that can be used directly with Gmail's search syntax
        6. Provide a clear explanation of what the search will find

        For example:
        - "find emails about billing" -> query: "subject:(bill OR invoice OR receipt OR payment OR charge) OR (bill OR invoice OR receipt OR payment OR charge)"
        - "find emails from john" -> query: "from:john"
        - "find emails from example.com" -> query: "(from:*@example.com) OR (example.com)"
        - "show me messages about meetings" -> query: "subject:meeting OR meeting"
        - "find emails with attachments" -> query: "has:attachment"

        Context Handling:
        - When the user asks about a completely new topic (e.g. "show me emails from adam" after "find vercel emails"), treat it as a new search
        - Only use previous search context when the user explicitly refers to the previous results or asks for more/similar results
        - For follow-ups about the same topic (e.g. "show me more recent ones" or "any older ones?"), modify the previous search query
        - For refinements (e.g. "only from last week" or "with attachments"), add to the previous query

        Examples of context switching:
        - Previous: "find vercel emails", New: "what about emails from adam" -> Create new search: "from:adam"
        - Previous: "find vercel emails", New: "show me more recent ones" -> Modify previous search: "from:vercel newer_than:7d"
        - Previous: "find vercel emails", New: "any with attachments?" -> Add to previous: "from:vercel has:attachment"

        When searching for emails from a domain:
        - Include both emails from that domain (from:*@domain.com)
        - AND emails containing that domain name in the content
        - This ensures we find both emails sent from that domain and emails mentioning it

        Always try to expand search terms to include related keywords to ensure comprehensive results.
        For sender searches, use the exact name/email provided by the user.
        For domain searches, search both the from: field and general content.
        For subject/content searches, include relevant synonyms and related terms.

        Important: This is a search-only assistant. Do not generate email content or handle email composition requests.
        `,
      } as const;

      const { text, steps } = await generateText({
        model: openai('gpt-4o'),
        messages: [systemMessage, ...messages],
        tools: {
          emailSearch: emailSearchTool,
        },
        maxSteps: 2,
        temperature: 0.7,
      });

      // Extract the search query and explanation from the tool call
      const toolCall = steps
        .flatMap((step) => step.toolCalls)
        .find((call) => call.toolName === 'emailSearch');

      if (!toolCall?.args?.query) {
        throw new Error('Failed to generate search query');
      }

      const searchQuery = toolCall.args.query;
      const searchExplanation = toolCall.args.explanation || 'matching your search criteria';

      // Get the email driver and fetch results
      const results = await driver.list({ folder: '', query: searchQuery, maxResults: 20 });

      // Process the results - use the raw response from Gmail API
      const processResultPromises =
        results?.threads?.map(async (thread) => {
          const rawThread = thread.$raw as gmail_v1.Schema$Thread;
          try {
            // Get the thread data using our existing driver
            const threadData = await driver.get(thread.id);
            const firstMessage = threadData.messages[0];

            if (!firstMessage) {
              throw new Error('No messages found in thread');
            }

            return {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              id: rawThread.id!,
              snippet: rawThread.snippet || '',
              historyId: rawThread.historyId,
              subject: firstMessage.subject || 'No subject',
              from: firstMessage.sender.email || firstMessage.sender.name || 'Unknown sender',
            };
          } catch (error) {
            console.error('Error processing thread:', error);
            return {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              id: rawThread.id!,
              snippet: rawThread.snippet || '',
              historyId: rawThread.historyId,
              subject: 'Error loading subject',
              from: 'Error loading sender',
            };
          }
        }) || [];

      // Resolve all promises
      const resolvedResults = await Promise.all(processResultPromises);

      // Create a natural response using the AI's text and search results
      const hasResults = resolvedResults.length > 0;

      // Let the AI's response text lead the way
      let summary = text;

      // Add result information
      if (hasResults) {
        summary += `\n\nI found ${resolvedResults.length} email${resolvedResults.length === 1 ? '' : 's'} ${searchExplanation}. Here ${resolvedResults.length === 1 ? 'it is' : 'they are'}:`;
      } else {
        summary += `\n\nI couldn't find any emails ${searchExplanation}. Would you like to try a different search?`;
      }

      return {
        content: summary,
        searchQuery,
        searchDisplay: `Searched for "${searchQuery}"`,
        results: resolvedResults,
      };
    } catch (error) {
      console.error('AI Search error:', error);
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Failed to generate search query' });
    }
  });
