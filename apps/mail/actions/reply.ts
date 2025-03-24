import { generateAIEmailContent } from './ai';
import { ParsedMessage } from '@/types';
import { authClient } from '@/lib/auth-client';

export async function generateInitialReply(
  emailData: ParsedMessage[], 
  signal?: AbortSignal,
) {
  console.log('generateInitialReply called with:', emailData.length, 'emails');
  const session = await authClient.getSession();
  const userName = session?.data?.activeConnection?.name || session?.data?.user.name;

  let prompt = 'Generate a complete email reply based on this thread:\n\n';

  if (emailData[0]?.subject) {
    prompt += `Subject: ${emailData[0].subject}\n\n`;
  }

  emailData
    .slice()
    .reverse()
    .forEach((email, index) => {
      prompt += `Email ${index + 1}:\n`;
      prompt += `From: ${email.sender.name} <${email.sender.email}>\n`;
      prompt += `Time: ${email.receivedOn}\n`;
      prompt += `Content:\n${email.decodedBody || email.body}\n\n`;
    });

  prompt += '\nPlease generate a natural and contextual reply that:';
  prompt += '\n1. Addresses key points from previous emails';
  prompt += '\n2. Maintains appropriate tone and formality';
  prompt += '\n3. Includes a suitable greeting and sign-off';
  prompt += `\n4. Uses the name "${userName}" in the signature`;

  const response = await generateAIEmailContent({
    prompt,
    currentContent: '',
    signal,
  });

  if (!response.content) 
    throw new Error('Failed to generate reply content');

  // Remove any ghost suggestions or placeholders
  const cleanContent = response.content.replace(/\[.*?\]/g, '').trim();

  // Split content into paragraphs and create document structure
  const paragraphs = cleanContent.split('\n').map(line => ({
    type: 'paragraph',
    content: line.trim() ? [{ type: 'text', text: line }] : []
  }));

  const result = {
    document: {
      type: 'doc',
      content: paragraphs,
    },
    plainText: cleanContent,
  };

  return result;
}
