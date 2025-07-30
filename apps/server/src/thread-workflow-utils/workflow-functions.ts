import {
  SummarizeMessage,
  ThreadLabels,
  ReSummarizeThread,
  SummarizeThread,
} from '../lib/brain.fallback.prompts';
import { EPrompts, defaultLabels, type ParsedMessage } from '../types';
import { analyzeEmailIntent, generateAutomaticDraft } from './index';
import { getPrompt, getEmbeddingVector } from '../pipelines.effect';
import { messageToXML, threadToXML } from './workflow-utils';
import type { WorkflowContext } from './workflow-engine';
import { bulkDeleteKeys } from '../lib/bulk-delete';
import { getZeroAgent } from '../lib/server-utils';
import { getPromptName } from '../pipelines';
import { env } from 'cloudflare:workers';
import { Effect } from 'effect';

export type WorkflowFunction = (context: WorkflowContext) => Promise<any>;

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
    const intentResult = context.results?.get('analyze-email-intent');
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
    const draftContentResult = context.results?.get('generate-draft-content');
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

    const getExistingMessagesBatch = (batch: string[]): Effect.Effect<any[], never> =>
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

    const existingMessageIds = new Set(existingMessages.map((message: any) => message.id));
    const messagesToVectorize = context.thread.messages.filter(
      (message) => !existingMessageIds.has(message.id),
    );

    console.log('[WORKFLOW_FUNCTIONS] Messages to vectorize:', messagesToVectorize.length);
    return { messagesToVectorize, existingMessages };
  },

  vectorizeMessages: async (context) => {
    const vectorizeResult = context.results?.get('find-messages-to-vectorize');
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
    const vectorizeResult = context.results?.get('vectorize-messages');
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

  cleanupWorkflowExecution: async (context) => {
    const workflowKey = `workflow_${context.threadId}`;
    const result = await bulkDeleteKeys([workflowKey]);
    console.log(
      '[WORKFLOW_FUNCTIONS] Cleaned up workflow execution tracking for thread:',
      context.threadId,
      'Result:',
      result,
    );
    return { cleaned: true };
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

    const { summary, lastMsg } = metadata as any;
    if (typeof summary !== 'string' || typeof lastMsg !== 'string') {
      console.warn(
        '[WORKFLOW_FUNCTIONS] Metadata missing required string properties (summary, lastMsg), returning null',
      );
      return { existingSummary: null };
    }

    return { existingSummary: { summary, lastMsg } };
  },

  generateThreadSummary: async (context) => {
    const summaryResult = context.results?.get('check-existing-summary');
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
    const summaryResult = context.results?.get('generate-thread-summary');
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
    const summaryResult = context.results?.get('generate-thread-summary');
    console.log(summaryResult, context.results);
    if (!summaryResult?.summary) {
      console.log('[WORKFLOW_FUNCTIONS] No summary available for label generation');
      return { labels: [] };
    }

    console.log('[WORKFLOW_FUNCTIONS] Getting user topics for connection:', context.connectionId);
    let userLabels: { name: string; usecase: string }[] = [];
    try {
      const agent = await getZeroAgent(context.connectionId);
      const userTopics = await agent.getUserTopics();
      if (userTopics.length > 0) {
        userLabels = userTopics.map((topic: any) => ({
          name: topic.topic,
          usecase: topic.usecase,
        }));
        console.log('[WORKFLOW_FUNCTIONS] Using user topics as labels:', userLabels);
      } else {
        console.log('[WORKFLOW_FUNCTIONS] No user topics found, using defaults');
        userLabels = defaultLabels;
      }
    } catch (error) {
      console.log('[WORKFLOW_FUNCTIONS] Failed to get user topics, using defaults:', error);
      userLabels = defaultLabels;
    }

    console.log('[WORKFLOW_FUNCTIONS] Generating labels for thread:', {
      userLabels,
      threadId: context.threadId,
      threadLabels: context.thread.labels,
    });

    const labelsResponse = await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
      messages: [
        { role: 'system', content: ThreadLabels(userLabels, context.thread.labels) },
        { role: 'user', content: summaryResult.summary },
      ],
    });

    if (labelsResponse?.response?.replaceAll('!', '').trim()?.length) {
      console.log('[WORKFLOW_FUNCTIONS] Labels generated:', labelsResponse.response);
      const labels: string[] = labelsResponse?.response
        ?.split(',')
        .map((e: string) => e.trim())
        .filter((e: string) => e.length > 0)
        .filter((e: string) =>
          userLabels.find((label) => label.name.toLowerCase() === e.toLowerCase()),
        );
      return { labels, userLabelsUsed: userLabels };
    } else {
      console.log('[WORKFLOW_FUNCTIONS] No labels generated');
      return { labels: [], userLabelsUsed: userLabels };
    }
  },

  applyLabels: async (context) => {
    const labelsResult = context.results?.get('generate-labels');
    const userLabelsResult = context.results?.get('get-user-labels');

    if (!labelsResult?.labels || labelsResult.labels.length === 0) {
      console.log('[WORKFLOW_FUNCTIONS] No labels to apply');
      return { applied: false };
    }

    if (!userLabelsResult?.userAccountLabels) {
      console.log('[WORKFLOW_FUNCTIONS] No user account labels available');
      return { applied: false };
    }

    const userAccountLabels = userLabelsResult.userAccountLabels;
    const generatedLabels = labelsResult.labels;

    console.log('[WORKFLOW_FUNCTIONS] Modifying thread labels:', generatedLabels);

    const agent = await getZeroAgent(context.connectionId);

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
        await agent.modifyThreadLabelsInDB(
          context.threadId.toString(),
          labelsToAdd,
          labelsToRemove,
        );
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
