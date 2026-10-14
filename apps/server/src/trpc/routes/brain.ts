import {
  getShortThreadSummary,
  shortenThreadSummary,
  shortSummaryDepsFromEnv,
} from '../../lib/thread-short-summary';
import { activeConnectionProcedure, router } from '../trpc';
import { summariesEnabled } from '../../lib/ai-settings';
import { getUserAiSettings } from '../../lib/ai-access';
import { getPrompts } from '../../lib/brain';
import { EPrompts } from '../../types';
import { env } from '../../env';
import { z } from 'zod';

export const brainRouter = router({
  generateSummary: activeConnectionProcedure
    .input(
      z.object({
        threadId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const connection = ctx.activeConnection;
      if (!summariesEnabled(await getUserAiSettings(ctx.sessionUser.id))) return null;
      const deps = shortSummaryDepsFromEnv(env);
      const existing = await getShortThreadSummary(deps, input.threadId, connection.id);
      if (existing) return { data: { short: existing } };

      // No stored summary (backfilled or older thread): summarize now for entitled
      // users. The runner checks entitlement and coalesces concurrent opens.
      const runner = env.WORKFLOW_RUNNER.get(
        env.WORKFLOW_RUNNER.idFromName(`${connection.id}:${input.threadId}`),
      );
      const summary = await runner.generateThreadSummary({
        connectionId: connection.id,
        threadId: input.threadId,
        providerId: connection.providerId,
      });
      if (!summary) return null;
      const short = await shortenThreadSummary(deps, input.threadId, connection.id, summary);
      return short ? { data: { short } } : null;
    }),
  getPrompts: activeConnectionProcedure.query(async ({ ctx }) => {
    const connection = ctx.activeConnection;
    return await getPrompts({ connectionId: connection.id });
  }),
  updatePrompt: activeConnectionProcedure
    .input(
      z.object({
        promptType: z.nativeEnum(EPrompts),
        content: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const connection = ctx.activeConnection;

      const promptName = `${connection.id}-${input.promptType}`;

      await env.prompts_storage.put(promptName, input.content);

      return { success: true };
    }),
});
