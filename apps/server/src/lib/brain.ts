import { ReSummarizeThread, SummarizeMessage, SummarizeThread } from './brain.fallback.prompts';
import { getSubscriptionFactory } from './factories/subscription-factory.registry';
import { AiChatPrompt, StyledEmailAssistantSystemPrompt } from './prompts';
import { EPrompts, EProviders } from '../types';
import { getPromptName } from '../pipelines';
import { env } from '../env';

/**
 * Provisions the provider push channel (Gmail: Pub/Sub topic, push subscription and
 * watch) that mailbox sync uses for real-time updates. Only Gmail has one; other
 * providers rely on polling. Failures are logged and retried by the scheduled renewal.
 */
export const provisionMailboxPush = async (connection: { id: string; providerId: EProviders }) => {
  if (connection.providerId !== EProviders.google) return;
  try {
    await getSubscriptionFactory(connection.providerId).subscribe({
      body: { connectionId: connection.id },
    });
  } catch (error) {
    console.error('[mailbox-push] provisioning failed', {
      connectionId: connection.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export const getPrompt = async (promptName: string, fallback: string) => {
  const existingPrompt = await env.prompts_storage.get(promptName);
  if (!existingPrompt || existingPrompt === 'undefined') {
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
    [EPrompts.Chat]: '',
    [EPrompts.Compose]: '',
    // [EPrompts.ThreadLabels]: '',
  };
  const fallbackPrompts = {
    [EPrompts.SummarizeMessage]: SummarizeMessage,
    [EPrompts.ReSummarizeThread]: ReSummarizeThread,
    [EPrompts.SummarizeThread]: SummarizeThread,
    [EPrompts.Chat]: AiChatPrompt(),
    [EPrompts.Compose]: StyledEmailAssistantSystemPrompt(),
    // [EPrompts.ThreadLabels]: '',
  };
  for (const promptType of Object.values(EPrompts)) {
    const promptName = getPromptName(connectionId, promptType);
    const prompt = await getPrompt(promptName, fallbackPrompts[promptType]);
    prompts[promptType] = prompt;
  }
  return prompts;
};
