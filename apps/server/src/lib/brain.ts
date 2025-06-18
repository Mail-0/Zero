import { ReSummarizeThread, SummarizeMessage, SummarizeThread } from './brain.fallback.prompts';
import { getSubscriptionFactory } from './factories/subscription-factory.registry';
import { EPrompts, EProviders } from '../types';
import { env } from 'cloudflare:workers';

export const enableBrainFunction = async (connection: { id: string; providerId: EProviders }) => {
  try {
    const subscriptionFactory = getSubscriptionFactory(connection.providerId);
    await subscriptionFactory.subscribe({ body: { connectionId: connection.id } });
  } catch (error) {
    console.error(`Failed to enable brain function: ${error}`);
  }
};

export const disableBrainFunction = async (connection: { id: string; providerId: EProviders }) => {
  try {
    const subscriptionFactory = getSubscriptionFactory(connection.providerId);
    await subscriptionFactory.unsubscribe({
      body: { connectionId: connection.id, providerId: connection.providerId },
    });
  } catch (error) {
    console.error(`Failed to disable brain function: ${error}`);
  }
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
