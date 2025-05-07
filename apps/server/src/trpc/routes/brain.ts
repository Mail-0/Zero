import { activeConnectionProcedure, brainServerAvailableMiddleware, router } from '../trpc';
import { disableBrainFunction, enableBrainFunction } from '../../lib/brain';
import { z } from 'zod';

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
      return await enableBrainFunction(ctx.c.env, connection);
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
      return await disableBrainFunction(ctx.c.env, connection);
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
      const response = await fetch(ctx.c.env.BRAIN_URL + `/brain/thread/summary/${threadId}`).then(
        (res) => res.json(),
      );
      return (response as { short: string }) ?? null;
    }),
  getState: activeConnectionProcedure.use(brainServerAvailableMiddleware).query(async ({ ctx }) => {
    const connection = ctx.activeConnection;
    if (!ctx.brainServerAvailable) return { enabled: false };
    const response = await fetch(ctx.c.env.BRAIN_URL + `/limit/${connection.id}`).then((res) =>
      res.json(),
    );
    return (response as { enabled: boolean }) ?? null;
  }),
});
