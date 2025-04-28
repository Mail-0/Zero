import { generateCompletions } from '@/lib/groq';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json();

    const lastMessage = messages[messages.length - 1].content;

    let systemPrompt =
      'You are a helpful AI assistant. Provide clear, concise, and accurate responses.';

    // If this is an email request, modify the system prompt
    if (context?.isEmailRequest) {
      systemPrompt = `You are an email writing assistant. Generate professional, well-structured emails.
When generating an email, always follow this format:
1. Keep the tone professional but friendly
2. Be concise and clear
3. Include a clear subject line
4. Structure the email with a greeting, body, and closing
5. Use appropriate formatting

Output format:
{
  "emailContent": "The full email content",
  "subject": "A clear subject line",
  "content": "A brief message explaining the generated email"
}`;
    }

    const { completion } = await generateCompletions({
      model: 'llama3-8b-8192',
      systemPrompt,
      prompt: context?.isEmailRequest
        ? `Generate a professional email for the following request: ${lastMessage}`
        : lastMessage,
      temperature: 0.7,
      max_tokens: 500,
      userName: 'User',
    });

    // If this was an email request, try to parse the JSON response
    if (context?.isEmailRequest) {
      try {
        const emailData = JSON.parse(completion);
        return NextResponse.json(emailData);
      } catch (error) {
        // If parsing fails, return the completion as regular content
        return NextResponse.json({ content: completion });
      }
    }

    return NextResponse.json({ content: completion });
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 400 });
  }
}
