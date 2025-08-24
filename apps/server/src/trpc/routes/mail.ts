import {
  forceReSync,
  getThreadsFromDB,
  getZeroAgent,
  getZeroDB,
  getThread,
  modifyThreadLabelsInDB,
  deleteAllSpam,
  reSyncThread,
} from '../../lib/server-utils';
import {
  IGetThreadResponseSchema,
  IGetThreadsResponseSchema,
  type IGetThreadsResponse,
} from '../../lib/driver/types';
import { updateWritingStyleMatrix } from '../../services/writing-style-service';
import type { DeleteAllSpamResponse, IEmailSendBatch } from '../../types';
import { activeDriverProcedure, router, privateProcedure } from '../trpc';
import { processEmailHtml } from '../../lib/email-processor';
import { defaultPageSize, FOLDERS } from '../../lib/utils';
import { toAttachmentFiles } from '../../lib/attachments';
import { serializedFileSchema } from '../../lib/schemas';
import { getContext } from 'hono/context-storage';
import { type HonoContext } from '../../ctx';
import { TRPCError } from '@trpc/server';
import { env } from '../../env';
import { z } from 'zod';

const senderSchema = z.object({
  name: z.string().optional(),
  email: z.string(),
});

// const getFolderLabelId = (folder: string) => {
//   // Handle special cases first
//   if (folder === 'bin') return 'TRASH';
//   if (folder === 'archive') return ''; // Archive doesn't have a specific label

//   // For other folders, convert to uppercase (same as database method)
//   return folder.toUpperCase();
// };

export const mailRouter = router({
  suggestRecipients: activeDriverProcedure
    .input(
      z.object({
        query: z.string().optional().default(''),
        limit: z.number().optional().default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { activeConnection } = ctx;
      const executionCtx = getContext<HonoContext>().executionCtx;
      const { stub: agent } = await getZeroAgent(activeConnection.id, executionCtx);

      return await agent.suggestRecipients(input.query, input.limit);
    }),
  forceSync: activeDriverProcedure.mutation(async ({ ctx }) => {
    const { activeConnection } = ctx;
    return await forceReSync(activeConnection.id);
  }),
  get: activeDriverProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .output(IGetThreadResponseSchema)
    .query(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const result = await getThread(activeConnection.id, input.id);
      return result.result;
    }),
  listThreads: activeDriverProcedure
    .input(
      z.object({
        folder: z.string().optional().default('inbox'),
        q: z.string().optional().default(''),
        maxResults: z.number().optional().default(defaultPageSize),
        cursor: z.string().optional().default(''),
        labelIds: z.array(z.string()).optional().default([]),
      }),
    )
    .output(IGetThreadsResponseSchema)
    .query(async ({ ctx, input }) => {
      const { folder, maxResults, cursor, q, labelIds } = input;
      const { activeConnection } = ctx;
      const executionCtx = getContext<HonoContext>().executionCtx;
      const { stub: agent } = await getZeroAgent(activeConnection.id, executionCtx);

      console.debug('[listThreads] input:', { folder, maxResults, cursor, q, labelIds });

      if (folder === FOLDERS.DRAFT) {
        console.debug('[listThreads] Listing drafts');
        const drafts = await agent.listDrafts({
          q,
          maxResults,
          pageToken: cursor,
        });
        console.debug('[listThreads] Drafts result:', drafts);
        return drafts;
      }

      type ThreadItem = { id: string; historyId: string | null; $raw?: unknown };

      let threadsResponse: IGetThreadsResponse;

      // Apply folder-to-label mapping when no search query is provided
      const effectiveLabelIds = labelIds;

      if (q) {
        threadsResponse = await agent.rawListThreads({
          query: q,
          maxResults,
          labelIds: effectiveLabelIds,
          pageToken: cursor,
          folder,
        });
      } else {
        threadsResponse = await getThreadsFromDB(activeConnection.id, {
          folder,
          // query: q,
          maxResults,
          labelIds: effectiveLabelIds,
          pageToken: cursor,
        });
      }

      if (folder === FOLDERS.SNOOZED) {
        const nowTs = Date.now();
        const filtered: ThreadItem[] = [];

        console.debug('[listThreads] Filtering snoozed threads at', new Date(nowTs).toISOString());

        await Promise.all(
          threadsResponse.threads.map(async (t: ThreadItem) => {
            const keyName = `${t.id}__${activeConnection.id}`;
            try {
              const wakeAtIso = await env.snoozed_emails.get(keyName);
              if (!wakeAtIso) {
                filtered.push(t);
                return;
              }

              const wakeAt = new Date(wakeAtIso).getTime();
              if (wakeAt > nowTs) {
                filtered.push(t);
                return;
              }

              console.debug('[UNSNOOZE_ON_ACCESS] Expired thread', t.id, {
                wakeAtIso,
                now: new Date(nowTs).toISOString(),
              });

              await modifyThreadLabelsInDB(activeConnection.id, t.id, ['INBOX'], ['SNOOZED']);
              await env.snoozed_emails.delete(keyName);
            } catch (error) {
              console.error('[UNSNOOZE_ON_ACCESS] Failed for', t.id, error);
              filtered.push(t);
            }
          }),
        );

        threadsResponse.threads = filtered;
        console.debug('[listThreads] Snoozed threads after filtering:', filtered);
      }

      if (threadsResponse.threads.length === 0 && folder === FOLDERS.INBOX && !q) {
        const now = Date.now();
        const cooldownKey = `resync_cooldown_${activeConnection.id}`;
        const lastResyncStr = await env.gmail_processing_threads.get(cooldownKey);
        const lastResync = lastResyncStr ? parseInt(lastResyncStr, 10) : 0;
        const RESYNC_COOLDOWN_MS = 30000;

        if (now - lastResync > RESYNC_COOLDOWN_MS) {
          await env.gmail_processing_threads.put(cooldownKey, now.toString(), {
            expirationTtl: 60,
          });

          getZeroAgent(activeConnection.id, executionCtx)
            .then((_agent) => {
              _agent.stub.forceReSync().catch((error) => {
                console.error('[listThreads] Async resync failed:', error);
              });
            })
            .catch((error) => {
              console.error('[listThreads] Failed to get agent for async resync:', error);
            });
        }
      }

      console.debug('[listThreads] Returning threadsResponse:', threadsResponse);
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
      return Promise.all(
        input.ids.map((threadId) =>
          modifyThreadLabelsInDB(activeConnection.id, threadId, [], ['UNREAD']),
        ),
      );
    }),
  markAsUnread: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    // TODO: Add batching
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      return Promise.all(
        input.ids.map((threadId) =>
          modifyThreadLabelsInDB(activeConnection.id, threadId, ['UNREAD'], []),
        ),
      );
    }),
  markAsImportant: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      return Promise.all(
        input.ids.map((threadId) =>
          modifyThreadLabelsInDB(activeConnection.id, threadId, ['IMPORTANT'], []),
        ),
      );
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
      const executionCtx = getContext<HonoContext>().executionCtx;
      const { stub: agent } = await getZeroAgent(activeConnection.id, executionCtx);
      const { threadId, addLabels, removeLabels } = input;

      console.log(`Server: updateThreadLabels called for thread ${threadId}`);
      console.log(`Adding labels: ${addLabels.join(', ')}`);
      console.log(`Removing labels: ${removeLabels.join(', ')}`);

      const result = await agent.normalizeIds(threadId);
      const { threadIds } = result;

      if (threadIds.length) {
        await Promise.all(
          threadIds.map((threadId) =>
            modifyThreadLabelsInDB(activeConnection.id, threadId, addLabels, removeLabels),
          ),
        );
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
      const executionCtx = getContext<HonoContext>().executionCtx;
      const { stub: agent } = await getZeroAgent(activeConnection.id, executionCtx);
      const { threadIds } = await agent.normalizeIds(input.ids);

      if (!threadIds.length) {
        return { success: false, error: 'No thread IDs provided' };
      }

      const threadResults = await Promise.allSettled(
        threadIds.map(async (id: string) => {
          const thread = await getThread(activeConnection.id, id);
          return thread.result;
        }),
      );

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

      await Promise.all(
        threadIds.map((threadId) =>
          modifyThreadLabelsInDB(
            activeConnection.id,
            threadId,
            shouldStar ? ['STARRED'] : [],
            shouldStar ? [] : ['STARRED'],
          ),
        ),
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
      const executionCtx = getContext<HonoContext>().executionCtx;
      const { stub: agent } = await getZeroAgent(activeConnection.id, executionCtx);
      const { threadIds } = await agent.normalizeIds(input.ids);

      if (!threadIds.length) {
        return { success: false, error: 'No thread IDs provided' };
      }

      const threadResults = await Promise.allSettled(
        threadIds.map(async (id: string) => {
          const thread = await getThread(activeConnection.id, id);
          return thread.result;
        }),
      );

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

      await Promise.all(
        threadIds.map((threadId) =>
          modifyThreadLabelsInDB(
            activeConnection.id,
            threadId,
            shouldMarkImportant ? ['IMPORTANT'] : [],
            shouldMarkImportant ? [] : ['IMPORTANT'],
          ),
        ),
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
      return Promise.all(
        input.ids.map((threadId) =>
          modifyThreadLabelsInDB(activeConnection.id, threadId, ['STARRED'], []),
        ),
      );
    }),
  bulkMarkImportant: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      return Promise.all(
        input.ids.map((threadId) =>
          modifyThreadLabelsInDB(activeConnection.id, threadId, ['IMPORTANT'], []),
        ),
      );
    }),
  bulkUnstar: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      return Promise.all(
        input.ids.map((threadId) =>
          modifyThreadLabelsInDB(activeConnection.id, threadId, [], ['STARRED']),
        ),
      );
    }),
  deleteAllSpam: activeDriverProcedure.mutation(async ({ ctx }): Promise<DeleteAllSpamResponse> => {
    const { activeConnection } = ctx;
    try {
      const result = await deleteAllSpam(activeConnection.id);
      return {
        success: true,
        message: `Spam emails deleted ${result.deletedCount} threads`,
        count: result.deletedCount,
      };
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
      return Promise.all(
        input.ids.map((threadId) =>
          modifyThreadLabelsInDB(activeConnection.id, threadId, [], ['IMPORTANT']),
        ),
      );
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
        scheduleAt: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { activeConnection, sessionUser } = ctx;
      const executionCtx = getContext<HonoContext>().executionCtx;
      const agent = await getZeroAgent(activeConnection.id, executionCtx);

      const { draftId, scheduleAt, attachments, ...mail } = input as typeof input & {
        scheduleAt?: string;
      };

      const db = await getZeroDB(sessionUser.id);
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

        // Validate scheduleAt if provided
        let targetTime: number;
        if (scheduleAt) {
          const parsedTime = Date.parse(scheduleAt);
          if (isNaN(parsedTime)) {
            return { success: false, error: 'Invalid schedule date format' } as const;
          }

          const now = Date.now();

          if (parsedTime <= now) {
            return { success: false, error: 'Schedule time must be in the future' } as const;
          }

          targetTime = parsedTime;
        } else {
          targetTime = Date.now() + 15_000;
        }

        const rawDelaySeconds = Math.floor((targetTime - Date.now()) / 1000);
        const maxQueueDelay = 43200; // 12 hours
        const isLongTerm = rawDelaySeconds > maxQueueDelay;

        const {
          pending_emails_status: statusKV,
          pending_emails_payload: payloadKV,
          scheduled_emails: scheduledKV,
          send_email_queue,
        } = env;

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
          connectionId: activeConnection.id,
        };

        try {
          await payloadKV.put(messageId, JSON.stringify(mailPayload), {
            expirationTtl: 60 * 60 * 24,
          });
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
              { expirationTtl: Math.min(Math.ceil(rawDelaySeconds + 3600), 31556952) },
            );
          } catch (error) {
            console.error(
              `Failed to write long-term schedule to KV for message ${messageId}`,
              error,
            );
            return { success: false, error: 'Failed to schedule email (long-term)' } as const;
          }
        } else {
          const delaySeconds = rawDelaySeconds;
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

        if (isLongTerm) {
          return { success: true, scheduled: true, messageId, sendAt: targetTime };
        } else {
          return { success: true, queued: true, messageId, sendAt: targetTime };
        }
      }

      const mailWithAttachments = {
        ...mail,
        attachments: attachments?.map((att: any) =>
          typeof att?.arrayBuffer === 'function' ? att : toAttachmentFiles([att])[0],
        ),
      } as typeof mail & { attachments: any[] };

      if (draftId) {
        await agent.stub.sendDraft(draftId, mailWithAttachments);
      } else {
        await agent.stub.create(mailWithAttachments);
      }

      console.log('[send] input.threadId:', input);

      if (input.threadId)
        ctx.c.executionCtx.waitUntil(reSyncThread(activeConnection.id, input.threadId));
      ctx.c.executionCtx.waitUntil(afterTask());
      return { success: true };
    }),
  unsend: activeDriverProcedure
    .input(
      z.object({
        messageId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { messageId } = input;
      const { activeConnection } = ctx;
      const {
        pending_emails_status: statusKV,
        pending_emails_payload: payloadKV,
        scheduled_emails: scheduledKV,
      } = env;

      const scheduledData = await scheduledKV.get(messageId);
      if (scheduledData) {
        try {
          const { connectionId } = JSON.parse(scheduledData);
          if (connectionId !== activeConnection.id) {
            return {
              success: false,
              error: "Unauthorized: Cannot cancel another user's scheduled email",
            } as const;
          }
        } catch (error) {
          console.error('Failed to parse scheduled data for ownership verification:', error);
          return { success: false, error: 'Invalid scheduled email data' } as const;
        }
      }

      const payloadData = await payloadKV.get(messageId);
      if (payloadData) {
        try {
          const payload = JSON.parse(payloadData);
          if (payload.connectionId && payload.connectionId !== activeConnection.id) {
            return {
              success: false,
              error: "Unauthorized: Cannot cancel another user's queued email",
            } as const;
          }
        } catch (error) {
          console.error('Failed to parse payload data:', error);
          return { success: false, error: 'Invalid payload data' } as const;
        }
      }

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
      const executionCtx = getContext<HonoContext>().executionCtx;
      const { exec, stub } = await getZeroAgent(activeConnection.id, executionCtx);
      exec(`DELETE FROM threads WHERE thread_id = ?`, input.id);
      await stub.reloadFolder('bin');
      return true;
    }),
  bulkDelete: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      return Promise.all(
        input.ids.map((threadId) =>
          modifyThreadLabelsInDB(activeConnection.id, threadId, ['TRASH'], []),
        ),
      );
    }),
  bulkArchive: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      return Promise.all(
        input.ids.map((threadId) =>
          modifyThreadLabelsInDB(activeConnection.id, threadId, [], ['INBOX']),
        ),
      );
    }),
  bulkMute: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      return Promise.all(
        input.ids.map((threadId) =>
          modifyThreadLabelsInDB(activeConnection.id, threadId, ['MUTE'], []),
        ),
      );
    }),
  getEmailAliases: activeDriverProcedure.query(async ({ ctx }) => {
    const { activeConnection } = ctx;
    const executionCtx = getContext<HonoContext>().executionCtx;
    const { stub: agent } = await getZeroAgent(activeConnection.id, executionCtx);
    return agent.getEmailAliases();
  }),
  snoozeThreads: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
        wakeAt: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      if (!input.ids.length) {
        return { success: false, error: 'No thread IDs provided' };
      }

      const wakeAtDate = new Date(input.wakeAt);
      if (wakeAtDate <= new Date()) {
        return { success: false, error: 'Snooze time must be in the future' };
      }

      await Promise.all(
        input.ids.map((threadId) =>
          modifyThreadLabelsInDB(activeConnection.id, threadId, ['SNOOZED'], ['INBOX']),
        ),
      );

      const wakeAtIso = wakeAtDate.toISOString();
      await Promise.all(
        input.ids.map((threadId) =>
          env.snoozed_emails.put(`${threadId}__${activeConnection.id}`, wakeAtIso, {
            metadata: { wakeAt: wakeAtIso },
          }),
        ),
      );

      return { success: true };
    }),
  unsnoozeThreads: activeDriverProcedure
    .input(
      z.object({
        ids: z.array(z.string()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      if (!input.ids.length) return { success: false, error: 'No thread IDs' };
      await Promise.all(
        input.ids.map((threadId) =>
          modifyThreadLabelsInDB(activeConnection.id, threadId, ['INBOX'], ['SNOOZED']),
        ),
      );
      await Promise.all(
        input.ids.map((threadId) =>
          env.snoozed_emails.delete(`${threadId}__${activeConnection.id}`),
        ),
      );
      return { success: true };
    }),
  getMessageAttachments: activeDriverProcedure
    .input(
      z.object({
        messageId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { activeConnection } = ctx;
      const executionCtx = getContext<HonoContext>().executionCtx;
      const { stub: agent } = await getZeroAgent(activeConnection.id, executionCtx);
      return agent.getMessageAttachments(input.messageId) as Promise<
        {
          filename: string;
          mimeType: string;
          size: number;
          attachmentId: string;
          headers: {
            name: string;
            value: string;
          }[];
          body: string;
        }[]
      >;
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
