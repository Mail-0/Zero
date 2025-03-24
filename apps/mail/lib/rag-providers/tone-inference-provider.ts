import { RAGProvider, AIGenerationContext } from '../ai';
import { EmailTone } from '../types/email-tone';

export class ToneInferenceProvider implements RAGProvider {
  async retrieveRelevantContext(prompt: string, context: AIGenerationContext): Promise<Record<string, any>> {
    try {
      // Analyze the current email content and context to infer appropriate tones
      const inferredTones = this.inferTones(context);
      
      return {
        inferredTones,
        toneContext: this.generateToneContext(inferredTones)
      };
    } catch (error) {
      console.error('Error inferring tones:', error);
      return {
        inferredTones: ['professional', 'friendly', 'concise'], // Fallback tones
        toneContext: "Using default professional, friendly, and concise tones."
      };
    }
  }

  private inferTones(context: AIGenerationContext): EmailTone[] {
    const tones: EmailTone[] = [];
    const content = context.currentContent || '';
    const recipients = context.recipients || [];

    // Analyze content for tone indicators
    const contentAnalysis = this.analyzeContent(content);
    
    // Analyze recipients for tone indicators
    const recipientAnalysis = this.analyzeRecipients(recipients);
    
    // Combine analyses to determine appropriate tones
    if (contentAnalysis.isUrgent || recipientAnalysis.isUrgent) {
      tones.push('urgent');
    }
    
    if (contentAnalysis.isFormal || recipientAnalysis.isFormal) {
      tones.push('formal');
    } else if (contentAnalysis.isCasual || recipientAnalysis.isCasual) {
      tones.push('casual');
    }
    
    if (contentAnalysis.isApologetic) {
      tones.push('apologetic');
    }
    
    // Always include professional and friendly as base tones
    if (!tones.includes('professional')) {
      tones.push('professional');
    }
    if (!tones.includes('friendly')) {
      tones.push('friendly');
    }
    
    // Ensure we have exactly 3 tones
    return tones.slice(0, 3);
  }

  private analyzeContent(content: string): {
    isUrgent: boolean;
    isFormal: boolean;
    isCasual: boolean;
    isApologetic: boolean;
  } {
    const urgentPatterns = [
      /urgent/i,
      /asap/i,
      /immediately/i,
      /right away/i,
      /deadline/i
    ];

    const formalPatterns = [
      /dear sir/i,
      /dear madam/i,
      /regards/i,
      /sincerely/i,
      /yours truly/i
    ];

    const casualPatterns = [
      /hey/i,
      /hi there/i,
      /thanks/i,
      /cheers/i,
      /best/i
    ];

    const apologeticPatterns = [
      /sorry/i,
      /apologize/i,
      /regret/i,
      /unfortunately/i,
      /mistake/i
    ];

    return {
      isUrgent: urgentPatterns.some(pattern => pattern.test(content)),
      isFormal: formalPatterns.some(pattern => pattern.test(content)),
      isCasual: casualPatterns.some(pattern => pattern.test(content)),
      isApologetic: apologeticPatterns.some(pattern => pattern.test(content))
    };
  }

  private analyzeRecipients(recipients: string[]): {
    isUrgent: boolean;
    isFormal: boolean;
    isCasual: boolean;
  } {
    const formalDomains = ['gov', 'edu', 'org'];
    const urgentKeywords = ['urgent', 'emergency', 'support', 'help'];
    
    return {
      isUrgent: recipients.some(email => 
        urgentKeywords.some(keyword => email.toLowerCase().includes(keyword))
      ),
      isFormal: recipients.some(email => 
        formalDomains.some(domain => email.toLowerCase().includes(domain))
      ),
      isCasual: recipients.length === 1 && !!recipients[0] && !recipients[0]?.includes('@')
    };
  }

  private generateToneContext(tones: EmailTone[]): string {
    const toneDescriptions = {
      professional: "Maintaining a professional and business-appropriate tone",
      friendly: "Keeping a warm and friendly tone while maintaining professionalism",
      formal: "Using a formal tone suitable for official communications",
      casual: "Adopting a casual and conversational tone",
      urgent: "Conveying a sense of urgency and importance",
      apologetic: "Expressing a sincere and apologetic tone"
    };

    return `Based on the email context, I've identified these appropriate tones: ${tones.map(tone => toneDescriptions[tone]).join(', ')}.`;
  }
} 