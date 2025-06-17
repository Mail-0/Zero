import { ReSummarizeThread, SummarizeMessage, SummarizeThread } from './brain.fallback.prompts';
import { getSubscriptionFactory } from './factories/subscription-factory.registry';
import { EPrompts, EProviders } from '../types';
import { env } from 'cloudflare:workers';

export const enableBrainFunction = async (connection: { id: string; providerId: EProviders }) => {
  const subscriptionFactory = getSubscriptionFactory(connection.providerId);
  const response = await subscriptionFactory.subscribe({ body: { connectionId: connection.id } });
  if (!response.ok) {
    throw new Error(`Failed to enable brain function: ${response.status} ${response.statusText}`);
  }
  return response;
};

export const disableBrainFunction = async (connection: { id: string; providerId: EProviders }) => {
  const subscriptionFactory = getSubscriptionFactory(connection.providerId);
  const response = await subscriptionFactory.unsubscribe({
    body: { connectionId: connection.id, providerId: connection.providerId },
  });
  if (!response.ok) {
    throw new Error(`Failed to disable brain function: ${response.status} ${response.statusText}`);
  }
  return response;
};

const getPromptName = (connectionId: string, prompt: EPrompts) => {
  return `${connectionId}-${prompt}`;
};

export const getPrompt = async (promptName: string, fallback: string) => {
  const existingPrompt = await env.prompts_storage.get(promptName);
  if (!existingPrompt) {
    await env.prompts_storage.put(promptName, fallback);
    return fallback;
  }
  return existingPrompt;
};

export const getPrompts = async ({ connectionId }: { connectionId: string }) => {
  const prompts: Record<EPrompts, string> = {
    [EPrompts.SummarizeMessage]: '',
    [EPrompts.ReSummarizeThread]: '',
    [EPrompts.SummarizeThread]: '',
    // [EPrompts.ThreadLabels]: '',
    // [EPrompts.Chat]: '',
  };
  const fallbackPrompts = {
    [EPrompts.SummarizeMessage]: SummarizeMessage,
    [EPrompts.ReSummarizeThread]: ReSummarizeThread,
    [EPrompts.SummarizeThread]: SummarizeThread,
    // [EPrompts.ThreadLabels]: '',
    // [EPrompts.Chat]: '',
  };
  for (const promptType of Object.values(EPrompts)) {
    const promptName = getPromptName(connectionId, promptType);
    const prompt = await getPrompt(promptName, fallbackPrompts[promptType]);
    prompts[promptType] = prompt;
  }
  return prompts;
};
