import { openai } from '@ai-sdk/openai';
import { createOllama } from 'ollama-ai-provider';

// Check if Ollama is configured via environment variables
const hasOllamaConfig = process.env.OLLAMA_BASE_URL;

// Define available providers - OpenAI is always available, Ollama only if configured
export type AIProvider = 'openai' | (typeof hasOllamaConfig extends true ? 'ollama' : never);

// Default configuration with fallbacks
const DEFAULT_CONFIG = {
  // OpenAI is the default provider with GPT-3.5-turbo as default model
  openai: {
    model: process.env.OPENAI_MODEL ?? 'gpt-3.5-turbo',
  },
  // Ollama configuration only included if OLLAMA_BASE_URL is set
  ...(hasOllamaConfig ? {
    ollama: {
      baseURL: process.env.OLLAMA_BASE_URL!,
      apiKey: process.env.OLLAMA_API_KEY,
    },
  } : {}),
} as const;

// Type for getAIModel parameters - model is optional for OpenAI, required for Ollama
type GetAIModelParams = 
  | { provider: 'openai'; model?: string }
  | (typeof hasOllamaConfig extends true ? { provider: 'ollama'; model: string } : never);

export const getAIModel = ({ provider, model }: GetAIModelParams) => {
  if (provider === 'openai') {
    return openai(model || DEFAULT_CONFIG.openai.model);
  }
  
  if (provider === 'ollama') {
    if (!hasOllamaConfig) throw new Error('Ollama provider is not configured');
    if (!model) throw new Error('Model parameter is required for Ollama provider');
    const ollamaClient = createOllama({
      baseURL: DEFAULT_CONFIG.ollama!.baseURL,
      ...(DEFAULT_CONFIG.ollama!.apiKey && {
        headers: {
          'Authorization': `Bearer ${DEFAULT_CONFIG.ollama!.apiKey}`
        }
      })
    });
    return ollamaClient(model);
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}; 