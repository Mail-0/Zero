'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { generateCompletions } from '@/lib/groq';
import { EmailReplySystemPrompt } from '@/lib/prompts';

// Generates an AI response for an email reply based on the thread content
export async function generateAIResponse(
  threadContent: string,
  originalSender: string,
): Promise<string> {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  if (!process.env.GROQ_API_KEY) {
    throw new Error('Groq API key is not configured');
  }

  // Use a more aggressive content reduction approach
  const processedContent = threadContent

  // Get the base system prompt, passing the user name
  const baseReplySystemPrompt = EmailReplySystemPrompt(session.user.name);

  // Create the user message including the thread context
  const userPrompt = `
<email_thread_context>
${processedContent}
</email_thread_context>

<instruction>Write a professional, helpful, and concise email reply to ${originalSender}. Keep your response under 200 words and strictly follow all formatting and constraint rules defined in the system prompt.</instruction>
`;

  try {
    console.log('Generating AI response using structured prompt.');
    // Use direct fetch to the Groq API
    const { completion } = await generateCompletions({
      model: 'gpt-4o-mini',
      systemPrompt: baseReplySystemPrompt,
      prompt: userPrompt,
      temperature: 0.6,
      userName: session.user.name
    });

    return completion;
  } catch (error: any) {
    console.error('Error generating AI response:', error);
    throw error;
  }
}
