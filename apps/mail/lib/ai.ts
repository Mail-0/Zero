'use server';
import { createEmbeddings, generateCompletions } from './groq';
import { generateConversationId } from './utils';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { 
    EmailAssistantSystemPrompt, 
    SubjectGenerationSystemPrompt // Import the prompts
} from './prompts';

// AIResponse for Body Generation
interface AIBodyResponse {
  id: string;
  body: string; // Only body is returned
  type: 'email' | 'question' | 'system';
  position?: 'start' | 'end' | 'replace';
}

// User context type
interface UserContext {
  name?: string;
  email?: string;
}

// Conversation history storage
const conversationHistories: Record<
  string,
  { role: 'user' | 'assistant' | 'system'; content: string }[]
> = {};

// --- Generate Email Body --- 
export async function generateEmailBody(
  prompt: string,
  currentContent?: string,
  recipients?: string[],
  subject?: string, // Subject for context only
  conversationId?: string,
  userContext?: UserContext,
): Promise<AIBodyResponse[]> { // Returns body-focused response
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

    // Dynamic context (can still include subject)
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

    // Build conversation history string
    const conversationHistory = conversationHistories[convId]
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .map((msg) => `<message role="${msg.role}">${msg.content}</message>`)
      .join('\n');
      
    // Combine history with current prompt
    const fullPrompt = conversationHistory + `\n<message role="user">${prompt}</message>`;

    // Prepare embeddings context
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
    const { completion: generatedBodyRaw } = await generateCompletions({
      model: 'gpt-4', // Using the more capable model
      systemPrompt: fullSystemPrompt,
      prompt: fullPrompt,
      temperature: 0.7,
      embeddings,
      userName: userName,
    });
    console.log(`AI Assistant (Body): Received completion for convId ${convId}:`, generatedBodyRaw);

    // --- Post-processing: Remove common conversational prefixes --- 
    let generatedBody = generatedBodyRaw;
    const prefixesToRemove = [
        /^Here is the generated email body:/i,
        /^Sure, here's the email body:/i,
        /^Okay, here is the body:/i,
        /^Here's the draft:/i,
        /^Here is the email body:/i,
        /^Here is your email body:/i,
        // Add more prefixes if needed
    ];
    for (const prefixRegex of prefixesToRemove) {
        if (prefixRegex.test(generatedBody.trimStart())) {
            generatedBody = generatedBody.trimStart().replace(prefixRegex, '').trimStart();
            console.log(`AI Assistant Post-Check (Body): Removed prefix matching ${prefixRegex}`);
            break; 
        }
    }
    // --- End Post-processing ---

    // Basic safety checks 
    if (generatedBody.includes('```') || generatedBody.trim().startsWith('<html>')) {
      console.warn(`AI Assistant Post-Check (Body): Detected forbidden content format... Overriding.`);
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
        lowerBody.includes("sorry, i can only assist with email body"); 

    if (isRefusal) {
        console.warn(`AI Assistant Post-Check (Body): Detected refusal/interjection. Overriding.`);
        return [
            { id: 'refusal-' + Date.now(), body: genericFailureMessage, type: 'system' },
        ];
    }

    // Add user prompt and cleaned/validated body to history
    conversationHistories[convId].push({ role: 'user', content: prompt });
    conversationHistories[convId].push({ role: 'assistant', content: generatedBody }); // Log the potentially cleaned body

    const isClarificationNeeded = checkIfQuestion(generatedBody);

    if (isClarificationNeeded) {
       console.log(`AI Assistant (Body): AI response is a clarification question...`);
       return [
         { id: 'question-' + Date.now(), body: generatedBody, type: 'question', position: 'replace' },
       ];
     } else {
       console.log(`AI Assistant (Body): AI response is email body content...`);
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
        return ''; 
    }

    try {
        const systemPrompt = SubjectGenerationSystemPrompt;
        const subjectPrompt = `<email_body>
${body}
</email_body>

Please generate a concise subject line for the email body above.`;

        console.log(`AI Assistant (Subject): Calling generateCompletions...`);
        const { completion: generatedSubjectRaw } = await generateCompletions({
            model: 'gpt-4', // Using the more capable model
            systemPrompt: systemPrompt,
            prompt: subjectPrompt,
            temperature: 0.5, 
        });
        console.log(`AI Assistant (Subject): Received subject completion:`, generatedSubjectRaw); // Log raw

        // --- Post-processing: Remove common conversational prefixes --- 
        let generatedSubject = generatedSubjectRaw;
        const prefixesToRemove = [
            /^Here is the subject line:/i,
            /^Here is a subject line:/i,
            /^Here is a concise subject line for the email:/i,
            /^Okay, the subject is:/i,
            /^Subject:/i, // Remove potential "Subject:" prefix itself
            // Add more common prefixes if observed
        ];
        for (const prefixRegex of prefixesToRemove) {
            if (prefixRegex.test(generatedSubject.trimStart())) {
                generatedSubject = generatedSubject.trimStart().replace(prefixRegex, '').trimStart();
                console.log(`AI Assistant Post-Check (Subject): Removed prefix matching ${prefixRegex}`);
                break; 
            }
        }
        // --- End Post-processing ---

        // Simple cleaning: trim whitespace from potentially cleaned subject
        const cleanSubject = generatedSubject.trim();
        
        if (cleanSubject.toLowerCase().includes('unable to generate subject')) {
            console.warn("AI Assistant (Subject): Detected refusal message.");
            return '';
        }
        
        return cleanSubject;

    } catch (error) {
        console.error(`Error during AI subject generation process...`, error);
        return '';
    }
}

// Helper function to check if text is a question
function checkIfQuestion(text: string): boolean { 
  const trimmedText = text.trim().toLowerCase();
  if (trimmedText.endsWith('?')) return true;
  const questionStarters = [
    'what', 'how', 'why', 'when', 'where', 'who', 'can you', 'could you',
    'would you', 'will you', 'is it', 'are there', 'should i', 'do you',
  ];
  return questionStarters.some((starter) => trimmedText.startsWith(starter));
}
