import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { env } from '../env';

/**
 * Every LLM call goes through OpenRouter, so one key covers all model vendors.
 * Model ids are OpenRouter slugs ("vendor/model").
 *
 * Uses the dedicated OpenRouter provider rather than `@ai-sdk/openai` with a
 * custom baseURL: the OpenAI provider treats any model id starting with "o"
 * (including "openai/...") as a reasoning model and forces strict tool schemas,
 * which rejects tools with optional nested fields.
 */
const DEFAULT_CHAT_MODEL = 'openai/gpt-4.1';
const DEFAULT_MINI_MODEL = 'openai/gpt-4.1-mini';

const openrouter = () => {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }
  return createOpenRouter({
    apiKey: env.OPENROUTER_API_KEY,
    compatibility: 'strict',
    headers: {
      'HTTP-Referer': env.VITE_PUBLIC_APP_URL || 'https://0.email',
      'X-Title': 'Zero',
    },
  });
};

/** Main model: the chat agent, drafting, and anything with tool calls. */
export const chatModel = () => openrouter().chat(env.OPENROUTER_MODEL || DEFAULT_CHAT_MODEL);

/** Cheap, fast model for small one-shot tasks. */
export const miniModel = () => openrouter().chat(env.OPENROUTER_MINI_MODEL || DEFAULT_MINI_MODEL);
