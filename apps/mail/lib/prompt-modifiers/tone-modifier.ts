import { PromptModifier, AIGenerationContext } from '../ai';
import { EmailTone } from '../types/email-tone';

export class ToneModifier implements PromptModifier {
  constructor(private readonly tone: EmailTone) {}

  modifyPrompt(prompt: string, context: AIGenerationContext): string {
    const toneInstructions = {
      professional: "Write in a professional and business-appropriate tone.",
      friendly: "Write in a warm and friendly tone while maintaining professionalism.",
      formal: "Write in a formal tone suitable for official communications.",
      casual: "Write in a casual and conversational tone.",
      urgent: "Write with a sense of urgency and importance.",
      apologetic: "Write in a sincere and apologetic tone."
    };

    return `${toneInstructions[this.tone]}\n\n${prompt}`;
  }
} 