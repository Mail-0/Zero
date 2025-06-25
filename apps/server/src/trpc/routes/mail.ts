import { activeDriverProcedure, createRateLimiterMiddleware, router } from '../trpc';
import { updateWritingStyleMatrix } from '../../services/writing-style-service';
import { deserializeFiles, serializedFileSchema } from '../../lib/schemas';
import { defaultPageSize, FOLDERS, LABELS } from '../../lib/utils';
import type { DeleteAllSpamResponse } from '../../types';
import { getZeroAgent } from '../../lib/server-utils';
import { env } from 'cloudflare:workers';
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
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);
      return await agent.getThread(input.id);
    }),
  count: activeDriverProcedure.query(async ({ ctx }) => {
    const { activeConnection } = ctx;
    const agent = getZeroAgent(activeConnection.id);
    return await agent.count();
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
    .query(async ({ ctx, input }) => {
      const { folder, max, cursor, q } = input;
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);

      if (folder === FOLDERS.DRAFT) {
        const drafts = await agent.listDrafts({
          q,
          maxResults: max,
          pageToken: cursor,
        });
        return drafts;
      }
      type ThreadItem = { id: string; historyId: string | null; $raw?: unknown };

      const threadsResponse: {
        threads: ThreadItem[];
        nextPageToken: string | null;
      } = await agent.list({
        folder,
        query: q,
        maxResults: max,
        pageToken: cursor,
      });

      if (folder === FOLDERS.SNOOZED) {
        const nowTs = Date.now();
        const filtered: ThreadItem[] = [];

        await Promise.all(
          threadsResponse.threads.map(async (t) => {
            const keyName = `${t.id}__${activeConnection.id}`;
            try {
              const wakeAtIso = await (env as any).snoozed_emails.get(keyName);
              if (!wakeAtIso) {
                filtered.push(t);
                return;
              }

              const wakeAt = new Date(wakeAtIso).getTime();
              if (wakeAt > nowTs) {
                filtered.push(t);
                return;
              }

              console.log('[UNSNOOZE_ON_ACCESS] Expired thread', t.id, {
                wakeAtIso,
                now: new Date(nowTs).toISOString(),
              });

              await agent.modifyLabels([t.id], ['INBOX'], ['SNOOZED']);
              await (env as any).snoozed_emails.delete(keyName);
            } catch (error) {
              console.error('[UNSNOOZE_ON_ACCESS] Failed for', t.id, error);
              filtered.push(t);
            }
          }),
        );

        threadsResponse.threads = filtered;
      }
      return threadsResponse;
    }),
  markAsRead: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);
      return agent.markAsRead(input.ids);
    }),
  markAsUnread: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);
      return agent.markAsUnread(input.ids);
    }),
  markAsImportant: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, ['IMPORTANT'], []);
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
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);
      const { threadId, addLabels, removeLabels } = input;

      console.log(`Server: updateThreadLabels called for thread ${threadId}`);
      console.log(`Adding labels: ${addLabels.join(', ')}`);
      console.log(`Removing labels: ${removeLabels.join(', ')}`);

      const result = await agent.normalizeIds(threadId);
      const { threadIds } = result;

      if (threadIds.length) {
        await agent.modifyLabels(threadIds, addLabels, removeLabels);
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
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);
      const { threadIds } = await agent.normalizeIds(input.ids);

      if (!threadIds.length) {
        return { success: false, error: 'No thread IDs provided' };
      }

      const threadResults: PromiseSettledResult<{ messages: { tags: { name: string }[] }[] }>[] =
        await Promise.allSettled(threadIds.map((id) => agent.get(id)));

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

      await agent.modifyLabels(threadIds, shouldStar ? ['STARRED'] : [], shouldStar ? [] : ['STARRED']);

      return { success: true };
    }),
  toggleImportant: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);
      const { threadIds } = await agent.normalizeIds(input.ids);

      if (!threadIds.length) {
        return { success: false, error: 'No thread IDs provided' };
      }

      const threadResults: PromiseSettledResult<{ messages: { tags: { name: string }[] }[] }>[] =
        await Promise.allSettled(threadIds.map((id) => agent.get(id)));

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

      await agent.modifyLabels(threadIds, shouldMarkImportant ? ['IMPORTANT'] : [], shouldMarkImportant ? [] : ['IMPORTANT']);

      return { success: true };
    }),
  bulkStar: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, ['STARRED'], []);
    }),
  bulkMarkImportant: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, ['IMPORTANT'], []);
    }),
  bulkUnstar: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, [], ['STARRED']);
    }),
  deleteAllSpam: activeDriverProcedure.mutation(async ({ ctx }): Promise<DeleteAllSpamResponse> => {
    const { activeConnection } = ctx;
    const agent = getZeroAgent(activeConnection.id);
    try {
      return await agent.deleteAllSpam();
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
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, [], ['IMPORTANT']);
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
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);
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
        await agent.sendDraft(draftId, mail);
      } else {
        await agent.create(input);
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
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);
      return agent.delete(input.id);
    }),
  bulkDelete: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, ['TRASH'], []);
    }),
  bulkArchive: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, [], ['INBOX']);
    }),
  bulkMute: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, ['MUTE'], []);
    }),
  getEmailAliases: activeDriverProcedure.query(async ({ ctx }) => {
    const { activeConnection } = ctx;
    const agent = getZeroAgent(activeConnection.id);
    return agent.getEmailAliases();
  }),
  snoozeThreads: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
        wakeAt: z.string(), // ISO string
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);

      if (!input.ids.length) {
        return { success: false, error: 'No thread IDs provided' };
      }

      // Apply labels
      await agent.modifyLabels(input.ids, ['SNOOZED'], ['INBOX']);

      // Persist wake time in KV for each thread
      const wakeAtIso = new Date(input.wakeAt).toISOString();
      await Promise.all(
        input.ids.map((threadId) =>
          (env as any).snoozed_emails.put(`${threadId}__${activeConnection.id}`, wakeAtIso),
        ),
      );

      return { success: true };
    }),
  unsnoozeThreads: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = getZeroAgent(activeConnection.id);
      if (!input.ids.length) return { success: false, error: 'No thread IDs' };
      await agent.modifyLabels(input.ids, ['INBOX'], ['SNOOZED']);

      await Promise.all(
        input.ids.map((threadId) => (env as any).snoozed_emails.delete(`${threadId}__${activeConnection.id}`)),
      );
      return { success: true };
    }),
});
