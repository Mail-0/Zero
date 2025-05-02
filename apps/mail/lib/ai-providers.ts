import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { createOllama } from 'ollama-ai-provider';

export type AIProvider = 'openai' | 'ollama' | 'google';

export const getAIModel = (provider: AIProvider, model: string) => {
  switch (provider) {
    case 'openai':
      return openai(model);
    case 'google':
      return google(model);
    case 'ollama':
      const ollamaClient = createOllama({
        baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/api',
        ...(process.env.OLLAMA_API_KEY && {
          headers: {
            'Authorization': `Bearer ${process.env.OLLAMA_API_KEY}`
          }
        })
      });
      return ollamaClient(model);
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}; 