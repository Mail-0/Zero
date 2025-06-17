import { disableBrainFunction, getPrompts } from '../../lib/brain';
import { EProviders, type ISubscribeBatch } from '../../types';
import { activeConnectionProcedure, router } from '../trpc';
import { setSubscribedState } from '../../lib/utils';
import { env } from 'cloudflare:workers';
import { z } from 'zod';

const labelSchema = z.object({
  name: z.string(),
  usecase: z.string(),
});

const labelsSchema = z.array(labelSchema);

export const brainRouter = router({
  enableBrain: activeConnectionProcedure.mutation(async ({ ctx }) => {
    const connection = ctx.activeConnection as { id: string; providerId: EProviders };
    await setSubscribedState(connection.id, connection.providerId);
    await env.subscribe_queue.send({
      connectionId: connection.id,
      providerId: connection.providerId,
    } as ISubscribeBatch);
    return true;
    // return await enableBrainFunction(connection);
  }),
  disableBrain: activeConnectionProcedure.mutation(async ({ ctx }) => {
    const connection = ctx.activeConnection as { id: string; providerId: EProviders };
    return await disableBrainFunction(connection);
  }),

  generateSummary: activeConnectionProcedure
    .input(
      z.object({
        threadId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { threadId } = input;
      const response = await env.VECTORIZE.getByIds([threadId]);
      if (response.length && response?.[0]?.metadata?.['content']) {
        const result = response[0].metadata as { content: string; connection: string };
        if (result.connection !== ctx.activeConnection.id) return null;
        const shortResponse = await env.AI.run('@cf/facebook/bart-large-cnn', {
          input_text: result.content,
        });
        return {
          data: {
            short: shortResponse.summary,
          },
        };
      }
      return null;
    }),
  getState: activeConnectionProcedure.query(async ({ ctx }) => {
    const connection = ctx.activeConnection;
    const state = await env.subscribed_accounts.get(`${connection.id}__${connection.providerId}`);
    if (!state || state === 'pending') return { enabled: false };
    return { enabled: true };
  }),
  getLabels: activeConnectionProcedure
    .output(
      z.array(
        z.object({
          name: z.string(),
          usecase: z.string(),
        }),
      ),
    )
    .query(async ({ ctx }) => {
      const connection = ctx.activeConnection;
      const labels = await env.connection_labels.get(connection.id);
      try {
        return labels ? (JSON.parse(labels) as z.infer<typeof labelsSchema>) : [];
      } catch (error) {
        console.error(`[GET_LABELS] Error parsing labels for ${connection.id}:`, error);
        return [];
      }
    }),
  getPrompts: activeConnectionProcedure.query(async ({ ctx }) => {
    const connection = ctx.activeConnection;
    return await getPrompts({ connectionId: connection.id });
  }),
  updateLabels: activeConnectionProcedure
    .input(
      z.object({
        labels: labelsSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const connection = ctx.activeConnection;
      console.log(input.labels);

      const labels = labelsSchema.parse(input.labels);
      console.log(labels);

      await env.connection_labels.put(connection.id, JSON.stringify(labels));
      return { success: true };
    }),
});
