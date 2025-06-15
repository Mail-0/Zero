import { activeDriverProcedure, createRateLimiterMiddleware, router } from '../trpc';
import { updateWritingStyleMatrix } from '../../services/writing-style-service';
import { deserializeFiles, serializedFileSchema } from '../../lib/schemas';
import { defaultPageSize, FOLDERS, LABELS } from '../../lib/utils';
import type { DeleteAllSpamResponse } from '../../types';
import { Ratelimit } from '@upstash/ratelimit';
import { z } from 'zod';

const senderSchema = z.object({
  name: z.string().optional(),
  email: z.string(),
});

export const mailRouter = router({
  get: activeDriverProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { driver } = ctx;
      return await driver.get(input.id);
    }),
  count: activeDriverProcedure.query(async ({ ctx }) => {
    const { driver } = ctx;
    return await driver.count();
  }),
  listThreads: activeDriverProcedure
    .input(
      z.object({
        folder: z.string().optional().default('inbox'),
        q: z.string().optional().default(''),
        max: z.number().optional().default(defaultPageSize),
        cursor: z.string().optional().default(''),
      }),
    )
    // .use(
    //   createRateLimiterMiddleware({
    //     generatePrefix: ({ sessionUser }, input) =>
    //       `ratelimit:list-threads-${input.folder}-${sessionUser?.id}`,
    //     limiter: Ratelimit.slidingWindow(60, '1m'),
    //   }),
    // )
    .query(async ({ ctx, input }) => {
      const { folder, max, cursor, q } = input;
      const { driver } = ctx;

      if (folder === FOLDERS.DRAFT) {
        const drafts = await driver.listDrafts({ q, maxResults: max, pageToken: cursor });
        return drafts;
      }
      const threadsResponse = await driver.list({
        folder,
        query: q,
        maxResults: max,
        pageToken: cursor,
      });
      return threadsResponse;
    }),
  markAsRead: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { driver } = ctx;
      return driver.markAsRead(input.ids);
    }),
  markAsUnread: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { driver } = ctx;
      return driver.markAsUnread(input.ids);
    }),
  markAsImportant: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { driver } = ctx;
      return driver.modifyLabels(input.ids, { addLabels: ['IMPORTANT'], removeLabels: [] });
    }),
  modifyLabels: activeDriverProcedure
    .input(
      z.object({
        threadId: z.string().array(),
        addLabels: z.string().array().optional().default([]),
        removeLabels: z.string().array().optional().default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { driver } = ctx;
      const { threadId, addLabels, removeLabels } = input;

      console.log(`Server: updateThreadLabels called for thread ${threadId}`);
      console.log(`Adding labels: ${addLabels.join(', ')}`);
      console.log(`Removing labels: ${removeLabels.join(', ')}`);

      const { threadIds } = driver.normalizeIds(threadId);

      if (threadIds.length) {
        await driver.modifyLabels(threadIds, {
          addLabels,
          removeLabels,
        });
        console.log('Server: Successfully updated thread labels');
        return { success: true };
      }

      console.log('Server: No label changes specified');
      return { success: false, error: 'No label changes specified' };
    }),

  toggleStar: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { driver } = ctx;
      const { threadIds } = driver.normalizeIds(input.ids);

      if (!threadIds.length) {
        return { success: false, error: 'No thread IDs provided' };
      }

      const threadResults = await Promise.allSettled(threadIds.map((id) => driver.get(id)));

      let anyStarred = false;
      let processedThreads = 0;

      for (const result of threadResults) {
        if (result.status === 'fulfilled' && result.value && result.value.messages.length > 0) {
          processedThreads++;
          const isThreadStarred = result.value.messages.some((message) =>
            message.tags?.some((tag) => tag.name.toLowerCase().startsWith('starred')),
          );
          if (isThreadStarred) {
            anyStarred = true;
            break;
          }
        }
      }

      const shouldStar = processedThreads > 0 && !anyStarred;

      await driver.modifyLabels(threadIds, {
        addLabels: shouldStar ? ['STARRED'] : [],
        removeLabels: shouldStar ? [] : ['STARRED'],
      });

      return { success: true };
    }),
  toggleImportant: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { driver } = ctx;
      const { threadIds } = driver.normalizeIds(input.ids);

      if (!threadIds.length) {
        return { success: false, error: 'No thread IDs provided' };
      }

      const threadResults = await Promise.allSettled(threadIds.map((id) => driver.get(id)));

      let anyImportant = false;
      let processedThreads = 0;

      for (const result of threadResults) {
        if (result.status === 'fulfilled' && result.value && result.value.messages.length > 0) {
          processedThreads++;
          const isThreadImportant = result.value.messages.some((message) =>
            message.tags?.some((tag) => tag.name.toLowerCase().startsWith('important')),
          );
          if (isThreadImportant) {
            anyImportant = true;
            break;
          }
        }
      }

      const shouldMarkImportant = processedThreads > 0 && !anyImportant;

      await driver.modifyLabels(threadIds, {
        addLabels: shouldMarkImportant ? ['IMPORTANT'] : [],
        removeLabels: shouldMarkImportant ? [] : ['IMPORTANT'],
      });

      return { success: true };
    }),
  bulkStar: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { driver } = ctx;
      return driver.modifyLabels(input.ids, { addLabels: ['STARRED'], removeLabels: [] });
    }),
  bulkMarkImportant: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { driver } = ctx;
      return driver.modifyLabels(input.ids, { addLabels: ['IMPORTANT'], removeLabels: [] });
    }),
  bulkUnstar: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { driver } = ctx;
      return driver.modifyLabels(input.ids, { addLabels: [], removeLabels: ['STARRED'] });
    }),
  deleteAllSpam: activeDriverProcedure.mutation(async ({ ctx }): Promise<DeleteAllSpamResponse> => {
    const { driver } = ctx;
    try {
      return await driver.deleteAllSpam();
    } catch (error) {
      console.error('Error deleting spam emails:', error);
      return {
        success: false,
        message: 'Failed to delete spam emails',
        error: String(error),
        count: 0,
      };
    }
  }),
  bulkUnmarkImportant: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { driver } = ctx;
      return driver.modifyLabels(input.ids, { addLabels: [], removeLabels: ['IMPORTANT'] });
    }),

  send: activeDriverProcedure
    .input(
      z.object({
        to: z.array(senderSchema),
        subject: z.string(),
        message: z.string(),
        attachments: z
          .array(serializedFileSchema)
          .transform(deserializeFiles)
          .optional()
          .default([]),
        headers: z.record(z.string()).optional().default({}),
        cc: z.array(senderSchema).optional(),
        bcc: z.array(senderSchema).optional(),
        threadId: z.string().optional(),
        fromEmail: z.string().optional(),
        draftId: z.string().optional(),
        isForward: z.boolean().optional(),
        originalMessage: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { driver, activeConnection } = ctx;
      const { draftId, ...mail } = input;

      const afterTask = async () => {
        try {
          console.warn('Saving writing style matrix...');
          await updateWritingStyleMatrix(activeConnection.id, input.message);
          console.warn('Saved writing style matrix.');
        } catch (error) {
          console.error('Failed to save writing style matrix', error);
        }
      };

      if (draftId) {
        await driver.sendDraft(draftId, mail);
      } else {
        await driver.create(input);
      }

      ctx.c.executionCtx.waitUntil(afterTask());
      return { success: true };
    }),
  delete: activeDriverProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { driver } = ctx;
      return driver.delete(input.id);
    }),
  bulkDelete: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { driver } = ctx;
      return driver.modifyLabels(input.ids, { addLabels: ['TRASH'], removeLabels: [] });
    }),
  bulkArchive: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { driver } = ctx;
      return driver.modifyLabels(input.ids, { addLabels: [], removeLabels: ['INBOX'] });
    }),
  bulkMute: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { driver } = ctx;
      return driver.modifyLabels(input.ids, { addLabels: ['MUTE'], removeLabels: [] });
    }),
  getEmailAliases: activeDriverProcedure.query(async ({ ctx }) => {
    const { driver } = ctx;
    return driver.getEmailAliases();
  }),
});
