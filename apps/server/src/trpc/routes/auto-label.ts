import { applyAutoLabelClassification, classifyThread } from '../../lib/ai-auto-labeling';
import { activeDriverProcedure, router } from '../trpc';
import { getZeroAgent } from '../../lib/server-utils';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

const threadInput = z.object({
  threadId: z.string().min(1),
});

export const autoLabelRouter = router({
  classify: activeDriverProcedure.input(threadInput).query(async ({ ctx, input }) => {
    const agent = await getZeroAgent(ctx.activeConnection.id);
    const thread = await agent.getThread(input.threadId);

    if (!thread.messages.length) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Thread is not available locally yet.',
      });
    }

    const classification = classifyThread(thread);
    const appliedLabelNames = new Set(
      [
        ...thread.labels.map((label) => label.name),
        ...thread.messages.flatMap((message) => message.tags.map((tag) => tag.name)),
      ].map((name) => name.toLowerCase()),
    );

    return {
      ...classification,
      alreadyApplied: classification.labelName
        ? appliedLabelNames.has(classification.labelName.toLowerCase())
        : false,
    };
  }),
  apply: activeDriverProcedure.input(threadInput).mutation(async ({ ctx, input }) => {
    const agent = await getZeroAgent(ctx.activeConnection.id);
    const thread = await agent.getThread(input.threadId);

    if (!thread.messages.length) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Thread is not available locally yet.',
      });
    }

    const classification = classifyThread(thread);
    const currentLabelIds = [
      ...new Set([
        ...thread.labels.map((label) => label.id),
        ...thread.messages.flatMap((message) => message.tags.map((tag) => tag.id)),
      ]),
    ];
    const result = await applyAutoLabelClassification(
      agent,
      input.threadId,
      classification,
      currentLabelIds,
    );

    return { classification, ...result };
  }),
});
