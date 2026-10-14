import {
  IGetThreadResponseSchema,
  IGetThreadsResponseSchema,
  type IGetThreadsResponse,
} from '../../lib/driver/types';
import { updateWritingStyleMatrix } from '../../services/writing-style-service';
import { activeDriverProcedure, router, privateProcedure } from '../trpc';
import { pickForwardedAttachments } from '../../lib/forward-attachments';
import { getGmailQuotaGovernor } from '../../lib/gmail-quota-client';
import { isConnectionActive } from '../../lib/connection-status';
import { getZeroAgent, getZeroDB } from '../../lib/server-utils';
import { processEmailHtml } from '../../lib/email-processor';
import { defaultPageSize, FOLDERS } from '../../lib/utils';
import { isAiEnabledForUser } from '../../lib/ai-access';
import { serializedFileSchema } from '../../lib/schemas';
import type { DeleteAllSpamResponse } from '../../types';
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
  syncStatus: activeDriverProcedure.query(async ({ ctx }) => {
    const agent = await getZeroAgent(ctx.activeConnection.id);
    const progress = await agent.syncProgress();
    const quota =
      ctx.activeConnection.providerId === 'google'
        ? await getGmailQuotaGovernor().status(ctx.activeConnection.email.trim().toLowerCase())
        : null;
    return { ...progress, quota };
  }),
  labelSyncStatus: activeDriverProcedure.query(async ({ ctx }) => {
    const agent = await getZeroAgent(ctx.activeConnection.id);
    return agent.labelSyncStatus();
  }),
  retryLabelSync: activeDriverProcedure.mutation(async ({ ctx }) => {
    const agent = await getZeroAgent(ctx.activeConnection.id);
    await agent.retryLabelSync();
    return { queued: true };
  }),
  mailboxSyncStatus: activeDriverProcedure.query(async ({ ctx }) => {
    const agent = await getZeroAgent(ctx.activeConnection.id);
    return agent.mailboxSyncStatus();
  }),
  retryMailboxSync: activeDriverProcedure.mutation(async ({ ctx }) => {
    const agent = await getZeroAgent(ctx.activeConnection.id);
    await agent.retryMailboxSync();
    return { queued: true };
  }),
  unreadSyncStatus: activeDriverProcedure.query(async ({ ctx }) => {
    const agent = await getZeroAgent(ctx.activeConnection.id);
    return agent.unreadSyncStatus();
  }),
  retryUnreadSync: activeDriverProcedure.mutation(async ({ ctx }) => {
    const agent = await getZeroAgent(ctx.activeConnection.id);
    await agent.retryUnreadSync();
    return { queued: true };
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
      const agent = await getZeroAgent(activeConnection.id);
      return await agent.getThread(input.id, true);
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
        maxResults: z.number().optional().default(defaultPageSize),
        cursor: z.string().optional().default(''),
        labelIds: z.array(z.string()).optional().default([]),
      }),
    )
    .output(IGetThreadsResponseSchema)
    .query(async ({ ctx, input }) => {
      const { folder, maxResults, cursor, q, labelIds } = input;
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);

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
        threadsResponse = await agent.listThreads({
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

              await agent.modifyLabels([t.id], ['INBOX'], ['SNOOZED']);
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

      // Row data for the whole page in one round trip (see ThreadListSummarySchema). Without
      // it every visible list row fetches its full thread via mail.get.
      let summaries: Awaited<ReturnType<typeof agent.getThreadListSummaries>> = [];
      try {
        summaries = await agent.getThreadListSummaries(threadsResponse.threads.map((t) => t.id));
      } catch (error) {
        console.warn('[listThreads] Failed to load row summaries', error);
      }
      threadsResponse = {
        ...threadsResponse,
        threads: threadsResponse.threads.map((thread, i) => ({
          ...thread,
          summary: summaries[i] ?? null,
        })),
      };

      // Counts only: the response now carries subjects/senders/snippets, which must not hit logs.
      console.debug('[listThreads] Returning', {
        threads: threadsResponse.threads.length,
        withSummary: threadsResponse.threads.filter((t) => t.summary).length,
        hasNextPage: !!threadsResponse.nextPageToken,
      });
      return threadsResponse;
    }),
  /**
   * Inbox threads across every connected account, merged newest-first.
   *
   * Each account's thread store pages by `latest_received_on < cursor` (an ISO timestamp), so
   * one shared timestamp cursor pages all accounts consistently: fetch a page per account
   * older than the cursor, merge, keep the newest `maxResults`, and hand back the oldest kept
   * timestamp as the next cursor. Accounts that fail (e.g. need reauthorization) are skipped
   * and reported in `failedConnectionIds` instead of failing the whole page.
   */
  listUnifiedInbox: privateProcedure
    .input(
      z.object({
        maxResults: z.number().int().min(1).max(50).optional().default(defaultPageSize),
        cursor: z.string().optional().default(''),
      }),
    )
    .output(
      z.object({
        threads: z.array(
          IGetThreadsResponseSchema.shape.threads.element.extend({ connectionId: z.string() }),
        ),
        connections: z.array(
          z.object({
            id: z.string(),
            email: z.string(),
            name: z.string().nullable(),
            picture: z.string().nullable(),
            providerId: z.string(),
          }),
        ),
        failedConnectionIds: z.array(z.string()),
        nextPageToken: z.string().nullable(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { maxResults, cursor } = input;
      const db = await getZeroDB(ctx.sessionUser.id);
      const allConnections = await db.findManyConnections();
      const connections = allConnections.filter(isConnectionActive);

      const fallbackKey = cursor || new Date().toISOString();
      const results = await Promise.allSettled(
        connections.map(async (connection) => {
          const agent = await getZeroAgent(connection.id);
          const page = await agent.listThreads({
            folder: FOLDERS.INBOX,
            maxResults,
            pageToken: cursor,
          });
          let summaries: Awaited<ReturnType<typeof agent.getThreadListSummaries>> = [];
          try {
            summaries = await agent.getThreadListSummaries(page.threads.map((t) => t.id));
          } catch (error) {
            console.warn('[listUnifiedInbox] Failed to load row summaries', connection.id, error);
          }
          // Threads arrive sorted newest-first; a thread without a summary inherits its
          // predecessor's timestamp so it keeps its place in the merged order.
          let previousKey = fallbackKey;
          const threads = page.threads.map((thread, i) => {
            const summary = summaries[i] ?? null;
            const receivedOn = summary?.latest?.receivedOn;
            const parsed = receivedOn ? new Date(receivedOn) : null;
            const sortKey =
              parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : previousKey;
            previousKey = sortKey;
            return { ...thread, summary, connectionId: connection.id, sortKey };
          });
          return { threads, hasMore: !!page.nextPageToken };
        }),
      );

      const failedConnectionIds = allConnections
        .filter((c) => !isConnectionActive(c))
        .map((c) => c.id);
      const merged: (IGetThreadsResponse['threads'][number] & {
        connectionId: string;
        sortKey: string;
      })[] = [];
      let anyHasMore = false;
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          merged.push(...result.value.threads);
          anyHasMore ||= result.value.hasMore;
        } else {
          console.warn('[listUnifiedInbox] Connection failed', connections[i].id, result.reason);
          failedConnectionIds.push(connections[i].id);
        }
      });

      merged.sort((a, b) => (a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0));
      const page = merged.slice(0, maxResults);
      const hasMore = anyHasMore || merged.length > page.length;
      const nextPageToken = hasMore && page.length > 0 ? page[page.length - 1].sortKey : null;

      return {
        threads: page.map(({ sortKey: _sortKey, ...thread }) => thread),
        connections: allConnections.map((c) => ({
          id: c.id,
          email: c.email,
          name: c.name ?? null,
          picture: c.picture ?? null,
          providerId: c.providerId,
        })),
        failedConnectionIds,
        nextPageToken,
      };
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
        return { success: true };
      }

      console.log('Server: No label changes specified');
      return { success: false, error: 'No label changes specified' };
    }),

  toggleStar: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
        starred: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      const { threadIds } = await agent.normalizeIds(input.ids);

      if (!threadIds.length) {
        return { success: false, error: 'No thread IDs provided' };
      }

      return agent.setThreadsStarred(threadIds, input.starred);
    }),
  toggleImportant: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
        important: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      const { threadIds } = await agent.normalizeIds(input.ids);

      if (!threadIds.length) {
        return { success: false, error: 'No thread IDs provided' };
      }

      return agent.setThreadsImportant(threadIds, input.important);
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
        replyToMessageId: z.string().optional(),
        /** Original attachments to carry over on a forward, matched by file name and size. */
        forwardAttachments: z
          .array(z.object({ filename: z.string(), size: z.number().optional() }))
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      const { draftId, forwardAttachments, ...mail } = input;

      if (mail.isForward && mail.replyToMessageId && forwardAttachments?.length) {
        const original = await agent.getMessageAttachments(mail.replyToMessageId);
        const carried = pickForwardedAttachments(original ?? [], forwardAttachments);
        if (carried.length < forwardAttachments.length) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Some attachments of the original message could not be loaded',
          });
        }
        mail.attachments = [
          ...mail.attachments,
          ...carried.map((a) => ({
            name: a.filename,
            type: a.mimeType || 'application/octet-stream',
            size: a.size,
            lastModified: Date.now(),
            base64: a.body,
          })),
        ];
      }

      const afterTask = async () => {
        try {
          // Learning the writing style is an AI call; skip it when AI is off.
          if (!(await isAiEnabledForUser(ctx.sessionUser.id))) return;
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
        await agent.create(mail);
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
      return agent.bulkDelete(input.ids);
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
  snoozeThreads: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
        wakeAt: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);

      if (!input.ids.length) {
        return { success: false, error: 'No thread IDs provided' };
      }

      const wakeAtDate = new Date(input.wakeAt);
      if (wakeAtDate <= new Date()) {
        return { success: false, error: 'Snooze time must be in the future' };
      }

      await agent.modifyLabels(input.ids, ['SNOOZED'], ['INBOX']);

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
        ids: z.array(z.string().min(1)).nonempty(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      if (!input.ids.length) return { success: false, error: 'No thread IDs' };
      await agent.modifyLabels(input.ids, ['INBOX'], ['SNOOZED']);

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
      const agent = await getZeroAgent(activeConnection.id);
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
