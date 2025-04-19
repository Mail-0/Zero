// The brain.ts file in /actions should replace this file once ready.
'use server';

import { generateEmailBody, generateSubjectForEmail } from '@/lib/ai';
import { headers } from 'next/headers';
import { JSONContent } from 'novel';
import { auth } from '@/lib/auth';

interface UserContext {
  name?: string;
  email?: string;
}

interface AIBodyResponse {
  content: string;
  jsonContent: JSONContent;
  type: 'email' | 'question' | 'system';
}

export async function generateAIEmailBody({
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
}): Promise<AIBodyResponse> {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      console.error('AI Action Error (Body): Unauthorized');
      const errorMsg = 'Unauthorized access. Please log in.';
       return {
          content: errorMsg,
          jsonContent: createJsonContentFromBody(errorMsg),
          type: 'system',
       };
    }
    
    const responses = await generateEmailBody(
      prompt,
      currentContent,
      to,
      subject,
      conversationId,
      userContext,
    );

    const response = responses[0];
    if (!response) {
        console.error('AI Action Error (Body): Received no response array item from generateEmailBody');
        const errorMsg = 'AI failed to generate a response.';
        return {
           content: errorMsg,
           jsonContent: createJsonContentFromBody(errorMsg),
           type: 'system',
        };
    }

    console.log("--- Action Layer (Body): Received from generateEmailBody ---");
    console.log("Raw response object:", JSON.stringify(response, null, 2));
    console.log("Extracted Body:", response.body);
    console.log("--- End Action Layer (Body) Log ---");

    const responseBody = response.body;
    
    const jsonContent = createJsonContentFromBody(responseBody);

    return {
      content: responseBody,
      jsonContent,
      type: response.type,
    };
    
  } catch (error) {
    console.error('Error in generateAIEmailBody action:', error);
    const errorMsg = 'Sorry, I encountered an unexpected error while generating the email body.';
    return {
      content: errorMsg,
      jsonContent: createJsonContentFromBody(errorMsg),
      type: 'system',
    };
  }
}

export async function generateAISubject({
    body,
}: {
    body: string;
}): Promise<string> {
    try {
        const headersList = await headers();
        const session = await auth.api.getSession({ headers: headersList });

        if (!session?.user) {
            console.error('AI Action Error (Subject): Unauthorized');
            return '';
        }

        if (!body || body.trim() === '') {
            console.warn('AI Action Warning (Subject): Cannot generate subject for empty body.');
            return '';
        }

        const subject = await generateSubjectForEmail(body);

        console.log("--- Action Layer (Subject): Received from generateSubjectForEmail ---");
        console.log("Generated Subject:", subject);
        console.log("--- End Action Layer (Subject) Log ---");

        return subject;

    } catch (error) {
        console.error('Error in generateAISubject action:', error);
        return '';
    }
}

function createJsonContentFromBody(bodyText: string): JSONContent {
    if (!bodyText || bodyText.trim() === '') {
        bodyText = 'AI failed to generate content. Please try again.';
    }

    return {
        type: 'doc',
        content: [
            {
                type: 'paragraph',
                content: [{ type: 'text', text: bodyText.trim() }], 
            }
        ],
    };
}
