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
  subject?: string;
  content: string;
  jsonContent: JSONContent;
  type: 'email' | 'question' | 'system';
}

export async function generateAIEmailContent({
  prompt,
  currentContent,
  subject,
  to,
  conversationId,
  userContext,
}: {
  prompt: string;
  currentContent?: string;
  subject?: string;
  to?: string[];
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
      subject,
      conversationId,
      userContext,
    );

    const response = responses[0];
    if (!response) {
        console.error('AI Action Error: Received no response array item from generateEmailContent');
        throw new Error("Received no response from generateEmailContent");
    }

    const responseBody = response.body;
    const responseSubject = response.subject;

    const paragraphs = responseBody.split('\n');
    const jsonContent = createJsonContent(paragraphs);

    return {
      subject: responseSubject,
      content: responseBody,
      jsonContent,
      type: response.type,
    };
  } catch (error) {
    console.error('Error in generateAIEmailContent action:', error);
    const errorMsg = 'Sorry, I encountered an error while generating content. Please try again.';
    return {
      content: errorMsg,
      jsonContent: createJsonContent([errorMsg]),
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
