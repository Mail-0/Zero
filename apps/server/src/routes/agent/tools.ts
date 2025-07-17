import { composeEmail } from '../../trpc/routes/ai/compose';
import { perplexity } from '@ai-sdk/perplexity';
import { generateText, tool } from 'ai';

import { colors, GmailSearchAssistantSystemPrompt } from '../../lib/prompts';
import { anthropic } from '@ai-sdk/anthropic';
import { env } from 'cloudflare:workers';
import type { ZeroAgent } from '../chat';
import { Tools } from '../../types';
import { z } from 'zod';

type ModelTypes = 'summarize' | 'general' | 'chat' | 'vectorize';

const models: Record<ModelTypes, any> = {
  summarize: '@cf/facebook/bart-large-cnn',
  general: 'llama-3.3-70b-instruct-fp8-fast',
  chat: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  vectorize: '@cf/baai/bge-large-en-v1.5',
};

export const getEmbeddingVector = async (
  text: string,
  gatewayId: 'vectorize-save' | 'vectorize-load',
) => {
  try {
    const embeddingResponse = await env.AI.run(
      models.vectorize,
      { text },
      {
        gateway: {
          id: gatewayId,
        },
      },
    );
    const embeddingVector = embeddingResponse.data[0];
    return embeddingVector ?? null;
  } catch (error) {
    console.log('[getEmbeddingVector] failed', error);
    return null;
  }
};

// const askZeroMailbox = (connectionId: string) =>
//   tool({
//     description: 'Ask Zero a question about the mailbox',
//     parameters: z.object({
//       question: z.string().describe('The question to ask Zero'),
//       topK: z.number().describe('The number of results to return').max(9).min(1).default(3),
//     }),
//     execute: async ({ question, topK = 3 }) => {
//       const embedding = await getEmbeddingVector(question, 'vectorize-load');
//       if (!embedding) {
//         return { error: 'Failed to get embedding' };
//       }
//       const threadResults = await env.VECTORIZE.query(embedding, {
//         topK,
//         returnMetadata: 'all',
//         filter: {
//           connection: connectionId,
//         },
//       });

//       if (!threadResults.matches.length) {
//         return {
//           response: [],
//           success: false,
//         };
//       }
//       return {
//         response: threadResults.matches.map((e) => e.metadata?.['summary'] ?? 'no content'),
//         success: true,
//       };
//     },
//   });

// const askZeroThread = (connectionId: string) =>
//   tool({
//     description: 'Ask Zero a question about a specific thread',
//     parameters: z.object({
//       threadId: z.string().describe('The ID of the thread to ask Zero about'),
//       question: z.string().describe('The question to ask Zero'),
//     }),
//     execute: async ({ threadId, question }) => {
//       const response = await env.VECTORIZE.getByIds([threadId]);
//       if (!response.length) return { response: "I don't know, no threads found", success: false };
//       const embedding = await getEmbeddingVector(question, 'vectorize-load');
//       if (!embedding) {
//         return { error: 'Failed to get embedding' };
//       }
//       const threadResults = await env.VECTORIZE.query(embedding, {
//         topK: 1,
//         returnMetadata: 'all',
//         filter: {
//           thread: threadId,
//           connection: connectionId,
//         },
//       });
//       const topThread = threadResults.matches[0];
//       if (!topThread) return { response: "I don't know, no threads found", success: false };
//       return {
//         response: topThread.metadata?.['summary'] ?? 'no content',
//         success: true,
//       };
//     },
//   });

/**
 * ⚠️  IMPORTANT
 * Do NOT return the full thread here – it bloats the conversation state and
 * may hit the 128 MB cap in Cloudflare Workers. We only hand back a lightweight
 * tag that the front-end can interpret.
 *
 * The tag format must be exactly: <thread id="{id}"/>
 */
const getEmail = (_: ZeroAgent) =>
  tool({
    description: 'Return a placeholder tag for a specific email thread by ID',
    parameters: z.object({
      id: z.string().describe('The ID of the email thread to retrieve'),
    }),
    execute: async ({ id }) => {
      /* nothing to fetch server-side any more */
      return `<thread id="${id}"/>`;
    },
  });

const composeEmailTool = (connectionId: string) =>
  tool({
    description: 'Compose an email using AI assistance',
    parameters: z.object({
      prompt: z.string().describe('The prompt or rough draft for the email'),
      emailSubject: z.string().optional().describe('The subject of the email'),
      to: z.array(z.string()).optional().describe('Recipients of the email'),
      cc: z.array(z.string()).optional().describe('CC recipients of the email'),
      threadMessages: z
        .array(
          z.object({
            from: z.string().describe('The sender of the email'),
            to: z.array(z.string()).describe('The recipients of the email'),
            cc: z.array(z.string()).optional().describe('The CC recipients of the email'),
            subject: z.string().describe('The subject of the email'),
            body: z.string().describe('The body of the email'),
          }),
        )
        .optional()
        .describe('Previous messages in the thread for context'),
    }),
    execute: async (data) => {
      const newBody = await composeEmail({
        ...data,
        username: 'AI Assistant',
        connectionId,
      });
      return { newBody };
    },
  });

// const listEmails = (agent: ZeroAgent) =>
//   tool({
//     description: 'List emails in a specific folder',
//     parameters: z.object({
//       folder: z.string().describe('The folder to list emails from').default('inbox'),
//       maxResults: z
//         .number()
//         .optional()
//         .describe('The maximum number of results to return')
//         .default(5),
//       labelIds: z.array(z.string()).optional().describe('The labels to filter emails'),
//       pageToken: z.string().optional().describe('The page token to continue listing emails'),
//     }),
//     execute: async (params) => {
//       return await agent.list(params);
//     },
//   });

const markAsRead = (agent: ZeroAgent) =>
  tool({
    description: 'Mark emails as read',
    parameters: z.object({
      threadIds: z.array(z.string()).describe('The IDs of the threads to mark as read'),
    }),
    execute: async ({ threadIds }) => {
      await agent.markAsRead(threadIds);
      return { threadIds, success: true };
    },
  });

// const inboxRag = (agent: ZeroAgent, dataStream?: DataStreamWriter) =>
//   tool({
//     description: 'Search the inbox for emails',
//     parameters: z.object({
//       query: z.string().describe('The query to search the inbox for'),
//     }),
//     execute: async ({ query }) => {
//       console.log('inboxRag', query);
//       return await agent.inboxRag(query, dataStream);
//     },
//   });

const markAsUnread = (agent: ZeroAgent) =>
  tool({
    description: 'Mark emails as unread',
    parameters: z.object({
      threadIds: z.array(z.string()).describe('The IDs of the threads to mark as unread'),
    }),
    execute: async ({ threadIds }) => {
      await agent.markAsUnread(threadIds);
      return { threadIds, success: true };
    },
  });

const modifyLabels = (agent: ZeroAgent) =>
  tool({
    description: 'Modify labels on emails',
    parameters: z.object({
      threadIds: z.array(z.string()).describe('The IDs of the threads to modify'),
      options: z.object({
        addLabels: z.array(z.string()).default([]).describe('The labels to add'),
        removeLabels: z.array(z.string()).default([]).describe('The labels to remove'),
      }),
    }),
    execute: async ({ threadIds, options }) => {
      await agent.modifyLabels(threadIds, options.addLabels, options.removeLabels);
      return { threadIds, options, success: true };
    },
  });

const getUserLabels = (agent: ZeroAgent) =>
  tool({
    description: 'Get all user labels',
    parameters: z.object({}),
    execute: async () => {
      return await agent.getUserLabels();
    },
  });

const sendEmail = (agent: ZeroAgent) =>
  tool({
    description: 'Send a new email',
    parameters: z.object({
      to: z.array(
        z.object({
          email: z.string().describe('The email address of the recipient'),
          name: z.string().optional().describe('The name of the recipient'),
        }),
      ),
      subject: z.string().describe('The subject of the email'),
      message: z.string().describe('The body of the email'),
      cc: z
        .array(
          z.object({
            email: z.string().describe('The email address of the recipient'),
            name: z.string().optional().describe('The name of the recipient'),
          }),
        )
        .optional(),
      bcc: z
        .array(
          z.object({
            email: z.string().describe('The email address of the recipient'),
            name: z.string().optional().describe('The name of the recipient'),
          }),
        )
        .optional(),
      threadId: z.string().optional().describe('The ID of the thread to send the email from'),
      // fromEmail: z.string().optional(),
      draftId: z.string().optional().describe('The ID of the draft to send'),
    }),
    execute: async (data) => {
      try {
        const { draftId, ...mail } = data;

        if (draftId) {
          await agent.sendDraft(draftId, {
            ...mail,
            attachments: [],
            headers: {},
          });
        } else {
          await agent.create({
            ...mail,
            attachments: [],
            headers: {},
          });
        }

        return { success: true };
      } catch (error) {
        console.error('Error sending email:', error);
        throw new Error(
          'Failed to send email: ' + (error instanceof Error ? error.message : String(error)),
        );
      }
    },
  });

const createLabel = (agent: ZeroAgent) =>
  tool({
    description: 'Create a new label with custom colors, if it does nto exist already',
    parameters: z.object({
      name: z.string().describe('The name of the label to create'),
      backgroundColor: z
        .string()
        .describe('The background color of the label in hex format')
        .refine((color) => colors.includes(color), {
          message: 'Background color must be one of the predefined colors',
        }),
      textColor: z
        .string()
        .describe('The text color of the label in hex format')
        .refine((color) => colors.includes(color), {
          message: 'Text color must be one of the predefined colors',
        }),
    }),
    execute: async ({ name, backgroundColor, textColor }) => {
      await agent.createLabel({ name, color: { backgroundColor, textColor } });
      return { name, backgroundColor, textColor, success: true };
    },
  });

const bulkDelete = (agent: ZeroAgent) =>
  tool({
    description: 'Move multiple emails to trash by adding the TRASH label',
    parameters: z.object({
      threadIds: z.array(z.string()).describe('Array of email IDs to move to trash'),
    }),
    execute: async ({ threadIds }) => {
      await agent.modifyLabels(threadIds, ['TRASH'], []);
      return { threadIds, success: true };
    },
  });

const bulkArchive = (agent: ZeroAgent) =>
  tool({
    description: 'Move multiple emails to the archive by removing the INBOX label',
    parameters: z.object({
      threadIds: z.array(z.string()).describe('Array of email IDs to move to archive'),
    }),
    execute: async ({ threadIds }) => {
      await agent.modifyLabels(threadIds, [], ['INBOX']);
      return { threadIds, success: true };
    },
  });

const deleteLabel = (agent: ZeroAgent) =>
  tool({
    description: "Delete a label from the user's account",
    parameters: z.object({
      id: z.string().describe('The ID of the label to delete'),
    }),
    execute: async ({ id }) => {
      await agent.deleteLabel(id);
      return { id, success: true };
    },
  });

export const webSearch = () =>
  tool({
    description: 'Search the web for information using Perplexity AI',
    parameters: z.object({
      query: z.string().describe('The query to search the web for'),
    }),
    execute: async ({ query }) => {
      try {
        const response = await generateText({
          model: perplexity('sonar'),
          messages: [
            { role: 'system', content: 'Be precise and concise.' },
            { role: 'system', content: 'Do not include sources in your response.' },
            { role: 'system', content: 'Do not use markdown formatting in your response.' },
            { role: 'user', content: query },
          ],
          maxTokens: 1024,
        });

        return response.text;
      } catch (error) {
        console.error('Error searching the web:', error);
        throw new Error('Failed to search the web');
      }
    },
  });

const buildGmailSearchQuery = () =>
  tool({
    description: 'Build Gmail search query using AI assistance',
    parameters: z.object({
      query: z.string(),
    }),
    execute: async ({ query }) => {
      const result = await generateText({
        model: anthropic(env.OPENAI_MODEL || 'claude-3-5-haiku-latest'),
        system: GmailSearchAssistantSystemPrompt(),
        prompt: query,
      });
      return result.text;
    },
  });

export const tools = async (agent: ZeroAgent, connectionId: string) => {
  return {
    [Tools.GetThread]: getEmail(agent),
    [Tools.ComposeEmail]: composeEmailTool(connectionId),
    [Tools.MarkThreadsRead]: markAsRead(agent),
    [Tools.MarkThreadsUnread]: markAsUnread(agent),
    [Tools.ModifyLabels]: modifyLabels(agent),
    [Tools.GetUserLabels]: getUserLabels(agent),
    [Tools.SendEmail]: sendEmail(agent),
    [Tools.CreateLabel]: createLabel(agent),
    [Tools.BulkDelete]: bulkDelete(agent),
    [Tools.BulkArchive]: bulkArchive(agent),
    [Tools.DeleteLabel]: deleteLabel(agent),
    [Tools.WebSearch]: tool({
      description: 'Search the web for information using Perplexity AI',
      parameters: z.object({
        query: z.string().describe('The query to search the web for'),
      }),
    }),
    [Tools.BuildGmailSearchQuery]: buildGmailSearchQuery(),
    [Tools.InboxRag]: tool({
      description:
        'Search the inbox for emails using natural language. Returns only an array of threadIds.',
      parameters: z.object({
        query: z.string().describe('The query to search the inbox for'),
      }),
    }),
  };
};
