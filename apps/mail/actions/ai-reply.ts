'use server';

import { throwUnauthorizedGracefully } from '@/app/api/utils';
import { generateCompletions } from '@/lib/groq';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { EmailReplySystemPrompt } from '@/lib/prompts';

// Generates an AI response for an email reply based on the thread content
export async function generateAIResponse(
  threadContent: string,
  originalSender: string,
): Promise<string> {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user) {
    return throwUnauthorizedGracefully();
  }

  if (!process.env.GROQ_API_KEY) {
    throw new Error('Groq API key is not configured');
  }

  // Use a more aggressive content reduction approach
  const processedContent = threadContent;

  // Get the base system prompt, passing the user name
  const baseReplySystemPrompt = EmailReplySystemPrompt(session.user.name);

  // Create the user message including the thread context
  const userPrompt = `
<email_thread_context>
${processedContent}
</email_thread_context>

<instruction>Write a professional, helpful, and concise email reply to ${originalSender}. Keep your response under 200 words and strictly follow all formatting and constraint rules defined in the system prompt.</instruction>
`;
  // Create the system message
  const systemPrompt = `You are an email assistant helping ${session.user.name} write professional and concise email replies.
  
  CRITICAL INSTRUCTIONS:
  - Return ONLY the email content itself
  - DO NOT include ANY explanatory text or meta-text like "Here's a draft" or "Here's a reply"
  - DO NOT include ANY text before or after the email content
  - Start directly with the greeting (e.g. "Hi John,")
  - End with just the name
  - Generate a real, ready-to-send email reply, not a template
  - Do not include placeholders like [Recipient], [discount percentage], etc.
  - Do not include formatting instructions or explanations
  - Do not include "Subject:" lines
  - Write as if this email is ready to be sent immediately
  - Use real, specific content instead of placeholders
  - Address the recipient directly without using [brackets]
  - Be concise but thorough (2-3 paragraphs maximum)
  - Write in the first person as if you are ${session.user.name}
  - Double space paragraphs (2 newlines)
  - Add two spaces below the sign-off
  - End with the name: ${session.user.name}`;

  // Create the user message - keep it shorter
  const prompt = `
  Here's the context of the email thread (some parts may be summarized or truncated due to length):
  ${processedContent}

  Write a professional, helpful, and concise email reply to ${originalSender}.
  Keep your response under 200 words.
  
  CRITICAL: Return ONLY the email content itself. DO NOT include ANY explanatory text or meta-text.
  Start directly with the greeting and end with just the name.

  Important instructions:
  - Return ONLY the email content itself
  - DO NOT include ANY explanatory text or meta-text
  - Start directly with the greeting (e.g. "Hi John,")
  - End with just the name
  - Generate a real, ready-to-send email reply, not a template
  - Do not include placeholders like [Recipient], [discount percentage], etc.
  - Do not include formatting instructions or explanations
  - Do not include "Subject:" lines
  - Write as if this email is ready to be sent immediately
  - Use real, specific content instead of placeholders
  - Address the recipient directly without using [brackets]
  - Be concise but thorough (2-3 paragraphs maximum)
  - Write in the first person as if you are ${session.user.name}
  - Double space paragraphs (2 newlines)
  - Add two spaces below the sign-off
  - End with the name: ${session.user.name}`;

  try {
    console.log('Generating AI response using structured prompt.');
    // Use direct fetch to the Groq API
    const { completion } = await generateCompletions({
      model: 'gpt-4o-mini',
      systemPrompt: baseReplySystemPrompt,
      prompt: userPrompt,
      temperature: 0.6,
      userName: session.user.name,
    });

    return completion;
  } catch (error: any) {
    console.error('Error generating AI response:', error);
    throw error;
  }
}
