'use server';
import { createEmbeddings, generateCompletions } from './groq';
import { generateConversationId } from './utils';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { EmailAssistantSystemPrompt } from './prompts';

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
  const userName = session?.user.name || 'User';
  const convId = conversationId || generateConversationId();

  console.log(`AI Assistant: Processing prompt for convId ${convId}: "${prompt}"`);

  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('Groq API key is not configured');
    }

    // Initialize conversation history if it doesn't exist
    if (!conversationHistories[convId]) {
      conversationHistories[convId] = [];
    }

    const baseSystemPrompt = EmailAssistantSystemPrompt(userName);

    // Dynamic context
    let dynamicContext = '\n\n<dynamic_context>\n';
    if (currentContent) {
      dynamicContext += `  <current_draft>${currentContent}</current_draft>\n`;
    }
    if (recipients && recipients.length > 0) {
      dynamicContext += `  <recipients>${recipients.join(', ')}</recipients>\n`;
    }
    dynamicContext += '</dynamic_context>\n';
    const fullSystemPrompt = baseSystemPrompt + (dynamicContext.length > 30 ? dynamicContext : '');

    // Build conversation history string for the prompt
    const conversationHistory = conversationHistories[convId]
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .map((msg) => `<message role="${msg.role}">${msg.content}</message>`)
      .join('\n');
      
    const fullPrompt = conversationHistory + `\n<message role="user">${prompt}</message>`;

    // Embeddings
    const embeddingTexts: Record<string, string> = {};
    if (currentContent) { embeddingTexts.currentEmail = currentContent; }
    if (prompt) { embeddingTexts.userPrompt = prompt; }
    const previousMessages = conversationHistories[convId].slice(-4);
    if (previousMessages.length > 0) {
      embeddingTexts.conversationHistory = previousMessages.map((msg) => `${msg.role}: ${msg.content}`).join('\n\n');
    }
    let embeddings = {};
    try { embeddings = await createEmbeddings(embeddingTexts); } catch (e) { console.error('Embedding error:', e); }

    // --- AI Call ---
    console.log(`AI Assistant: Calling generateCompletions for convId ${convId}...`);
    const { completion } = await generateCompletions({
      model: 'gpt-4o-mini',
      systemPrompt: fullSystemPrompt,
      prompt: fullPrompt,
      temperature: 0.7,
      embeddings,
      userName: userName,
    });
    console.log(`AI Assistant: Received completion for convId ${convId}:`, completion);

    // --- Post-AI Safety Net ---
    const refusalContent = "Sorry, I can only assist with email-related tasks.";
    if (completion.includes('```') || completion.trim().startsWith('<html>')) {
      console.warn(`AI Assistant Post-Check: Detected forbidden content (code block or HTML) in AI response for convId ${convId}. Overriding.`);
      conversationHistories[convId].push({ role: 'user', content: prompt });
      conversationHistories[convId].push({ role: 'assistant', content: refusalContent });
      return [
        { id: 'override-' + Date.now(), content: refusalContent, type: 'system' },
      ];
    }
    
    // --- Process Valid Completion ---
    const generatedContent = completion.trim();
    conversationHistories[convId].push({ role: 'user', content: prompt });
    conversationHistories[convId].push({ role: 'assistant', content: generatedContent });

    const isClarificationNeeded = checkIfQuestion(generatedContent);

    if (isClarificationNeeded) {
       console.log(`AI Assistant: AI response is a clarification question for convId ${convId}.`);
       return [
         { id: 'question-' + Date.now(), content: generatedContent, type: 'question', position: 'replace' },
       ];
     } else {
       console.log(`AI Assistant: AI response is email content for convId ${convId}.`);
       return [
         { id: 'email-' + Date.now(), content: generatedContent, type: 'email', position: 'replace' },
       ];
     }

  } catch (error) {
    console.error(`Error during AI email generation process for convId ${convId}:`, error);
    return [
      {
        id: 'error-' + Date.now(),
        content: "Sorry, I encountered an error processing your request.",
        type: 'system',
      },
    ];
  }
}

function checkIfQuestion(prompt: string): boolean {
  const trimmedPrompt = prompt.trim().toLowerCase();
  if (trimmedPrompt.endsWith('?')) return true;
  const questionStarters = [
    'what', 'how', 'why', 'when', 'where', 'who', 'can you', 'could you',
    'would you', 'will you', 'is it', 'are there', 'should i', 'do you',
  ];
  return questionStarters.some((starter) => trimmedPrompt.startsWith(starter));
}
