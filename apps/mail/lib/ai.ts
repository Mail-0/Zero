'use server';
import { createEmbeddings, generateCompletions } from './groq';
import { generateConversationId } from './utils';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import {
  EmailAssistantSystemPrompt,
  SubjectGenerationSystemPrompt,
  StyleMatrixExtractorPrompt,
  StyledEmailAssistantSystemPrompt,
  EmailAssistantPrompt,
} from './prompts';
import { generateText, generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getWritingStyleMatrixForConnectionId } from '@/services/writing-style-service';

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

const genericFailureMessage = "Unable to fulfill your request.";
export const generateEmailBody = async ({
  prompt,
  currentContent,
  recipients,
  subject,
}: {
  prompt: string,
  currentContent?: string,
  recipients?: string[],
  subject?: string, // Subject for context only
  userContext?: UserContext,
}): Promise<AIBodyResponse[]> => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }

    const headersList = await headers()
    const session = await auth.api.getSession({ headers: headersList });

    if (!session) {
      throw new Error('Unauthorized');
    }

    if (!session.connectionId) {
      throw new Error('No active connection');
    }

    const userName = session.user.name ?? 'User'
    const userId = session.user.id ?? 'anonymous'

    const writingStyleMatrix = await getWritingStyleMatrixForConnectionId(session.connectionId)

    const systemPrompt = writingStyleMatrix ?
      StyledEmailAssistantSystemPrompt(userName, writingStyleMatrix.style) :
      EmailAssistantSystemPrompt(userName);

    const finalPrompt = EmailAssistantPrompt({
      currentSubject: subject,
      currentDraft: currentContent,
      recipients,
      prompt,
    })

    const {
      text,
    } = await generateText({
      model: openai('gpt-4o'),
      system: systemPrompt,
      prompt: finalPrompt,
      maxTokens: 600,
      temperature: 0.35, // controlled creativity
      frequencyPenalty: 0.2, // dampen phrase repetition
      presencePenalty: 0.1, // nudge the model to add fresh info
      maxRetries: 1,
    })

    return postProcessMessage(text)
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

const postProcessMessage = (text: string): AIBodyResponse[] => {
  // --- Post-processing: Remove common conversational prefixes ---
  let generatedBody = text;
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

  // Comprehensive safety checks for HTML tags and code blocks
  const unsafePattern = /(```|~~~|<[^>]+>|&lt;[^&]+&gt;|<script|<style|\bjavascript:|data:)/i;
  if (unsafePattern.test(generatedBody)) {
    console.warn(`AI Assistant Post-Check (Body): Detected forbidden content format (HTML/code)... Overriding.`);
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

export const extractStyleMatrix = async (emailBody: string) => {
  if (!emailBody.trim()) {
    throw new Error('Invalid body provided.')
  }

  const {
    object,
  } = await generateObject({
    model: openai('gpt-4o-mini'),
    system: StyleMatrixExtractorPrompt(),
    prompt: emailBody.trim(),
    schema: z.object({
      // greeting and sign-off may be absent
      greeting: z.string().nullable(),
      signOff: z.string().nullable(),

      // structural
      avgSentenceLen: z.number(),
      avgParagraphLen: z.number(),
      listUsageRatio: z.number().min(0).max(1),

      // tone
      sentimentScore: z.number().min(-1).max(1),
      politenessScore: z.number().min(0).max(1),
      confidenceScore: z.number().min(0).max(1),
      urgencyScore: z.number().min(0).max(1),
      empathyScore: z.number().min(0).max(1),
      formalityScore: z.number().min(0).max(1),

      // style ratios
      passiveVoiceRatio: z.number().min(0).max(1),
      hedgingRatio: z.number().min(0).max(1),
      intensifierRatio: z.number().min(0).max(1),

      // readability and vocabulary
      readabilityFlesch: z.number(),
      lexicalDiversity: z.number().min(0).max(1),
      jargonRatio: z.number().min(0).max(1),

      // engagement cues
      questionCount: z.number().int().nonnegative(),
      ctaCount: z.number().int().nonnegative(),
      emojiCount: z.number().int().nonnegative(),
      exclamationFreq: z.number(),

      // casual-vs-formal extensions
      slangRatio: z.number().min(0).max(1),
      contractionRatio: z.number().min(0).max(1),
      lowercaseSentenceStartRatio: z.number().min(0).max(1),
      emojiDensity: z.number().min(0),
      casualPunctuationRatio: z.number().min(0).max(1),
      capConsistencyScore: z.number().min(0).max(1),
      honorificPresence: z.number().int().min(0).max(1),
      phaticPhraseRatio: z.number().min(0).max(1),
    }),
    temperature: 0, // Lower temperature for more deterministic output
    maxTokens: 300,
    mode: 'json',
    maxRetries: 3,
  })

  const greeting = object.greeting?.trim().toLowerCase()
  const signOff = object.signOff?.trim().toLowerCase()
  return {
    ...object,
    greeting: greeting ?? null,
    signOff: signOff ?? null,
    greetingTotal: greeting ? 1 : 0,
    signOffTotal: signOff ? 1 : 0,
  }
}
