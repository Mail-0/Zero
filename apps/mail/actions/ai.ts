// The brain.ts file in /actions should replace this file once ready.
'use server';

import { AIResponse, UserContext, generateConversationId, checkIfQuestion, formatEmailContent, conversationHistories } from "@/lib/ai";
import { JSONContent } from "novel";
import { EmailGenerator } from "@/lib/email-generator";
import { EmailHistoryProvider } from "@/lib/rag-providers/email-history-provider";
import { ToneModifier } from "@/lib/prompt-modifiers/tone-modifier";
import { ToneInferenceProvider } from "@/lib/rag-providers/tone-inference-provider";
import { EmailTone } from "@/lib/types/email-tone";

interface AIEmailResponse {
  content: string;
  jsonContent: JSONContent;
  type: 'email' | 'question' | 'system';
}

// Create a singleton instance of the email generator
const emailGenerator = new EmailGenerator(process.env.OPENAI_API_KEY || '');

// Initialize with default providers and modifiers
emailGenerator.addRAGProvider(new EmailHistoryProvider());
emailGenerator.addRAGProvider(new ToneInferenceProvider());

export async function generateAIEmailContent({
  prompt,
  currentContent,
  to,
  isEdit = false,
  conversationId,
  userContext,
  signal,
}: {
  prompt: string;
  currentContent?: string;
  to?: string[];
  isEdit?: boolean;
  conversationId?: string;
  userContext?: UserContext;
  signal?: AbortSignal;
}): Promise<AIEmailResponse> {
  try {
    const toneProvider = new ToneInferenceProvider();
    const toneContext = await toneProvider.retrieveRelevantContext(prompt, {
      currentContent,
      recipients: to,
      userContext
    });

    const emailTone = toneContext.inferredTones as EmailTone[];

    const response = await emailGenerator.generate(prompt, {
      currentContent,
      recipients: to,
      conversationId,
      userContext,
      additionalContext: {
        conversationHistories,
        emailTone,
      }
    });

    if (!response || response.length === 0) 
      throw new Error('No response generated');
    

    const aiResponse = response[0];
    if (!aiResponse || !aiResponse.content || !aiResponse.type) 
      throw new Error('Invalid response format');
    
    
    return {
      content: aiResponse.content,
      jsonContent: createJsonContent([aiResponse.content]),
      type: aiResponse.type
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') 
      throw error;
    
    console.error("Error generating email content:", error);
    throw error;
  }
}

export async function generateAIQuickReply(
  prompt: string,
  currentContent?: string,
  recipients?: string[],
  userContext?: UserContext
): Promise<AIEmailResponse[]> {
  try {
    // First, get the inferred tones from the context
    const toneProvider = new ToneInferenceProvider();
    const toneContext = await toneProvider.retrieveRelevantContext(prompt, {
      currentContent,
      recipients,
      userContext
    });

    const inferredTones = toneContext.inferredTones as EmailTone[];
    const toneDescription = toneContext.toneContext as string;

    // Generate responses for each inferred tone
    const allResponses = await Promise.all(
      inferredTones.map(async (tone) => {
        const modifiedContext = userContext ? {
          ...userContext,
          name: userContext.name ? `${userContext.name} (Quick ${tone} Reply)` : undefined
        } : undefined;

        // Create a temporary generator with the appropriate tone modifier
        const quickReplyGenerator = new EmailGenerator(process.env.OPENAI_API_KEY || '');
        quickReplyGenerator.addRAGProvider(new EmailHistoryProvider());
        quickReplyGenerator.addPromptModifier(new ToneModifier(tone));

        return quickReplyGenerator.generate(
          `Generate a brief reply that matches the following context: ${toneDescription}\n\n${prompt}`,
          {
            currentContent,
            recipients,
            userContext: modifiedContext
          }
        ).catch(() => null);
      })
    );

    // Check if any response is a question
    const questionResponse = allResponses
      .flatMap(r => (r || []) as AIResponse[])
      .find(r => r?.type === 'question');

    if (questionResponse) {
      return [{
        content: questionResponse.content,
        jsonContent: createJsonContent([questionResponse.content]),
        type: 'question'
      }];
    }

    // Process all email responses
    const responses = allResponses.flatMap(r => (r || []) as AIResponse[]);
    const emailResponses = responses.filter((r): r is AIResponse => r?.type === 'email');

    // Combine responses with tone labels
    return emailResponses.map((response, index) => {
      const tone = inferredTones[index] || 'Unknown';
      const content = response?.content;
      const formattedContent = content 
        ? `[${tone.charAt(0).toUpperCase() + tone.slice(1)}]\n\n${content}`
        : `No ${tone} response generated.`;

      return {
        content: formattedContent,
        jsonContent: createJsonContent([formattedContent]),
        type: 'email'
      };
    });
  } catch (error) {
    console.error("Error generating quick replies:", error);
 
    return [{
      content: "Sorry, I encountered an error while generating content. Please try again with a different prompt.",
      jsonContent: createJsonContent(["Sorry, I encountered an error while generating content. Please try again with a different prompt."]),
      type: 'system'
    }];
  }
}

function createJsonContent(paragraphs: string[]): JSONContent {
  if (paragraphs.length === 0) {
    paragraphs = ["Failed to generate content. Please try again with a different prompt."];
  }
  
  return {
    type: "doc",
    content: paragraphs.map(paragraph => ({
      type: "paragraph",
      content: [{ type: "text", text: paragraph }]
    }))
  };
} 