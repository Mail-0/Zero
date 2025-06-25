import { activeDriverProcedure, router } from '../trpc';
import { getZeroAgent } from '../../lib/server-utils';
import { createDraftData } from '../../lib/schemas';
import { z } from 'zod';

export const draftsRouter = router({
  create: activeDriverProcedure.input(createDraftData).mutation(async ({ input, ctx }) => {
    const { activeConnection } = ctx;
    const agent = getZeroAgent(activeConnection.id);
    return agent.createDraft(input);
  }),
  get: activeDriverProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
    const { activeConnection } = ctx;
    const agent = getZeroAgent(activeConnection.id);
    const { id } = input;
    return agent.getDraft(id);
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
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);
      const { q, max, pageToken } = input;
      return agent.listDrafts({ q, maxResults: max, pageToken });
    }),
});
