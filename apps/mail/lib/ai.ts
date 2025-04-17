'use server';
import { createEmbeddings, generateCompletions } from './groq';
import { generateConversationId } from './utils';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { 
    EmailAssistantSystemPrompt, 
    SubjectGenerationSystemPrompt // Import the new prompt
} from './prompts';

// Modified AIResponse - Subject is now handled separately
interface AIResponse {
  id: string;
  body: string; // Only body is returned now
  type: 'email' | 'question' | 'system';
  position?: 'start' | 'end' | 'replace';
}

// Define user context type
interface UserContext {
  name?: string;
  email?: string;
}

// REMOVED: parseAICompletion function is no longer needed for body generation
// function parseAICompletion(...) { ... }

const conversationHistories: Record<
  string,
  { role: 'user' | 'assistant' | 'system'; content: string }[]
> = {};

// --- Generate Email Body --- 
export async function generateEmailBody(
  prompt: string,
  currentContent?: string,
  recipients?: string[],
  subject?: string, // Still accept subject for context, but don't generate it
  conversationId?: string,
  userContext?: UserContext,
): Promise<AIResponse[]> { // Returns body-focused response
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  const userName = session?.user.name || 'User';
  const convId = conversationId || generateConversationId();

  console.log(`AI Assistant (Body): Processing prompt for convId ${convId}: "${prompt}"`);

  const genericFailureMessage = "Unable to fulfill your request.";

  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('Groq API key is not configured');
    }

    if (!conversationHistories[convId]) {
      conversationHistories[convId] = [];
    }

    // Use the BODY-ONLY system prompt
    const baseSystemPrompt = EmailAssistantSystemPrompt(userName);

    // Dynamic context (can still include subject if available)
    let dynamicContext = '\n\n<dynamic_context>\n';
    if (subject) {
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

    const conversationHistory = conversationHistories[convId]
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .map((msg) => `<message role="${msg.role}">${msg.content}</message>`)
      .join('\n');
      
    const fullPrompt = conversationHistory + `\n<message role="user">${prompt}</message>`;

    const embeddingTexts: Record<string, string> = {};
    if (currentContent) { embeddingTexts.currentEmail = currentContent; }
    if (prompt) { embeddingTexts.userPrompt = prompt; }
    const previousMessages = conversationHistories[convId].slice(-4);
    if (previousMessages.length > 0) {
      embeddingTexts.conversationHistory = previousMessages.map((msg) => `${msg.role}: ${msg.content}`).join('\n\n');
    }
    let embeddings = {};
    try { embeddings = await createEmbeddings(embeddingTexts); } catch (e) { console.error('Embedding error:', e); }

    console.log(`AI Assistant (Body): Calling generateCompletions for convId ${convId}...`);
    const { completion: generatedBody } = await generateCompletions({
      model: 'gpt-4',
      systemPrompt: fullSystemPrompt,
      prompt: fullPrompt,
      temperature: 0.7,
      embeddings,
      userName: userName,
    });
    console.log(`AI Assistant (Body): Received completion for convId ${convId}:`, generatedBody);

    // No parsing needed for body based on the new prompt

    // Basic safety checks remain
    if (generatedBody.includes('```') || generatedBody.trim().startsWith('<html>')) {
      console.warn(`AI Assistant Post-Check (Body): Detected forbidden content format... Overriding.`);
      // Log failure appropriately if needed
      return [
        { id: 'override-' + Date.now(), body: genericFailureMessage, type: 'system' },
      ];
    }
    
    const lowerBody = generatedBody.toLowerCase();
    const isRefusal = 
        lowerBody.includes("i cannot") || 
        lowerBody.includes("i'm unable to") || 
        lowerBody.includes("i am unable to") ||
        lowerBody.includes("as an ai") ||
        lowerBody.includes("my purpose is to assist") ||
        lowerBody.includes("violates my safety guidelines") ||
        lowerBody.includes("sorry, i can only assist with email body"); // Check for refusal message

    if (isRefusal) {
        console.warn(`AI Assistant Post-Check (Body): Detected refusal/interjection. Overriding.`);
        // Log failure appropriately if needed
        return [
            { id: 'refusal-' + Date.now(), body: genericFailureMessage, type: 'system' },
        ];
    }

    // Add user prompt and generated body to history
    conversationHistories[convId].push({ role: 'user', content: prompt });
    conversationHistories[convId].push({ role: 'assistant', content: generatedBody });

    const isClarificationNeeded = checkIfQuestion(generatedBody);

    if (isClarificationNeeded) {
       console.log(`AI Assistant (Body): AI response is a clarification question...`);
       return [
         { id: 'question-' + Date.now(), body: generatedBody, type: 'question', position: 'replace' },
       ];
     } else {
       console.log(`AI Assistant (Body): AI response is email body content...`);
       // Return only the body and type
       return [
         { id: 'email-' + Date.now(), body: generatedBody, type: 'email', position: 'replace' },
       ];
     }

  } catch (error) {
    console.error(`Error during AI email body generation process...`, error);
    return [
      {
        id: 'error-' + Date.now(),
        body: genericFailureMessage,
        type: 'system',
      },
    ];
  }
}

// --- Generate Subject for Email Body ---
export async function generateSubjectForEmail(body: string): Promise<string> {
    console.log("AI Assistant (Subject): Generating subject for body:", body.substring(0, 100) + "...");

    if (!body || body.trim() === '') {
        console.warn("AI Assistant (Subject): Cannot generate subject for empty body.");
        return ''; // Return empty string if body is empty
    }

    try {
        const systemPrompt = SubjectGenerationSystemPrompt;
        // Construct a simple prompt containing the body
        const subjectPrompt = `<email_body>
${body}
</email_body>

Please generate a concise subject line for the email body above.`;

        console.log(`AI Assistant (Subject): Calling generateCompletions...`);
        const { completion: generatedSubject } = await generateCompletions({
            model: 'gpt-4',
            systemPrompt: systemPrompt,
            prompt: subjectPrompt,
            temperature: 0.5, // Lower temperature might be better for concise subjects
            // No embeddings or history needed for subject generation usually
        });
        console.log(`AI Assistant (Subject): Received subject completion:`, generatedSubject);

        // Simple cleaning: trim whitespace
        const cleanSubject = generatedSubject.trim();
        
        // Basic check for refusal message from the subject prompt
        if (cleanSubject.toLowerCase().includes('unable to generate subject')) {
            console.warn("AI Assistant (Subject): Detected refusal message.");
            return ''; // Return empty if AI refused
        }
        
        return cleanSubject;

    } catch (error) {
        console.error(`Error during AI subject generation process...`, error);
        return ''; // Return empty string on error
    }
}

// Helper function (remains unchanged)
function checkIfQuestion(text: string): boolean { 
  const trimmedText = text.trim().toLowerCase();
  if (trimmedText.endsWith('?')) return true;
  const questionStarters = [
    'what', 'how', 'why', 'when', 'where', 'who', 'can you', 'could you',
    'would you', 'will you', 'is it', 'are there', 'should i', 'do you',
  ];
  return questionStarters.some((starter) => trimmedText.startsWith(starter));
}
