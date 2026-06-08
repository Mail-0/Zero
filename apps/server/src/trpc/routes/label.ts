import { activeDriverProcedure, createRateLimiterMiddleware, router } from '../trpc';
import { getZeroAgent } from '../../lib/server-utils';
import { Ratelimit } from '@upstash/ratelimit';
import { z } from 'zod';

const automaticCategories = [
  {
    id: 'auto_category_social',
    name: 'Social',
    type: 'user',
  },
  {
    id: 'auto_category_education',
    name: 'Education',
    type: 'user',
  },
  {
    id: 'auto_category_software',
    name: 'Software',
    type: 'user',
  },
  {
    id: 'auto_category_action_required',
    name: 'Action Required',
    type: 'user',
  },
  {
    id: 'auto_category_sport',
    name: 'Sport',
    type: 'user',
  },
  {
    id: 'auto_category_career',
    name: 'Career',
    type: 'user',
  },
];

export const labelsRouter = router({
  list: activeDriverProcedure
    .use(
      createRateLimiterMiddleware({
        generatePrefix: ({ sessionUser }) => `ratelimit:get-labels-${sessionUser?.id}`,
        limiter: Ratelimit.slidingWindow(120, '1m'),
      }),
    )
    .output(
      z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          color: z
            .object({
              backgroundColor: z.string(),
              textColor: z.string(),
            })
            .optional(),
          type: z.string(),
        }),
      ),
    )
    .query(async ({ ctx }) => {
      console.log('[labels.list] returning automatic categories');
      const { activeConnection } = ctx;
      const { stub: agent } = await getZeroAgent(activeConnection.id);
      // return await agent.getUserLabels();
      const labels = await agent.getUserLabels();

      const existingIds = new Set(labels.map((label) => label.id));

      const mergedLabels = [
        ...labels,
        ...automaticCategories.filter((label) => !existingIds.has(label.id)),
      ];

      return mergedLabels;
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
      const { stub: agent } = await getZeroAgent(activeConnection.id);
      const label = {
        ...input,
        type: 'user',
      };
      return await agent.createLabel(label);
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
      const { stub: agent } = await getZeroAgent(activeConnection.id);
      const { id, ...label } = input;
      return await agent.updateLabel(id, label);
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
      const { stub: agent } = await getZeroAgent(activeConnection.id);
      return await agent.deleteLabel(input.id);
    }),
});
