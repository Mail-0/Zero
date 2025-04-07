'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { generateCompletions, truncateThreadContent } from '@/lib/groq';
import { extractTextFromHTML } from './extractText';

// Hard cap the context to prevent token limit errors
async function extractEmailSummary(threadContent: string, maxTokens: number = 2000): Promise<string> {
  // First, strip HTML from the thread content
  threadContent = await extractTextFromHTML(threadContent);
  
  // Hard character limit (roughly 3 chars per token to be safe)
  const MAX_CHARS = 4000;
  
  // If content is already small enough, return as is
  if (threadContent.length <= MAX_CHARS) {
    return threadContent;
  }
  
  // Split into emails and get the latest one
  const emails = threadContent.split('\n---\n');
  const latestEmail = emails[emails.length - 1] || '';
  
  // If the latest email is within limits, return just that
  if (latestEmail.length <= MAX_CHARS) {
    return "Most recent email:\n" + latestEmail;
  }
  
  // Otherwise, take the last MAX_CHARS characters of the latest email
  return "Most recent email (truncated):\n" + latestEmail.slice(-MAX_CHARS);
}

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
  const processedContent = await extractEmailSummary(threadContent, 2000); // Reduced to 2000 tokens maximum

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
    // Use direct fetch to the Groq API
    const { completion } = await generateCompletions({
      model: 'llama3-8b-8192',
      systemPrompt: process.env.AI_SYSTEM_PROMPT || systemPrompt,
      prompt,
      temperature: 0.7,
      max_tokens: 500,
      userName: session.user.name
    });

    return completion;
  } catch (error: any) {
    console.error('Error generating AI response:', error);
    throw error;
  }
}
