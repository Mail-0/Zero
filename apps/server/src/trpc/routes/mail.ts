import {
  activeDriverProcedure,
  createRateLimiterMiddleware,
  router,
  privateProcedure,
} from '../trpc';
import { updateWritingStyleMatrix } from '../../services/writing-style-service';
import { serializedFileSchema } from '../../lib/schemas';
import { defaultPageSize, FOLDERS, LABELS } from '../../lib/utils';
import type { DeleteAllSpamResponse, IEmailSendBatch } from '../../types';
import { getZeroAgent, getZeroDB } from '../../lib/server-utils';
import { IGetThreadResponseSchema } from '../../lib/driver/types';
import { processEmailHtml } from '../../lib/email-processor';
import { env } from 'cloudflare:workers';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { toAttachmentFiles } from '../../lib/attachments';


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
        attachments: z
          .array(serializedFileSchema)
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
        scheduleAt: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {

      const { activeConnection, sessionUser } = ctx;
      const agent = await getZeroAgent(activeConnection.id);

      const {
        draftId,
        scheduleAt,
        attachments,
        ...mail
      } = input as typeof input & { scheduleAt?: string };

      const db = getZeroDB(sessionUser.id);
      const userSettings = await db.findUserSettings();
      const undoSendEnabled = userSettings?.settings?.undoSendEnabled ?? false;

      const shouldSchedule = !!scheduleAt || undoSendEnabled;

      const afterTask = async () => {
        try {
          console.warn('Saving writing style matrix...');
          await updateWritingStyleMatrix(activeConnection.id, input.message);
          console.warn('Saved writing style matrix.');
        } catch (error) {
          console.error('Failed to save writing style matrix', error);
        }
      };

      if (shouldSchedule) {
        const messageId = crypto.randomUUID();
        const targetTime = scheduleAt ? new Date(scheduleAt).getTime() : Date.now() + 30_000;
        const rawDelaySeconds = Math.floor((targetTime - Date.now()) / 1000);
        const maxQueueDelay = 43200; // 12 hours
        const isLongTerm = rawDelaySeconds > maxQueueDelay;
        
        const {
          pending_emails_status: statusKV,
          pending_emails_payload: payloadKV,
          scheduled_emails: scheduledKV,
          send_email_queue,
        } = env 

        try {
          await statusKV.put(messageId, 'pending', {
            expirationTtl: 60 * 60 * 24,
          });
        } catch (error) {
          console.error(`Failed to write pending status to KV for message ${messageId}`, error);
          return { success: false, error: 'Failed to schedule email status' } as const;
        }

        const mailPayload = {
          ...mail,
          draftId,
          attachments,
        };

        try {
          await payloadKV.put(
            messageId,
            JSON.stringify(mailPayload),
            { expirationTtl: 60 * 60 * 24 },
          );
        } catch (error) {
          console.error(`Failed to write email payload to KV for message ${messageId}`, error);
          return { success: false, error: 'Failed to schedule email payload' } as const;
        }

        if (isLongTerm) {
          try {
            await scheduledKV.put(
              messageId,
              JSON.stringify({
                messageId,
                connectionId: activeConnection.id,
                sendAt: targetTime,
              }),
              { expirationTtl: Math.ceil(rawDelaySeconds + 3600) }, // TTL slightly longer than needed
            );
          } catch (error) {
            console.error(`Failed to write long-term schedule to KV for message ${messageId}`, error);
            return { success: false, error: 'Failed to schedule email (long-term)' } as const;
          }
        } else {
          const delaySeconds = Math.max(0, rawDelaySeconds);
          const queueBody: IEmailSendBatch = {
            messageId,
            connectionId: activeConnection.id,
            sendAt: targetTime,
          };
          try {
            await send_email_queue.send(queueBody, { delaySeconds });
          } catch (error) {
            console.error(`Failed to enqueue email send for message ${messageId}`, error);
            return { success: false, error: 'Failed to enqueue email send' } as const;
          }
        }

        ctx.c.executionCtx.waitUntil(afterTask());

        return { success: true, queued: true, messageId, sendAt: targetTime };
      }

      const mailWithAttachments = {
        ...mail,
        attachments: attachments?.map((att: any) =>
          typeof att?.arrayBuffer === 'function' ? att : toAttachmentFiles([att])[0],
        ),
      } as typeof mail & { attachments: any[] };

      if (draftId) {
        await agent.sendDraft(draftId, mailWithAttachments);
      } else {
        await agent.create(mailWithAttachments);
      }

      ctx.c.executionCtx.waitUntil(afterTask());
      return { success: true };
    }),
  unsend: activeDriverProcedure
    .input(
      z.object({
        messageId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const { messageId } = input;
      const { 
        pending_emails_status: statusKV, 
        pending_emails_payload: payloadKV,
        scheduled_emails: scheduledKV,
      } = env;

      await statusKV.put(messageId, 'cancelled', {
        expirationTtl: 60 * 60,
      });

      await payloadKV.delete(messageId);
      await scheduledKV.delete(messageId); // Clean up long-term schedule if it exists

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
  processEmailContent: privateProcedure
    .input(
      z.object({
        html: z.string(),
        shouldLoadImages: z.boolean(),
        theme: z.enum(['light', 'dark']),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const { processedHtml, hasBlockedImages } = processEmailHtml({
          html: input.html,
          shouldLoadImages: input.shouldLoadImages,
          theme: input.theme,
        });

        return {
          processedHtml,
          hasBlockedImages,
        };
      } catch (error) {
        console.error('Error processing email content:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process email content',
        });
      }
    }),
});
