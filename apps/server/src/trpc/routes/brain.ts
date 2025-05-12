import { activeConnectionProcedure, brainServerAvailableMiddleware, router } from '../trpc';
import { disableBrainFunction, enableBrainFunction } from '../../lib/brain';
import { env } from 'cloudflare:workers';
import { z } from 'zod';

/**
 * Gets the current connection limit for a given connection ID
 * @param connectionId The connection ID to check
 * @returns Promise<number> The current limit
 */
export const getConnectionLimit = async (connectionId: string): Promise<number> => {
  try {
    const limit = await env.connection_limits.get(connectionId);
    return limit ? Number(limit) : Number(env.DEFAULT_BRAIN_LIMIT);
  } catch (error) {
    console.error(`[GET_CONNECTION_LIMIT] Error getting limit for ${connectionId}:`, error);
    throw error;
  }
};

export const brainRouter = router({
  enableBrain: activeConnectionProcedure
    .input(
      z.object({
        connection: z
          .object({
            id: z.string(),
            providerId: z.string(),
          })
          .optional(),
      }),
    )
    .use(brainServerAvailableMiddleware)
    .mutation(async ({ ctx, input }) => {
      let { connection } = input;
      if (!connection) connection = ctx.activeConnection;
      return await enableBrainFunction(connection);
    }),
  disableBrain: activeConnectionProcedure
    .input(
      z.object({
        connection: z
          .object({
            id: z.string(),
            providerId: z.string(),
          })
          .optional(),
      }),
    )
    .use(brainServerAvailableMiddleware)
    .mutation(async ({ ctx, input }) => {
      let { connection } = input;
      if (!connection) connection = ctx.activeConnection;
      return await disableBrainFunction(connection);
    }),

  generateSummary: activeConnectionProcedure
    .use(brainServerAvailableMiddleware)
    .input(
      z.object({
        threadId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { threadId } = input;
      return (await env.zero.getSummary({ type: 'thread', id: threadId })) as {
        data: {
          long: string;
          short: string;
        };
      };
    }),
  getState: activeConnectionProcedure.use(brainServerAvailableMiddleware).query(async ({ ctx }) => {
    const connection = ctx.activeConnection;
    const state = await env.subscribed_accounts.get(connection.id);
    if (!state || state === 'pending') return { enabled: false };
    const limit = await getConnectionLimit(connection.id);
    return { limit, enabled: true };
  }),
  getLabels: activeConnectionProcedure
    .use(brainServerAvailableMiddleware)
    .output(z.array(z.string()))
    .query(async ({ ctx }) => {
      const connection = ctx.activeConnection;
      const labels = await env.connection_labels.get(connection.id);
      return labels?.split(',') ?? [];
    }),
  updateLabels: activeConnectionProcedure
    .use(brainServerAvailableMiddleware)
    .input(
      z.object({
        labels: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const connection = ctx.activeConnection;
      await env.connection_labels.put(connection.id, input.labels.join(','));
      return { success: true };
    }),
});
