'use server';
import { createEmbeddings, generateCompletions } from './groq';
import { generateConversationId } from './utils';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

interface AIResponse {
  id: string;
  content: string;
  type: 'email' | 'question' | 'system';
  position?: 'start' | 'end' | 'replace';
}

// Define user context type
interface UserContext {
  name?: string;
  email?: string;
}

const conversationHistories: Record<
  string,
  { role: 'user' | 'assistant' | 'system'; content: string }[]
> = {};

export async function generateEmailContent(
  prompt: string,
  currentContent?: string,
  recipients?: string[],
  conversationId?: string,
  userContext?: UserContext,
): Promise<AIResponse[]> {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('Groq API key is not configured');
    }

    // Get or initialize conversation
    const convId = conversationId || generateConversationId();
    if (!conversationHistories[convId]) {
      conversationHistories[convId] = [
        { role: 'system', content: process.env.AI_SYSTEM_PROMPT || 'You are an email assistant.' },
      ];

      // Add user context if available
      if (userContext?.name) {
        conversationHistories[convId].push({
          role: 'system',
          content: `User name: ${userContext.name}. Always sign emails with ${userContext.name}.`,
        });
      }
    }

    // Add user message to history
    conversationHistories[convId].push({ role: 'user', content: prompt });

    // Check if this is a question about the email
    const isQuestion = checkIfQuestion(prompt);

    // Build system prompt from conversation history and context
    let systemPrompt = '';
    const systemMessages = conversationHistories[convId].filter((msg) => msg.role === 'system');
    if (systemMessages.length > 0) {
      systemPrompt = systemMessages.map((msg) => msg.content).join('\n\n');
    }

    // Add context about current email if it exists
    if (currentContent) {
      systemPrompt += `\n\nThe user's current email draft is:\n\n${currentContent}`;
    }

    // Add context about recipients
    if (recipients && recipients.length > 0) {
      systemPrompt += `\n\nThe email is addressed to: ${recipients.join(', ')}`;
    }

    // Build user prompt from conversation history
    const userMessages = conversationHistories[convId]
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    // Create embeddings for relevant context
    const embeddingTexts: Record<string, string> = {};

    if (currentContent) {
      embeddingTexts.currentEmail = currentContent;
    }

    if (prompt) {
      embeddingTexts.userPrompt = prompt;
    }

    // Add previous messages for context
    const previousMessages = conversationHistories[convId]
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .slice(-4); // Get last 4 messages

    if (previousMessages.length > 0) {
      embeddingTexts.conversationHistory = previousMessages
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join('\n\n');
    }

    // Generate embeddings
    let embeddings = {};
    try {
      embeddings = await createEmbeddings(embeddingTexts);
    } catch (embeddingError) {
      console.error(embeddingError);
    }

    // Make API call using the ai function
    const { completion } = await generateCompletions({
      model: 'gpt-4o-mini', // Using Groq's model
      systemPrompt,
      prompt: userMessages + '\n\nUser: ' + prompt,
      temperature: 0.7,
      embeddings, // Pass the embeddings to the API call
      userName: session?.user.name || 'User',
    });

    const generatedContent = completion;

    // Add assistant response to conversation history
    conversationHistories[convId].push({ role: 'assistant', content: generatedContent });

    // Format and return the response
    if (isQuestion) {
      return [
        {
          id: 'question-' + Date.now(),
          content: generatedContent,
          type: 'question',
          position: 'replace',
        },
      ];
    } else {
      return [
        {
          id: 'email-' + Date.now(),
          content: generatedContent,
          type: 'email',
          position: 'replace',
        },
      ];
    }
  } catch (error) {
    console.error('Error generating email content:', error);
    throw error;
  }
}

function checkIfQuestion(prompt: string): boolean {
  const trimmedPrompt = prompt.trim().toLowerCase();

  // Check if the prompt ends with a question mark
  if (trimmedPrompt.endsWith('?')) return true;

  // Check if the prompt starts with question words
  const questionStarters = [
    'what',
    'how',
    'why',
    'when',
    'where',
    'who',
    'can you',
    'could you',
    'would you',
    'will you',
    'is it',
    'are there',
    'should i',
    'do you',
  ];

  return questionStarters.some((starter) => trimmedPrompt.startsWith(starter));
}
