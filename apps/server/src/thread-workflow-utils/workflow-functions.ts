import {
  LABEL_MODEL,
  buildLabelRequest,
  pickLabels,
  type ClefLabelResponse,
} from '../lib/clef-labels';
import {
  SummarizeMessage,
  ReSummarizeThread,
  SummarizeThread,
} from '../lib/brain.fallback.prompts';
import { EPrompts, defaultLabels, type ParsedMessage } from '../types';
import { analyzeEmailIntent, generateAutomaticDraft } from './index';
import { getPrompt, getEmbeddingVector } from '../pipelines.effect';
import { messageToXML, threadToXML } from './workflow-utils';
import type { WorkflowContext } from './workflow-engine';
import { getZeroAgent } from '../lib/server-utils';
import { getPromptName } from '../pipelines';
import { Effect } from 'effect';
import { env } from '../env';

export type WorkflowFunction = (context: WorkflowContext) => Promise<unknown>;

const SYSTEM_LABEL = /^(INBOX|UNREAD|IMPORTANT|STARRED|SENT|DRAFT|SPAM|TRASH|CHAT)$|^CATEGORY_/;

type WorkflowResults = {
  'analyze-email-intent': ReturnType<typeof analyzeEmailIntent>;
  'generate-draft-content': { draftContent: string };
  'find-messages-to-vectorize': { messagesToVectorize: ParsedMessage[] };
  'vectorize-messages': { embeddings: VectorizeVector[] };
  'check-existing-summary': { existingSummary: { summary: string; lastMsg: string } | null };
  'generate-thread-summary': { summary: string | null };
  'generate-labels': { labels: string[]; userLabelsUsed?: { name: string; usecase: string }[] };
  'get-user-labels': { userAccountLabels: { name: string; id: string }[] };
};

const getWorkflowResult = <K extends keyof WorkflowResults>(context: WorkflowContext, key: K) =>
  context.results?.get(key) as WorkflowResults[K] | undefined;

export const workflowFunctions: Record<string, WorkflowFunction> = {
  analyzeEmailIntent: async (context) => {
    if (!context.thread.messages || context.thread.messages.length === 0) {
      throw new Error('Cannot analyze email intent: No messages in thread');
    }
    const latestMessage = context.thread.messages[context.thread.messages.length - 1];
    const emailIntent = analyzeEmailIntent(latestMessage);

    console.log('[WORKFLOW_FUNCTIONS] Analyzed email intent:', {
      threadId: context.threadId,
      isQuestion: emailIntent.isQuestion,
      isRequest: emailIntent.isRequest,
      isMeeting: emailIntent.isMeeting,
      isUrgent: emailIntent.isUrgent,
    });

    return emailIntent;
  },

  validateResponseNeeded: async (context) => {
    const intentResult = getWorkflowResult(context, 'analyze-email-intent');
    if (!intentResult) {
      console.log('[WORKFLOW_FUNCTIONS] Email intent analysis not available');
      throw new Error('Email intent analysis not available');
    }

    const requiresResponse =
      intentResult.isQuestion ||
      intentResult.isRequest ||
      intentResult.isMeeting ||
      intentResult.isUrgent;

    if (!requiresResponse) {
      console.log(
        '[WORKFLOW_FUNCTIONS] Email does not require a response, skipping draft generation',
      );
      return { requiresResponse: false };
    }

    console.log('[WORKFLOW_FUNCTIONS] Email requires a response, continuing with draft generation');

    return { requiresResponse: true };
  },

  generateAutomaticDraft: async (context) => {
    console.log('[WORKFLOW_FUNCTIONS] Generating automatic draft for thread:', context.threadId);
    console.log('[WORKFLOW_FUNCTIONS] Thread has', context.thread.messages.length, 'messages');
    console.log(
      '[WORKFLOW_FUNCTIONS] Latest message from:',
      context.thread.messages[context.thread.messages.length - 1]?.sender?.email,
    );

    const draftContent = await generateAutomaticDraft(
      context.connectionId,
      context.thread,
      context.foundConnection,
    );

    if (!draftContent) {
      throw new Error('Failed to generate draft content');
    }

    return { draftContent };
  },

  createDraft: async (context) => {
    const draftContentResult = getWorkflowResult(context, 'generate-draft-content');
    if (!draftContentResult?.draftContent) {
      throw new Error('No draft content available');
    }

    const latestMessage = context.thread.messages[context.thread.messages.length - 1];
    const replyTo = latestMessage.sender?.email || '';
    if (!replyTo) {
      throw new Error('Cannot create draft: No sender email in latest message');
    }
    const cc =
      latestMessage.cc
        ?.map((r) => r.email)
        .filter((email) => email && email !== context.foundConnection.email) || [];

    const originalSubject = latestMessage.subject || '';
    const replySubject = originalSubject.startsWith('Re: ')
      ? originalSubject
      : `Re: ${originalSubject}`;

    const draftData = {
      to: replyTo,
      cc: cc.join(', '),
      bcc: '',
      subject: replySubject,
      message: draftContentResult.draftContent,
      attachments: [],
      id: null,
      threadId: context.threadId,
      fromEmail: context.foundConnection.email,
      // Make it a real reply so the app can resume it when the user hits Reply.
      inReplyTo: latestMessage.messageId || undefined,
      references:
        [...(latestMessage.references?.split(/\s+/) ?? []), latestMessage.messageId]
          .filter(Boolean)
          .join(' ') || undefined,
      replyToMessageId: latestMessage.id,
      isZeroSuggestion: true,
    };

    const agent = await getZeroAgent(context.connectionId);
    const createdDraft = await agent.createDraft(draftData);
    console.log('[WORKFLOW_FUNCTIONS] Created automatic draft:', {
      threadId: context.threadId,
      draftId: createdDraft?.id,
    });

    return { draftId: createdDraft?.id || null };
  },

  findMessagesToVectorize: async (context) => {
    console.log('[WORKFLOW_FUNCTIONS] Finding messages to vectorize');
    const messageIds = context.thread.messages.map((message) => message.id);
    console.log('[WORKFLOW_FUNCTIONS] Found message IDs:', messageIds);

    const batchSize = 20;
    const batches = [];
    for (let i = 0; i < messageIds.length; i += batchSize) {
      batches.push(messageIds.slice(i, i + batchSize));
    }

    const getExistingMessagesBatch = (batch: string[]): Effect.Effect<VectorizeVector[], never> =>
      Effect.tryPromise(async () => {
        console.log('[WORKFLOW_FUNCTIONS] Fetching batch of', batch.length, 'message IDs');
        return await env.VECTORIZE_MESSAGE.getByIds(batch);
      }).pipe(
        Effect.catchAll((error) => {
          console.log('[WORKFLOW_FUNCTIONS] Failed to fetch batch:', error);
          return Effect.succeed([]);
        }),
      );

    const batchEffects = batches.map(getExistingMessagesBatch);
    const program = Effect.all(batchEffects, { concurrency: 3 }).pipe(
      Effect.map((results) => {
        const allExistingMessages = results.flat();
        console.log('[WORKFLOW_FUNCTIONS] Found existing messages:', allExistingMessages.length);
        return allExistingMessages;
      }),
    );

    const existingMessages = await Effect.runPromise(program);

    const existingMessageIds = new Set(existingMessages.map((message) => message.id));
    const messagesToVectorize = context.thread.messages.filter(
      (message) => !existingMessageIds.has(message.id),
    );

    console.log('[WORKFLOW_FUNCTIONS] Messages to vectorize:', messagesToVectorize.length);
    return { messagesToVectorize, existingMessages };
  },

  vectorizeMessages: async (context) => {
    const vectorizeResult = getWorkflowResult(context, 'find-messages-to-vectorize');
    if (!vectorizeResult?.messagesToVectorize) {
      console.log('[WORKFLOW_FUNCTIONS] No messages to vectorize, skipping');
      return { embeddings: [] };
    }

    const messagesToVectorize = vectorizeResult.messagesToVectorize;
    console.log(
      '[WORKFLOW_FUNCTIONS] Starting message vectorization for',
      messagesToVectorize.length,
      'messages',
    );

    type VectorizedMessage = {
      id: string;
      metadata: {
        connection: string;
        thread: string;
        summary: string;
      };
      values: number[];
    };

    const vectorizeSingleMessage = (
      message: ParsedMessage,
    ): Effect.Effect<VectorizedMessage | null, never> =>
      Effect.tryPromise(async (): Promise<VectorizedMessage | null> => {
        console.log('[WORKFLOW_FUNCTIONS] Converting message to XML:', message.id);
        const prompt = await messageToXML(message);
        if (!prompt) {
          console.log('[WORKFLOW_FUNCTIONS] Message has no prompt, skipping:', message.id);
          return null;
        }

        const SummarizeMessagePrompt = await getPrompt(
          getPromptName(message.connectionId ?? '', EPrompts.SummarizeMessage),
          SummarizeMessage,
        );

        const messages = [
          { role: 'system', content: SummarizeMessagePrompt },
          { role: 'user', content: prompt },
        ];

        const response = await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
          messages,
        });

        const summary = 'response' in response ? response.response : response;
        if (!summary || typeof summary !== 'string') {
          throw new Error(`Invalid summary response for message ${message.id}`);
        }

        const embeddingVector = await getEmbeddingVector(summary);
        if (!embeddingVector) {
          throw new Error(`Message Embedding vector is null ${message.id}`);
        }

        return {
          id: message.id,
          metadata: {
            connection: message.connectionId ?? '',
            thread: message.threadId ?? '',
            summary,
          },
          values: embeddingVector,
        };
      }).pipe(
        Effect.catchAll((error) => {
          console.log('[WORKFLOW_FUNCTIONS] Failed to vectorize message:', {
            messageId: message.id,
            error: error instanceof Error ? error.message : String(error),
          });
          return Effect.succeed(null);
        }),
      );

    const vectorizeEffects: Effect.Effect<VectorizedMessage | null, never>[] =
      messagesToVectorize.map(vectorizeSingleMessage);

    const program = Effect.all(vectorizeEffects, { concurrency: 3 }).pipe(
      Effect.map((results) => {
        const validResults = results.filter(
          (result): result is VectorizedMessage => result !== null,
        );
        console.log('[WORKFLOW_FUNCTIONS] Successfully vectorized messages:', validResults.length);
        return { embeddings: validResults };
      }),
    );

    return Effect.runPromise(program);
  },

  upsertEmbeddings: async (context) => {
    const vectorizeResult = getWorkflowResult(context, 'vectorize-messages');
    if (!vectorizeResult?.embeddings || vectorizeResult.embeddings.length === 0) {
      console.log('[WORKFLOW_FUNCTIONS] No embeddings to upsert');
      return { upserted: 0 };
    }

    console.log(
      '[WORKFLOW_FUNCTIONS] Upserting message vectors:',
      vectorizeResult.embeddings.length,
    );
    await env.VECTORIZE_MESSAGE.upsert(vectorizeResult.embeddings);
    console.log('[WORKFLOW_FUNCTIONS] Successfully upserted message vectors');

    return { upserted: vectorizeResult.embeddings.length };
  },

  checkExistingSummary: async (context) => {
    console.log('[WORKFLOW_FUNCTIONS] Getting existing thread summary for:', context.threadId);
    const threadSummary = await env.VECTORIZE.getByIds([context.threadId.toString()]);
    if (!threadSummary.length) {
      console.log('[WORKFLOW_FUNCTIONS] No existing thread summary found');
      return { existingSummary: null };
    }
    console.log('[WORKFLOW_FUNCTIONS] Found existing thread summary');

    const metadata = threadSummary[0].metadata;
    if (!metadata || typeof metadata !== 'object') {
      console.warn('[WORKFLOW_FUNCTIONS] Invalid metadata structure, returning null');
      return { existingSummary: null };
    }

    const { summary, lastMsg } = metadata;
    if (typeof summary !== 'string' || typeof lastMsg !== 'string') {
      console.warn(
        '[WORKFLOW_FUNCTIONS] Metadata missing required string properties (summary, lastMsg), returning null',
      );
      return { existingSummary: null };
    }

    return { existingSummary: { summary, lastMsg } };
  },

  generateThreadSummary: async (context) => {
    const summaryResult = getWorkflowResult(context, 'check-existing-summary');
    const existingSummary = summaryResult?.existingSummary;

    const newestMessage = context.thread.messages[context.thread.messages.length - 1];
    if (existingSummary && existingSummary.lastMsg === newestMessage?.id) {
      console.log(
        '[WORKFLOW_FUNCTIONS] No new messages since last processing, skipping AI processing',
      );
      return { summary: existingSummary.summary };
    }

    console.log('[WORKFLOW_FUNCTIONS] Generating final thread summary');
    if (existingSummary) {
      console.log('[WORKFLOW_FUNCTIONS] Using existing summary as context');
      const summary = await summarizeThread(
        context.connectionId,
        context.thread.messages,
        existingSummary.summary,
      );
      return { summary };
    } else {
      console.log('[WORKFLOW_FUNCTIONS] Generating new summary without context');
      const summary = await summarizeThread(
        context.connectionId,
        context.thread.messages,
        undefined,
      );
      return { summary };
    }
  },

  upsertThreadSummary: async (context) => {
    const summaryResult = getWorkflowResult(context, 'generate-thread-summary');
    if (!summaryResult?.summary) {
      console.log('[WORKFLOW_FUNCTIONS] No summary generated for thread');
      return { upserted: false };
    }

    const embeddingVector = await getEmbeddingVector(summaryResult.summary);
    if (!embeddingVector) {
      console.log('[WORKFLOW_FUNCTIONS] Thread Embedding vector is null, skipping vector upsert');
      return { upserted: false };
    }

    console.log('[WORKFLOW_FUNCTIONS] Upserting thread vector');
    const newestMessage = context.thread.messages[context.thread.messages.length - 1];
    await env.VECTORIZE.upsert([
      {
        id: context.threadId.toString(),
        metadata: {
          connection: context.connectionId.toString(),
          thread: context.threadId.toString(),
          summary: summaryResult.summary,
          lastMsg: newestMessage?.id,
        },
        values: embeddingVector,
      },
    ]);
    console.log('[WORKFLOW_FUNCTIONS] Successfully upserted thread vector');

    return { upserted: true };
  },

  getUserLabels: async (context) => {
    try {
      console.log('[WORKFLOW_FUNCTIONS] Getting user labels for connection:', context.results);
      const agent = await getZeroAgent(context.connectionId);
      const userAccountLabels = await agent.getUserLabels();
      return { userAccountLabels };
    } catch (error) {
      console.error('[WORKFLOW_FUNCTIONS] Error in getUserLabels:', error);
      return { userAccountLabels: [] };
    }
  },

  generateLabels: async (context) => {
    const summaryResult = getWorkflowResult(context, 'generate-thread-summary');
    console.log(summaryResult, context.results);
    if (!summaryResult?.summary) {
      console.log('[WORKFLOW_FUNCTIONS] No summary available for label generation');
      return { labels: [] };
    }

    const userLabels = await labelCandidates(context);

    console.log('[WORKFLOW_FUNCTIONS] Generating labels for thread:', {
      userLabels,
      threadId: context.threadId,
      threadLabels: context.thread.labels,
    });

    const request = buildLabelRequest(
      summaryResult.summary,
      userLabels,
      (context.thread.labels ?? [])
        .map((label: { name: string }) => label.name)
        .filter((name: string) => name && !SYSTEM_LABEL.test(name)),
    );
    if (!request) {
      console.log('[WORKFLOW_FUNCTIONS] No label candidates for thread');
      return { labels: [], userLabelsUsed: userLabels };
    }

    const labelsResponse = (await env.AI.run(
      LABEL_MODEL as Parameters<typeof env.AI.run>[0],
      request as unknown as Parameters<typeof env.AI.run>[1],
    )) as ClefLabelResponse;

    const labels = pickLabels(userLabels, labelsResponse);
    console.log('[WORKFLOW_FUNCTIONS] Labels generated:', labels);
    return { labels, userLabelsUsed: userLabels };
  },

  applyLabels: async (context) => {
    const labelsResult = getWorkflowResult(context, 'generate-labels');
    const userLabelsResult = getWorkflowResult(context, 'get-user-labels');

    if (!labelsResult?.labels || labelsResult.labels.length === 0) {
      console.log('[WORKFLOW_FUNCTIONS] No labels to apply');
      return { applied: false };
    }

    if (!userLabelsResult?.userAccountLabels) {
      console.log('[WORKFLOW_FUNCTIONS] No user account labels available');
      return { applied: false };
    }

    let userAccountLabels: { name: string; id: string }[] = userLabelsResult.userAccountLabels;
    const generatedLabels = labelsResult.labels;

    console.log('[WORKFLOW_FUNCTIONS] Modifying thread labels:', generatedLabels);

    const agent = await getZeroAgent(context.connectionId);

    // Custom label lists are not created up front (inferred topics are, by
    // getUserTopics), so create any chosen label the account doesn't have yet.
    const missing = generatedLabels.filter(
      (name: string) =>
        !userAccountLabels.some((label) => label.name.toLowerCase() === name.toLowerCase()),
    );
    if (missing.length > 0 && context.aiLabels?.length) {
      for (const name of missing) {
        try {
          await agent.createLabel({ name }, { kind: 'tag' });
        } catch (error) {
          console.warn('[WORKFLOW_FUNCTIONS] Failed to create label', { name, error });
        }
      }
      userAccountLabels = await agent.getUserLabels();
    }

    const validLabelIds = generatedLabels
      .map((name: string) => {
        const foundLabel = userAccountLabels.find(
          (label: { name: string; id: string }) => label.name.toLowerCase() === name.toLowerCase(),
        );
        return foundLabel?.id;
      })
      .filter((id: string | undefined): id is string => id !== undefined && id !== '');

    if (validLabelIds.length > 0) {
      const currentLabelIds = context.thread.labels?.map((l: { id: string }) => l.id) || [];
      const labelsToAdd = validLabelIds.filter((id: string) => !currentLabelIds.includes(id));

      const aiManagedLabelNames = new Set(
        (labelsResult.userLabelsUsed || []).map((topic: { name: string }) =>
          topic.name.toLowerCase(),
        ),
      );

      const aiManagedLabelIds = new Set(
        userAccountLabels
          .filter((label: { name: string }) => aiManagedLabelNames.has(label.name.toLowerCase()))
          .map((label: { id: string }) => label.id),
      );

      const labelsToRemove = currentLabelIds.filter(
        (id: string) => aiManagedLabelIds.has(id) && !validLabelIds.includes(id),
      );

      if (labelsToAdd.length > 0 || labelsToRemove.length > 0) {
        console.log('[WORKFLOW_FUNCTIONS] Applying label changes:', {
          add: labelsToAdd,
          remove: labelsToRemove,
        });
        // Persisted per provider (Gmail labels, IMAP keywords, else app-kept), so the
        // labels survive re-imports and later changes to the thread.
        await agent.applyAiLabels(context.threadId.toString(), labelsToAdd, labelsToRemove);
        console.log('[WORKFLOW_FUNCTIONS] Successfully modified thread labels');
        return { applied: true, added: labelsToAdd.length, removed: labelsToRemove.length };
      } else {
        console.log('[WORKFLOW_FUNCTIONS] No label changes needed - labels already match');
        return { applied: false };
      }
    }

    console.log('[WORKFLOW_FUNCTIONS] No valid labels found in user account');
    return { applied: false };
  },

  /**
   * IMAP has no native inbox categories; the sync assigns one from headers. With a thread
   * summary available, ask the model for the Personal / Promotions / Updates category and
   * store it as the thread's override (never over a category the user chose).
   */
  classifyCategory: async (context) => {
    if (context.foundConnection.providerId !== 'imap') return { skipped: 'provider' };
    const summary = getWorkflowResult(context, 'generate-thread-summary')?.summary;
    if (!summary) return { skipped: 'no_summary' };
    const latest = context.thread.messages[context.thread.messages.length - 1];
    const response = await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
      messages: [
        {
          role: 'system',
          content: CATEGORY_CLASSIFIER_PROMPT,
        },
        {
          role: 'user',
          content: `From: ${latest?.sender?.name ?? ''} <${latest?.sender?.email ?? ''}>\nSubject: ${latest?.subject ?? ''}\nSummary: ${summary}`,
        },
      ],
    });
    const answer = String('response' in response ? response.response : '')
      .trim()
      .toLowerCase();
    const category = (['personal', 'promotions', 'updates'] as const).find((value) =>
      answer.startsWith(value),
    );
    if (!category) return { skipped: 'unparsed', answer };
    const agent = await getZeroAgent(context.connectionId);
    await agent.setThreadCategory(context.threadId.toString(), category, 'ai');
    return { category };
  },
};

const CATEGORY_CLASSIFIER_PROMPT = `You sort emails into exactly one inbox tab.
- personal: written by a person to the user (conversations, replies, direct requests), including work mail from colleagues or clients.
- promotions: marketing, newsletters, offers, deals, product announcements, event invitations sent in bulk.
- updates: automated notifications, receipts, orders, shipping, bills, statements, account and security alerts, reminders, mailing-list and forum digests.
Answer with one word: personal, promotions or updates.`;

/** The user's custom label list, else topics learned from the inbox, else defaults. */
const labelCandidates = async (
  context: WorkflowContext,
): Promise<{ name: string; usecase: string }[]> => {
  if (context.aiLabels?.length) return context.aiLabels;
  try {
    const agent = await getZeroAgent(context.connectionId);
    const userTopics = await agent.getUserTopics();
    if (userTopics.length > 0)
      return userTopics.map((topic) => ({ name: topic.topic, usecase: topic.usecase }));
    console.log('[WORKFLOW_FUNCTIONS] No user topics found, using defaults');
  } catch (error) {
    console.log('[WORKFLOW_FUNCTIONS] Failed to get user topics, using defaults:', error);
  }
  return defaultLabels;
};

// Helper function for thread summarization
const summarizeThread = async (
  connectionId: string,
  messages: ParsedMessage[],
  existingSummary?: string,
): Promise<string | null> => {
  try {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.log('[SUMMARIZE_THREAD] No messages provided for summarization');
      return null;
    }

    if (!connectionId || typeof connectionId !== 'string') {
      console.log('[SUMMARIZE_THREAD] Invalid connection ID provided');
      return null;
    }

    const prompt = await threadToXML(messages, existingSummary);
    if (!prompt) {
      console.log('[SUMMARIZE_THREAD] Failed to generate thread XML');
      return null;
    }

    if (existingSummary) {
      const ReSummarizeThreadPrompt = await getPrompt(
        getPromptName(connectionId, EPrompts.ReSummarizeThread),
        ReSummarizeThread,
      );
      const promptMessages = [
        { role: 'system', content: ReSummarizeThreadPrompt },
        {
          role: 'user',
          content: prompt,
        },
      ];
      const response = await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
        messages: promptMessages,
      });
      const summary = response.response;
      return typeof summary === 'string' ? summary : null;
    } else {
      const SummarizeThreadPrompt = await getPrompt(
        getPromptName(connectionId, EPrompts.SummarizeThread),
        SummarizeThread,
      );
      const promptMessages = [
        { role: 'system', content: SummarizeThreadPrompt },
        {
          role: 'user',
          content: prompt,
        },
      ];
      const response = await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
        messages: promptMessages,
      });
      const summary = response.response;
      return typeof summary === 'string' ? summary : null;
    }
  } catch (error) {
    console.log('[SUMMARIZE_THREAD] Failed to summarize thread:', {
      connectionId,
      messageCount: messages?.length || 0,
      hasExistingSummary: !!existingSummary,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};
