import { activeDriverProcedure, createRateLimiterMiddleware, router } from '../trpc';
import { getZeroAgent } from '../../lib/server-utils';
import { Ratelimit } from '@upstash/ratelimit';
import { z } from 'zod';

export const labelsRouter = router({
  list: activeDriverProcedure
    .use(
      createRateLimiterMiddleware({
        generatePrefix: ({ sessionUser }) => `ratelimit:get-labels-${sessionUser?.id}`,
        limiter: Ratelimit.slidingWindow(60, '1m'),
      }),
    )
    .query(async ({ ctx }) => {
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);
      return ((await agent.callDriver('getUserLabels')) as { type: string }[]).filter(
        (label) => label.type === 'user',
      );
    }),
  create: activeDriverProcedure
    .use(
      createRateLimiterMiddleware({
        generatePrefix: ({ sessionUser }) => `ratelimit:labels-post-${sessionUser?.id}`,
        limiter: Ratelimit.slidingWindow(60, '1m'),
      }),
    )
    .input(
      z.object({
        name: z.string(),
        color: z
          .object({
            backgroundColor: z.string(),
            textColor: z.string(),
          })
          .default({
            backgroundColor: '',
            textColor: '',
          }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);
      const label = {
        ...input,
        type: 'user',
      };
      return await agent.callDriver('createLabel', label);
    }),
  update: activeDriverProcedure
    .use(
      createRateLimiterMiddleware({
        generatePrefix: ({ sessionUser }) => `ratelimit:labels-patch-${sessionUser?.id}`,
        limiter: Ratelimit.slidingWindow(60, '1m'),
      }),
    )
    .input(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string().optional(),
        color: z
          .object({
            backgroundColor: z.string(),
            textColor: z.string(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);
      const { id, ...label } = input;
      return await agent.callDriver('updateLabel', id, label);
    }),
  delete: activeDriverProcedure
    .use(
      createRateLimiterMiddleware({
        generatePrefix: ({ sessionUser }) => `ratelimit:labels-delete-${sessionUser?.id}`,
        limiter: Ratelimit.slidingWindow(60, '1m'),
      }),
    )
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);
      return await agent.callDriver('deleteLabel', input.id);
    }),
});
