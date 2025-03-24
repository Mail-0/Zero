import { 
  BaseEmailGenerator, 
  AIGenerationContext, 
  AIResponse, 
  RAGProvider, 
  PromptModifier,
  generateEmailContent
} from './ai';

export class EmailGenerator extends BaseEmailGenerator {
  private ragProviders: RAGProvider[] = [];
  private promptModifiers: PromptModifier[] = [];

  constructor(
    private readonly apiKey: string,
    private readonly model: string = 'gpt-4-turbo'
  ) {
    super();
  }

  addRAGProvider(provider: RAGProvider): void {
    this.ragProviders.push(provider);
  }

  addPromptModifier(modifier: PromptModifier): void {
    this.promptModifiers.push(modifier);
  }

  protected async generateWithStrategy(prompt: string, context: AIGenerationContext): Promise<AIResponse[]> {
    try {
      // Apply RAG providers to get additional context
      const ragContext = await this.retrieveRAGContext(prompt, context);
      const enrichedContext = {
        ...context,
        additionalContext: {
          ...context.additionalContext,
          ...ragContext
        }
      };

      // Apply prompt modifiers
      let modifiedPrompt = prompt;
      for (const modifier of this.promptModifiers) {
        modifiedPrompt = modifier.modifyPrompt(modifiedPrompt, enrichedContext);
      }

      // Use the existing generateEmailContent method
      return generateEmailContent(
        modifiedPrompt,
        enrichedContext.currentContent,
        enrichedContext.recipients,
        enrichedContext.conversationId,
        enrichedContext.userContext
      );
    } catch (error) {
      console.error("Error generating email content:", error);
      throw error;
    }
  }

  private async retrieveRAGContext(prompt: string, context: AIGenerationContext): Promise<Record<string, any>> {
    const ragContext: Record<string, any> = {};
    
    for (const provider of this.ragProviders) {
      try {
        const providerContext = await provider.retrieveRelevantContext(prompt, context);
        Object.assign(ragContext, providerContext);
      } catch (error) {
        console.error(`Error retrieving context from RAG provider:`, error);
      }
    }

    return ragContext;
  }
} 