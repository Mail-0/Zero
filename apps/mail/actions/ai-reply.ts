'use server';

import { getUserSettings } from '@/actions/settings';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

// Function to truncate email thread content to fit within token limits
function truncateThreadContent(threadContent: string, maxTokens: number = 12000): string {
  // Split the thread into individual emails
  const emails = threadContent.split('\n---\n');

  // Start with the most recent email (last in the array)
  let truncatedContent = emails[emails.length - 1];

  // Add previous emails until we reach the token limit
  for (let i = emails.length - 2; i >= 0; i--) {
    const newContent = `${emails[i]}\n---\n${truncatedContent}`;

    // Rough estimation of tokens (1 token ≈ 4 characters)
    const estimatedTokens = newContent.length / 4;

    if (estimatedTokens > maxTokens) {
      break;
    }

    truncatedContent = newContent;
  }

  return truncatedContent;
}

export async function generateAIResponse(
  threadContent: string,
  originalSender: string,
): Promise<string> {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured');
  }

  // Get user settings to check for custom prompt
  const userSettings = await getUserSettings();
  const customPrompt = userSettings?.customPrompt || '';

  // Truncate the thread content to fit within token limits
  const truncatedThreadContent = truncateThreadContent(threadContent);

  // Create the prompt for OpenAI
  const prompt = `
  ${process.env.AI_SYSTEM_PROMPT}

 You should write as if your name is ${session.user.name}, who is the user writing an email reply.
  
  Here's the context of the email thread:
  ${truncatedThreadContent}
  
  Generate a professional, helpful, and concise email reply to ${originalSender}.
  
  Requirements:
  - Be concise but thorough (2-3 paragraphs maximum)
  - Base your reply on the context provided. sometimes there will be an email that needs to be replied in an orderly manner while other times you will want a casual reply. 
  - Address the key points from the original email
  - Close with an appropriate sign-off
  - Don't use placeholder text or mention that you're an AI
  - Write as if you are (${session.user.name})
  - Don't include the subject line in the reply
  - Double space paragraphs (2 newlines)
  - Add two spaces bellow the sign-off

Here is some additional information about the user:
${customPrompt}

  `;

  try {
    // Direct OpenAI API call using fetch
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful email assistant that generates concise, professional replies.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      throw new Error(`OpenAI API Error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await openaiResponse.json();
    return data.choices[0]?.message?.content || '';
  } catch (error: any) {
    console.error('OpenAI API Error:', error);
    throw new Error(`OpenAI API Error: ${error.message || 'Unknown error'}`);
  }
}
