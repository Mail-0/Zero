import { activeDriverProcedure, router } from '../trpc';
import { createDraftData } from '@/lib/schemas';
import { z } from 'zod';

export const draftsRouter = router({
  create: activeDriverProcedure.input(createDraftData).mutation(async ({ input, ctx }) => {
    const { driver } = ctx;
    return driver.createDraft(input);
  }),
  get: activeDriverProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
    const { driver } = ctx;
    const { id } = input;
    return driver.getDraft(id);
  }),
  list: activeDriverProcedure
    .input(
      z.object({
        q: z.string().optional(),
        max: z.number().optional(),
        pageToken: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { driver } = ctx;
      const { q, max, pageToken } = input;
      return driver.listDrafts({ q, maxResults: max, pageToken });
    }),
});
