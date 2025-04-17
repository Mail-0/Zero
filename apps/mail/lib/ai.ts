'use server';
import { createEmbeddings, generateCompletions } from './groq';
import { generateConversationId } from './utils';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { EmailAssistantSystemPrompt } from './prompts';

// Define a new AIResponse structure that includes subject
interface AIResponse {
  id: string;
  subject?: string; // Add subject field
  body: string;    // Rename content to body
  type: 'email' | 'question' | 'system';
  position?: 'start' | 'end' | 'replace';
}

// Define user context type
interface UserContext {
  name?: string;
  email?: string;
}

// Function to parse the AI response. Tries strict format, falls back to body-only.
function parseAICompletion(completion: string): { subject: string | undefined; body: string } {
  const trimmedCompletion = completion.trim();
  
  // Regex to capture content within <SUBJECT>...</SUBJECT> and <BODY>...</BODY>
  const xmlRegex = /^<SUBJECT>\s*([\s\S]*?)\s*<\/SUBJECT>\s*<BODY>\s*([\s\S]*?)\s*<\/BODY>$/i;
  
  const match = trimmedCompletion.match(xmlRegex);

  if (match && match[1] !== undefined && match[2] !== undefined) {
    const extractedSubject = match[1].trim();
    const extractedBody = match[2].trim();
    // Check if extracted body STARTS with preamble/refusal
    if (!extractedBody.match(/^\s*(I cannot|I am unable to|As an AI|My purpose is|Okay,|Sure,|Here\'s|I\'m happy to help|I suggest|I recommend)/i)) {
        console.log("AI Assistant Parser: Matched <SUBJECT>/<BODY> format without preamble.");
        return {
            subject: extractedSubject ? extractedSubject : undefined,
            body: extractedBody,
        };
    } else {
        console.warn("AI Assistant Parser: Found XML format, but body started with preamble/refusal. Falling back.");
        // Fall through to fallback below
    }
  }

  // Fallback: Assume entire completion is the body if strict format failed or was rejected.
  console.warn("AI Assistant Parser: Strict <SUBJECT>/<BODY> format not matched correctly or rejected. Treating entire completion as body.");
  return { subject: undefined, body: trimmedCompletion }; 
}

const conversationHistories: Record<
  string,
  { role: 'user' | 'assistant' | 'system'; content: string }[]
> = {};

export async function generateEmailContent(
  prompt: string,
  currentContent?: string,
  recipients?: string[],
  subject?: string,
  conversationId?: string,
  userContext?: UserContext,
): Promise<AIResponse[]> {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  const userName = session?.user.name || 'User';
  const convId = conversationId || generateConversationId();

  console.log(`AI Assistant: Processing prompt for convId ${convId}: "${prompt}"`);

  const genericFailureMessage = "Unable to fulfill your request."; // Define generic failure message

  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('Groq API key is not configured');
    }

    // Initialize conversation history if it doesn't exist
    if (!conversationHistories[convId]) {
      conversationHistories[convId] = [];
    }

    const baseSystemPrompt = EmailAssistantSystemPrompt(userName);

    // Dynamic context - ADD SUBJECT
    let dynamicContext = '\n\n<dynamic_context>\n';
    if (subject) { // Add current subject context
      dynamicContext += `  <current_subject>${subject}</current_subject>\n`;
    }
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

    // --- Post-AI Safety Net (Forbidden Content Format) ---
    if (completion.includes('```') || completion.trim().startsWith('<html>')) {
      console.warn(`AI Assistant Post-Check: Detected forbidden content format... Overriding.`);
      conversationHistories[convId].push({ role: 'user', content: prompt });
      conversationHistories[convId].push({ role: 'assistant', content: genericFailureMessage }); // Log generic failure
      return [
        { id: 'override-' + Date.now(), body: genericFailureMessage, type: 'system' },
      ];
    }
    
    // --- Process & Validate Completion ---
    const parsedResult = parseAICompletion(completion);

    if (!parsedResult) {
        // Parsing failed (strict format error)
        console.warn(`AI Assistant Post-Check: Strict format parsing failed for completion. Overriding.`);
        conversationHistories[convId].push({ role: 'user', content: prompt });
        conversationHistories[convId].push({ role: 'assistant', content: genericFailureMessage }); // Log generic failure
        return [
            { id: 'format-' + Date.now(), body: genericFailureMessage, type: 'system' },
        ];
    }

    // Parsing succeeded, check body content for refusals/interjections we don't want
    const { subject: generatedSubject, body: generatedBody } = parsedResult;
    const lowerBody = generatedBody.toLowerCase();
    const isRefusal = 
        lowerBody.includes("i cannot") || 
        lowerBody.includes("i'm unable to") || 
        lowerBody.includes("i am unable to") ||
        lowerBody.includes("as an ai") ||
        lowerBody.includes("my purpose is to assist") ||
        lowerBody.includes("violates my safety guidelines"); 
        // Add more refusal patterns if needed

    if (isRefusal) {
        console.warn(`AI Assistant Post-Check: Detected refusal/interjection in parsed body. Overriding.`);
        conversationHistories[convId].push({ role: 'user', content: prompt });
        conversationHistories[convId].push({ role: 'assistant', content: genericFailureMessage }); // Log generic failure
        return [
            { id: 'refusal-' + Date.now(), body: genericFailureMessage, type: 'system' },
        ];
    }

    // Add user prompt and VALIDATED/PARSED body to history
    conversationHistories[convId].push({ role: 'user', content: prompt });
    conversationHistories[convId].push({ role: 'assistant', content: generatedBody });

    // Check if the VALIDATED body is a clarification question
    const isClarificationNeeded = checkIfQuestion(generatedBody);

    if (isClarificationNeeded) {
       console.log(`AI Assistant: AI response is a clarification question...`);
       return [
         { id: 'question-' + Date.now(), body: generatedBody, type: 'question', position: 'replace' },
       ];
     } else {
       // It's a valid email generation!
       console.log(`AI Assistant: AI response is email content...`);
       return [
         { id: 'email-' + Date.now(), subject: generatedSubject, body: generatedBody, type: 'email', position: 'replace' },
       ];
     }

  } catch (error) {
    console.error(`Error during AI email generation process...`, error);
    return [
      {
        id: 'error-' + Date.now(),
        body: genericFailureMessage, // Use generic failure on catch
        type: 'system',
      },
    ];
  }
}

function checkIfQuestion(body: string): boolean { // Parameter renamed for clarity
  const trimmedBody = body.trim().toLowerCase();
  if (trimmedBody.endsWith('?')) return true;
  const questionStarters = [
    'what', 'how', 'why', 'when', 'where', 'who', 'can you', 'could you',
    'would you', 'will you', 'is it', 'are there', 'should i', 'do you',
  ];
  return questionStarters.some((starter) => trimmedBody.startsWith(starter));
}
