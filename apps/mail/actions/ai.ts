// The brain.ts file in /actions should replace this file once ready.
'use server';

import { generateEmailContent } from '@/lib/ai';
import { headers } from 'next/headers';
import { JSONContent } from 'novel';
import { auth } from '@/lib/auth';

interface UserContext {
  name?: string;
  email?: string;
}

interface AIEmailResponse {
  content: string;
  jsonContent: JSONContent;
  type: 'email' | 'question' | 'system';
}

export async function generateAIEmailContent({
  prompt,
  currentContent,
  to,
  isEdit = false,
  conversationId,
  userContext,
}: {
  prompt: string;
  currentContent?: string;
  to?: string[];
  isEdit?: boolean;
  conversationId?: string;
  userContext?: UserContext;
}): Promise<AIEmailResponse> {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      throw new Error('Unauthorized');
    }
    
    const responses = await generateEmailContent(
      prompt,
      currentContent,
      to,
      conversationId,
      userContext,
    );

    // Check if the response is our specific 'invalid request' system message
    if (responses.length === 1 && responses[0] && responses[0].type === 'system') {
      // Pass the system message directly back to the frontend
      return {
        content: responses[0].content,
        jsonContent: createJsonContent([responses[0].content]),
        type: 'system',
      };
    }

    const questionResponse = responses.find((r) => r.type === 'question');
    if (questionResponse) {
      return {
        content: questionResponse.content,
        jsonContent: createJsonContent([questionResponse.content]),
        type: 'question',
      };
    }

    const emailResponses = responses.filter((r) => r.type === 'email');
    
    const cleanedContent = emailResponses
      .map((r) => r.content)
      .join('\n\n')
      .trim();

    const paragraphs = cleanedContent.split('\n');

    const jsonContent = createJsonContent(paragraphs);

    // If the AI response looks like a question back to the user, treat it as a system message
    const isClarification = 
      cleanedContent.trim().endsWith('?') ||
      [/^what/i, /^how/i, /^why/i, /^when/i, /^where/i, /^who/i, /^can you/i, /^could you/i, /^would you/i].some(pattern => pattern.test(cleanedContent.trim())) ||
      cleanedContent.toLowerCase().includes('please provide more context') ||
      cleanedContent.toLowerCase().includes('need more information');

    if (isClarification) {
        console.log('AI Assistant: Detected clarification request from AI. Treating as system message.');
        return {
            content: cleanedContent,
            jsonContent,
            type: 'system', // Reclassify as system
        };
    }

    return {
      content: cleanedContent,
      jsonContent,
      type: 'email',
    };
  } catch (error) {
    console.error('Error generating AI email content:', error);

    return {
      content:
        'Sorry, I encountered an error while generating content. Please try again with a different prompt.',
      jsonContent: createJsonContent([
        'Sorry, I encountered an error while generating content. Please try again with a different prompt.',
      ]),
      type: 'system',
    };
  }
}

function createJsonContent(paragraphs: string[]): JSONContent {
  if (paragraphs.length === 0) {
    paragraphs = ['Failed to generate content. Please try again with a different prompt.'];
  }

  return {
    type: 'doc',
    content: paragraphs.map((paragraph) => ({
      type: 'paragraph',
      content: paragraph.length ? [{ type: 'text', text: paragraph }] : [],
    })),
  };
}
