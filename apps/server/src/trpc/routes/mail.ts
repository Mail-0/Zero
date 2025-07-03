import { activeDriverProcedure, createRateLimiterMiddleware, router } from '../trpc';
import { updateWritingStyleMatrix } from '../../services/writing-style-service';
import { deserializeFiles, serializedFileSchema } from '../../lib/schemas';
import { defaultPageSize, FOLDERS, LABELS } from '../../lib/utils';
import { IGetThreadResponseSchema } from '../../lib/driver/types';
import type { DeleteAllSpamResponse } from '../../types';
import { getZeroAgent } from '../../lib/server-utils';
import { env } from 'cloudflare:workers';
import { z } from 'zod';

const senderSchema = z.object({
  name: z.string().optional(),
  email: z.string(),
});

const FOLDER_TO_LABEL_MAP: Record<string, string> = {
  inbox: 'INBOX',
  sent: 'SENT',
  draft: 'DRAFT',
  spam: 'SPAM',
  trash: 'TRASH',
};

const getFolderLabelId = (folder: string) => {
  return FOLDER_TO_LABEL_MAP[folder];
};

export const mailRouter = router({
  get: activeDriverProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .output(IGetThreadResponseSchema)
    .query(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return await agent.getThread(input.id);
    }),
  count: activeDriverProcedure
    .output(
      z.array(
        z.object({
          count: z.number().optional(),
          label: z.string().optional(),
        }),
      ),
    )
    .query(async ({ ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return await agent.count();
    }),
  listThreads: activeDriverProcedure
    .input(
      z.object({
        folder: z.string().optional().default('inbox'),
        q: z.string().optional().default(''),
        max: z.number().optional().default(defaultPageSize),
        cursor: z.string().optional().default(''),
        labelIds: z.array(z.string()).optional().default([]),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { folder, max, cursor, q, labelIds } = input;
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);

      if (folder === FOLDERS.DRAFT) {
        const drafts = await agent.listDrafts({
          q,
          maxResults: max,
          pageToken: cursor,
        });
        return drafts;
      }
      //   if (q) {
      const threadsResponse = await agent.listThreads({
        labelIds: labelIds,
        maxResults: max,
        pageToken: cursor,
        query: q,
        folder,
      });
      return threadsResponse;
      //   }
      //   const folderLabelId = getFolderLabelId(folder);
      //   const labelIdsToUse = folderLabelId ? [...labelIds, folderLabelId] : labelIds;
      //   const threadsResponse = await agent.getThreadsFromDB({
      //     labelIds: labelIdsToUse,
      //     max: max,
      //     cursor: cursor,
      //   });
      //   return threadsResponse;
    }),
  markAsRead: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
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
      const agent = await getZeroAgent(activeConnection.id);
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
      const agent = await getZeroAgent(activeConnection.id);
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
      const agent = await getZeroAgent(activeConnection.id);
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
      const agent = await getZeroAgent(activeConnection.id);
      const { threadIds } = await agent.normalizeIds(input.ids);

      if (!threadIds.length) {
        return { success: false, error: 'No thread IDs provided' };
      }

      const threadResults: PromiseSettledResult<{ messages: { tags: { name: string }[] }[] }>[] =
        await Promise.allSettled(threadIds.map((id) => agent.getThread(id)));

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

      await agent.modifyLabels(
        threadIds,
        shouldStar ? ['STARRED'] : [],
        shouldStar ? [] : ['STARRED'],
      );

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
      const agent = await getZeroAgent(activeConnection.id);
      const { threadIds } = await agent.normalizeIds(input.ids);

      if (!threadIds.length) {
        return { success: false, error: 'No thread IDs provided' };
      }

      const threadResults: PromiseSettledResult<{ messages: { tags: { name: string }[] }[] }>[] =
        await Promise.allSettled(threadIds.map((id) => agent.getThread(id)));

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

      await agent.modifyLabels(
        threadIds,
        shouldMarkImportant ? ['IMPORTANT'] : [],
        shouldMarkImportant ? [] : ['IMPORTANT'],
      );

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
      const agent = await getZeroAgent(activeConnection.id);
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
      const agent = await getZeroAgent(activeConnection.id);
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
      const agent = await getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, [], ['STARRED']);
    }),
  deleteAllSpam: activeDriverProcedure.mutation(async ({ ctx }): Promise<DeleteAllSpamResponse> => {
    const { activeConnection } = ctx;
    const agent = await getZeroAgent(activeConnection.id);
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
      const agent = await getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, [], ['IMPORTANT']);
    }),

  send: activeDriverProcedure
    .input(
      z.object({
        to: z.array(senderSchema),
        subject: z.string(),
        message: z.string(),
        attachments: z.array(serializedFileSchema).optional().default([]),
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
      const agent = await getZeroAgent(activeConnection.id);
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
      const agent = await getZeroAgent(activeConnection.id);
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
      const agent = await getZeroAgent(activeConnection.id);
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
      const agent = await getZeroAgent(activeConnection.id);
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
      const agent = await getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, ['MUTE'], []);
    }),
  getEmailAliases: activeDriverProcedure.query(async ({ ctx }) => {
    const { activeConnection } = ctx;
    const agent = await getZeroAgent(activeConnection.id);
    return agent.getEmailAliases();
  }),
});
