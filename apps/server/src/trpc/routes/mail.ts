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
import {
  actionItem,
  actionSuggestion,
  analysisResult,
  category,
  email as emailTable,
  feedbackData,
  mailbox,
  priorityScore as priorityScoreTable,
  userProfile,
} from '../../db/schema';
import { createOpenAI } from '@ai-sdk/openai';
import { createDb } from '../../db';
import { updateWritingStyleMatrix } from '../../services/writing-style-service';
import type { DeleteAllSpamResponse, IEmailSendBatch } from '../../types';
import { activeDriverProcedure, router, privateProcedure } from '../trpc';
import { enrichThreadWithActionSuggestions } from '../../lib/doorman/enrich-action-suggestions';
import { enrichThreadWithCategories } from '../../lib/doorman/enrich-categories';
import { enrichThreadWithPriorityScores } from '../../lib/doorman/enrich-priority-scores';
import { generateObject } from 'ai';
import { processEmailHtml } from '../../lib/email-processor';
import { defaultPageSize, FOLDERS } from '../../lib/utils';
import { toAttachmentFiles } from '../../lib/attachments';
import { serializedFileSchema } from '../../lib/schemas';
import { getContext } from 'hono/context-storage';
import { type HonoContext } from '../../ctx';
import { TRPCError } from '@trpc/server';
import { env } from '../../env';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const senderSchema = z.object({
  name: z.string().optional(),
  email: z.string(),
});

const reanalysisSchema = z.object({
  category: z.string(),
  priority_score: z.number(),
  action: z.string(),
  reason: z.string().optional(),
});

const disposeRpc = (target: unknown) => {
  const disposable = target as {
    [Symbol.dispose]?: () => void;
    dispose?: () => void;
  };

  disposable[Symbol.dispose]?.();
  disposable.dispose?.();
};

// const getFolderLabelId = (folder: string) => {
//   // Handle special cases first
//   if (folder === 'bin') return 'TRASH';
//   if (folder === 'archive') return ''; // Archive doesn't have a specific label

//   // For other folders, convert to uppercase (same as database method)
//   return folder.toUpperCase();
// };

export const mailRouter = router({
  submitFeedback: privateProcedure
    .input(
      z.object({
        message: z.string().min(1).max(5000),
        source: z.string().optional().default('feedback-page'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const feedbackEvent = {
        type: 'user_feedback',
        source: input.source,
        message: input.message,
        userId: ctx.sessionUser?.id,
        timestamp: new Date().toISOString(),
      };

      console.info('[feedback] received', feedbackEvent);

      return { success: true };
    }),
  submitClassificationCorrection: activeDriverProcedure
    .input(
      z.object({
        threadId: z.string().min(1),
        messageId: z.string().min(1),
        correctedPriority: z.enum(['low', 'high']),
        currentPriorityScore: z.number().min(0).max(100).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const databaseUrl = env.HYPERDRIVE?.connectionString || env.DATABASE_URL;
      if (!databaseUrl) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database connection not configured',
        });
      }

      if (!env.OPENAI_API_KEY) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'OPENAI_API_KEY not configured',
        });
      }

      const { db, conn } = createDb(databaseUrl);

      try {
        const [targetEmail] = await db
          .select({
            emailId: emailTable.emailId,
            userId: mailbox.userId,
            subject: emailTable.subject,
            body: emailTable.body,
            sender: emailTable.sender,
            receiver: emailTable.receiver,
            metadata: emailTable.metadata,
          })
          .from(emailTable)
          .innerJoin(mailbox, eq(emailTable.mailboxId, mailbox.mailboxId))
          .where(
            and(
              eq(emailTable.emailId, input.messageId),
              eq(emailTable.mailboxId, `inbox:${ctx.activeConnection.id}`),
            ),
          )
          .limit(1);

        if (!targetEmail) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Email not found for this connection',
          });
        }

        const [profile] = await db
          .select()
          .from(userProfile)
          .where(eq(userProfile.userId, targetEmail.userId))
          .limit(1);

        const profileCategories = await db
          .select()
          .from(category)
          .where(and(eq(category.userId, targetEmail.userId), eq(category.enabled, true)));

        const profileActions = await db
          .select()
          .from(actionItem)
          .where(and(eq(actionItem.userId, targetEmail.userId), eq(actionItem.enabled, true)));

        const allowedCategories =
          profileCategories.length > 0
            ? profileCategories.map((item) => item.categoryName)
            : ['academic', 'seminar', 'event', 'survey', 'advertisement', 'spam', 'uncategorized'];

        const allowedActions =
          profileActions.length > 0
            ? profileActions.map((item) => item.name)
            : ['forwarding', 'replying', 'mark at calendar', 'revise later', 'ignore', 'No action needed'];

        const cleanedSubject = String(targetEmail.subject ?? '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 300);
        const cleanedBody = String(targetEmail.body ?? '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 6000);

        const priorityBandInstruction =
          input.correctedPriority === 'low'
            ? 'User says previous classification was TOO HIGH. Keep priority_score in low range (0-49) unless email clearly proves otherwise.'
            : 'User says previous classification was TOO LOW. Keep priority_score in high range (50-100) unless email clearly proves otherwise.';

        const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
        const { object } = await generateObject({
          model: openai(env.OPENAI_MODEL || 'gpt-4o-mini'),
          schema: reanalysisSchema,
          output: 'object',
          system:
            'Analyze the email and return category, priority_score, action, and reason as JSON. ' +
            'Use only provided categories/actions and do not hallucinate details. ' +
            'Priority score rubric: sender importance up to 30, content importance up to 40, deadline urgency up to 30. ' +
            `Correction feedback to honor: ${priorityBandInstruction}`,
          prompt: JSON.stringify({
            email: {
              subject: cleanedSubject,
              body: cleanedBody,
              sender: targetEmail.sender ?? '',
              receiver: targetEmail.receiver ?? '',
              metadata: targetEmail.metadata ?? {},
            },
            user_profile: {
              user_type: profile?.userType ?? '',
              interests: profile?.interest ?? [],
              affiliations: profile?.affiliation ?? [],
              important_contacts: profile?.importantContacts ?? [],
            },
            allowed: {
              categories: allowedCategories,
              actions: allowedActions,
            },
            correction_feedback: {
              corrected_priority: input.correctedPriority,
              previous_priority_score: input.currentPriorityScore ?? null,
            },
          }),
        });

        const categoryByLower = new Map(allowedCategories.map((name) => [name.toLowerCase(), name]));
        const actionByLower = new Map(allowedActions.map((name) => [name.toLowerCase(), name]));

        const normalizedCategory =
          categoryByLower.get(String(object.category ?? '').trim().toLowerCase()) ?? 'uncategorized';
        const normalizedAction =
          actionByLower.get(String(object.action ?? '').trim().toLowerCase()) ?? 'No action needed';

        const rawScore = Number(object.priority_score ?? 0);
        let normalizedScore = Number.isFinite(rawScore)
          ? Math.max(0, Math.min(100, Math.round(rawScore)))
          : 0;

        if (input.correctedPriority === 'low') {
          normalizedScore = Math.min(normalizedScore, 49);
        } else {
          normalizedScore = Math.max(normalizedScore, 50);
        }

        const normalizedReason =
          String(object.reason ?? '').trim() ||
          `Regenerated from LLM using ${input.correctedPriority} correction feedback.`;

        const matchedCategory = profileCategories.find(
          (item) => item.categoryName.toLowerCase() === normalizedCategory.toLowerCase(),
        );
        const matchedAction = profileActions.find(
          (item) => item.name.toLowerCase() === normalizedAction.toLowerCase(),
        );

        const [existingAnalysis] = await db
          .select({ id: analysisResult.id })
          .from(analysisResult)
          .where(eq(analysisResult.emailId, input.messageId))
          .limit(1);

        const analysisId = existingAnalysis?.id ?? crypto.randomUUID();

        if (existingAnalysis) {
          await db
            .update(analysisResult)
            .set({
              categoryId: matchedCategory?.categoryId ?? null,
              category: normalizedCategory,
              priorityScore: normalizedScore,
              suggestedActions: normalizedAction,
              reason: normalizedReason,
              source: 'llm-feedback',
              rawResult: {
                ...object,
                correction_feedback: {
                  corrected_priority: input.correctedPriority,
                  previous_priority_score: input.currentPriorityScore ?? null,
                },
              },
              hallucinationChecked: true,
              analyzedAt: new Date(),
            })
            .where(eq(analysisResult.id, analysisId));
        } else {
          await db.insert(analysisResult).values({
            id: analysisId,
            userId: targetEmail.userId,
            emailId: input.messageId,
            categoryId: matchedCategory?.categoryId ?? null,
            category: normalizedCategory,
            priorityScore: normalizedScore,
            suggestedActions: normalizedAction,
            reason: normalizedReason,
            source: 'llm-feedback',
            rawResult: {
              ...object,
              correction_feedback: {
                corrected_priority: input.correctedPriority,
                previous_priority_score: input.currentPriorityScore ?? null,
              },
            },
            hallucinationChecked: true,
            analyzedAt: new Date(),
          });
        }

        await db
          .update(emailTable)
          .set({
            categoryId: matchedCategory?.categoryId ?? null,
            priorityScore: normalizedScore,
          })
          .where(eq(emailTable.emailId, input.messageId));

        await db.delete(priorityScoreTable).where(eq(priorityScoreTable.emailId, input.messageId));
        await db.insert(priorityScoreTable).values({
          id: crypto.randomUUID(),
          analysisId,
          emailId: input.messageId,
          score: normalizedScore,
        });

        await db.delete(actionSuggestion).where(eq(actionSuggestion.emailId, input.messageId));
        await db.insert(actionSuggestion).values({
          id: crypto.randomUUID(),
          analysisId,
          emailId: input.messageId,
          actionItemId: matchedAction?.actionItemId ?? null,
          actionLabel: normalizedAction,
          reason: normalizedReason,
        });

        await db.insert(feedbackData).values({
          id: crypto.randomUUID(),
          userId: targetEmail.userId,
          analysisId,
          emailId: input.messageId,
          targetType: 'priority_score',
          rating: input.correctedPriority,
          createdAt: new Date(),
        });

        return {
          success: true,
          refreshed: {
            category: normalizedCategory,
            priorityScore: normalizedScore,
            suggestedAction: normalizedAction,
            reason: normalizedReason,
          },
        };
      } finally {
        await conn.end();
      }
    }),
  submitActionSuggestionFeedback: activeDriverProcedure
    .input(
      z.object({
        threadId: z.string().min(1),
        messageId: z.string().min(1),
        feedbackMessage: z.string().min(1).max(1500),
        currentSuggestedAction: z.string().optional(),
        currentPriorityScore: z.number().min(0).max(100).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const databaseUrl = env.HYPERDRIVE?.connectionString || env.DATABASE_URL;
      if (!databaseUrl) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database connection not configured',
        });
      }

      if (!env.OPENAI_API_KEY) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'OPENAI_API_KEY not configured',
        });
      }

      const { db, conn } = createDb(databaseUrl);

      try {
        const [targetEmail] = await db
          .select({
            emailId: emailTable.emailId,
            userId: mailbox.userId,
            subject: emailTable.subject,
            body: emailTable.body,
            sender: emailTable.sender,
            receiver: emailTable.receiver,
            metadata: emailTable.metadata,
          })
          .from(emailTable)
          .innerJoin(mailbox, eq(emailTable.mailboxId, mailbox.mailboxId))
          .where(
            and(
              eq(emailTable.emailId, input.messageId),
              eq(emailTable.mailboxId, `inbox:${ctx.activeConnection.id}`),
            ),
          )
          .limit(1);

        if (!targetEmail) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Email not found for this connection',
          });
        }

        const [profile] = await db
          .select()
          .from(userProfile)
          .where(eq(userProfile.userId, targetEmail.userId))
          .limit(1);

        const profileCategories = await db
          .select()
          .from(category)
          .where(and(eq(category.userId, targetEmail.userId), eq(category.enabled, true)));

        const profileActions = await db
          .select()
          .from(actionItem)
          .where(and(eq(actionItem.userId, targetEmail.userId), eq(actionItem.enabled, true)));

        const allowedCategories =
          profileCategories.length > 0
            ? profileCategories.map((item) => item.categoryName)
            : ['academic', 'seminar', 'event', 'survey', 'advertisement', 'spam', 'uncategorized'];

        const allowedActions =
          profileActions.length > 0
            ? profileActions.map((item) => item.name)
            : ['forwarding', 'replying', 'mark at calendar', 'revise later', 'ignore', 'No action needed'];

        const cleanedSubject = String(targetEmail.subject ?? '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 300);
        const cleanedBody = String(targetEmail.body ?? '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 6000);

        const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
        const { object } = await generateObject({
          model: openai(env.OPENAI_MODEL || 'gpt-4o-mini'),
          schema: reanalysisSchema,
          output: 'object',
          system:
            'Analyze the email and return category, priority_score, action, and reason as JSON. ' +
            'Use only provided categories/actions and do not hallucinate details. ' +
            'Priority score rubric: sender importance up to 30, content importance up to 40, deadline urgency up to 30. ' +
            'You are receiving a user feedback message about the suggested action. Treat that feedback as high-priority guidance and improve the action suggestion accordingly while staying grounded in the email content.',
          prompt: JSON.stringify({
            email: {
              subject: cleanedSubject,
              body: cleanedBody,
              sender: targetEmail.sender ?? '',
              receiver: targetEmail.receiver ?? '',
              metadata: targetEmail.metadata ?? {},
            },
            user_profile: {
              user_type: profile?.userType ?? '',
              interests: profile?.interest ?? [],
              affiliations: profile?.affiliation ?? [],
              important_contacts: profile?.importantContacts ?? [],
            },
            allowed: {
              categories: allowedCategories,
              actions: allowedActions,
            },
            action_feedback: {
              feedback_message: input.feedbackMessage,
              current_suggested_action: input.currentSuggestedAction ?? null,
              current_priority_score: input.currentPriorityScore ?? null,
            },
          }),
        });

        const categoryByLower = new Map(allowedCategories.map((name) => [name.toLowerCase(), name]));
        const actionByLower = new Map(allowedActions.map((name) => [name.toLowerCase(), name]));

        const normalizedCategory =
          categoryByLower.get(String(object.category ?? '').trim().toLowerCase()) ?? 'uncategorized';
        const normalizedAction =
          actionByLower.get(String(object.action ?? '').trim().toLowerCase()) ?? 'No action needed';

        const rawScore = Number(object.priority_score ?? 0);
        const normalizedScore = Number.isFinite(rawScore)
          ? Math.max(0, Math.min(100, Math.round(rawScore)))
          : 0;

        const normalizedReason =
          String(object.reason ?? '').trim() ||
          'Regenerated from LLM using action suggestion feedback.';

        const matchedCategory = profileCategories.find(
          (item) => item.categoryName.toLowerCase() === normalizedCategory.toLowerCase(),
        );
        const matchedAction = profileActions.find(
          (item) => item.name.toLowerCase() === normalizedAction.toLowerCase(),
        );

        const [existingAnalysis] = await db
          .select({ id: analysisResult.id })
          .from(analysisResult)
          .where(eq(analysisResult.emailId, input.messageId))
          .limit(1);

        const analysisId = existingAnalysis?.id ?? crypto.randomUUID();

        if (existingAnalysis) {
          await db
            .update(analysisResult)
            .set({
              categoryId: matchedCategory?.categoryId ?? null,
              category: normalizedCategory,
              priorityScore: normalizedScore,
              suggestedActions: normalizedAction,
              reason: normalizedReason,
              source: 'llm-feedback-action',
              rawResult: {
                ...object,
                action_feedback: {
                  feedback_message: input.feedbackMessage,
                  current_suggested_action: input.currentSuggestedAction ?? null,
                  current_priority_score: input.currentPriorityScore ?? null,
                },
              },
              hallucinationChecked: true,
              analyzedAt: new Date(),
            })
            .where(eq(analysisResult.id, analysisId));
        } else {
          await db.insert(analysisResult).values({
            id: analysisId,
            userId: targetEmail.userId,
            emailId: input.messageId,
            categoryId: matchedCategory?.categoryId ?? null,
            category: normalizedCategory,
            priorityScore: normalizedScore,
            suggestedActions: normalizedAction,
            reason: normalizedReason,
            source: 'llm-feedback-action',
            rawResult: {
              ...object,
              action_feedback: {
                feedback_message: input.feedbackMessage,
                current_suggested_action: input.currentSuggestedAction ?? null,
                current_priority_score: input.currentPriorityScore ?? null,
              },
            },
            hallucinationChecked: true,
            analyzedAt: new Date(),
          });
        }

        await db
          .update(emailTable)
          .set({
            categoryId: matchedCategory?.categoryId ?? null,
            priorityScore: normalizedScore,
          })
          .where(eq(emailTable.emailId, input.messageId));

        await db.delete(priorityScoreTable).where(eq(priorityScoreTable.emailId, input.messageId));
        await db.insert(priorityScoreTable).values({
          id: crypto.randomUUID(),
          analysisId,
          emailId: input.messageId,
          score: normalizedScore,
        });

        await db.delete(actionSuggestion).where(eq(actionSuggestion.emailId, input.messageId));
        await db.insert(actionSuggestion).values({
          id: crypto.randomUUID(),
          analysisId,
          emailId: input.messageId,
          actionItemId: matchedAction?.actionItemId ?? null,
          actionLabel: normalizedAction,
          reason: normalizedReason,
        });

        await db.insert(feedbackData).values({
          id: crypto.randomUUID(),
          userId: targetEmail.userId,
          analysisId,
          emailId: input.messageId,
          targetType: 'action_suggestion',
          rating: input.feedbackMessage,
          createdAt: new Date(),
        });

        return {
          success: true,
          refreshed: {
            category: normalizedCategory,
            priorityScore: normalizedScore,
            suggestedAction: normalizedAction,
            reason: normalizedReason,
          },
        };
      } finally {
        await conn.end();
      }
    }),
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
      const withPriorityScores = await enrichThreadWithPriorityScores(
        activeConnection.id,
        result.result,
      );
      const withActionSuggestions = await enrichThreadWithActionSuggestions(
        activeConnection.id,
        withPriorityScores,
      );
      return enrichThreadWithCategories(activeConnection.id, withActionSuggestions);
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
  getRawEmail: activeDriverProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const { stub: agent } = await getZeroAgent(activeConnection.id);
      try {
        return await agent.getRawEmail(input.id);
      } finally {
        disposeRpc(agent);
      }
    
      //return agent.getRawEmail(input.id);
    }),
  verifyEmail: activeDriverProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
        const { activeConnection } = ctx;
        const { stub: agent } = await getZeroAgent(activeConnection.id);
	      
	try {
      	  console.log(`[VERIFY_EMAIL] Getting raw email for message ID: ${input.id}`);
      	  const rawEmail = await agent.getRawEmail(input.id);

      	  const { verify } = await import('../../lib/email-verification');
      	  const result = await verify(rawEmail);
      	  console.log(`[VERIFY_EMAIL] Verification result for message ID ${input.id}:`, result);
      	  return result;
    	} catch (error) {
      	  console.error('Email verification error:', error);
      	  return { isVerified: false };
    	} finally {
      	  disposeRpc(agent);
    	}
  	
     
    }),
});
