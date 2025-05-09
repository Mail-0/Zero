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
      if (!ctx.brainServerAvailable) return false;
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
      if (!ctx.brainServerAvailable) return false;
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
      if (!ctx.brainServerAvailable) return null;
      const response = await fetch(env.BRAIN_URL + `/brain/thread/summary/${threadId}`).then(
        (res) => res.json(),
      );
      return (response as { short: string }) ?? null;
    }),
  getState: activeConnectionProcedure.use(brainServerAvailableMiddleware).query(async ({ ctx }) => {
    const connection = ctx.activeConnection;
    const state = await env.subscribed_accounts.get(connection.id);
    if (!state || state === 'pending') return { enabled: false };
    const limit = await getConnectionLimit(connection.id);
    return { limit, enabled: true };
  }),
});
