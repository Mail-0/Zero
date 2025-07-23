/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  ReSummarizeThread,
  SummarizeMessage,
  SummarizeThread,
  ThreadLabels,
} from './lib/brain.fallback.prompts';
import {
  generateAutomaticDraft,
  shouldGenerateDraft,
  analyzeEmailIntent,
} from './thread-workflow-utils';
import { defaultLabels, EPrompts, EProviders, type ParsedMessage, type Sender } from './types';
import { getZeroAgent } from './lib/server-utils';
import { type gmail_v1 } from '@googleapis/gmail';
import { getPromptName } from './pipelines';
import { env } from 'cloudflare:workers';
import { connection } from './db/schema';
import { Effect, Console } from 'effect';
import * as cheerio from 'cheerio';
import { eq } from 'drizzle-orm';
import { createDb } from './db';

const showLogs = true;

export const log = (message: string, ...args: any[]) => {
  if (showLogs) {
    console.log(message, ...args);
    return message;
  }
  return 'no message';
};

const isValidUUID = (str: string): boolean => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(str);
};

// Define the workflow parameters type
type MainWorkflowParams = {
  providerId: string;
  historyId: string;
  subscriptionName: string;
};

// Define error types
type MainWorkflowError =
  | { _tag: 'MissingEnvironmentVariable'; variable: string }
  | { _tag: 'InvalidSubscriptionName'; subscriptionName: string }
  | { _tag: 'InvalidConnectionId'; connectionId: string }
  | { _tag: 'UnsupportedProvider'; providerId: string }
  | { _tag: 'WorkflowCreationFailed'; error: unknown };

const validateArguments = (
  params: MainWorkflowParams,
  serviceAccount: { project_id: string },
): Effect.Effect<string, MainWorkflowError> =>
  Effect.gen(function* () {
    yield* Console.log('[MAIN_WORKFLOW] Validating arguments');
    const regex = new RegExp(
      `projects/${serviceAccount.project_id}/subscriptions/notifications__([a-z0-9-]+)`,
    );
    const match = params.subscriptionName.toString().match(regex);
    if (!match) {
      yield* Console.log('[MAIN_WORKFLOW] Invalid subscription name:', params.subscriptionName);
      return yield* Effect.fail({
        _tag: 'InvalidSubscriptionName' as const,
        subscriptionName: params.subscriptionName,
      });
    }
    const [, connectionId] = match;
    yield* Console.log('[MAIN_WORKFLOW] Extracted connectionId:', connectionId);
    return connectionId;
  });

const override = false;

/**
 * This function runs the main workflow. The main workflow is responsible for processing incoming messages from a Pub/Sub subscription and passing them to the appropriate pipeline.
 * It validates the subscription name and extracts the connection ID.
 * @param params
 * @returns
 */
export const runMainWorkflow = (
  params: MainWorkflowParams,
): Effect.Effect<string, MainWorkflowError> =>
  Effect.gen(function* () {
    yield* Console.log('[MAIN_WORKFLOW] Starting workflow with payload:', params);

    const { providerId, historyId } = params;

    let serviceAccount = null;
    if (override) {
      serviceAccount = override;
    } else {
      if (!env.GOOGLE_S_ACCOUNT || env.GOOGLE_S_ACCOUNT === '{}') {
        return yield* Effect.fail({
          _tag: 'MissingEnvironmentVariable' as const,
          variable: 'GOOGLE_S_ACCOUNT',
        });
      }

      serviceAccount = JSON.parse(env.GOOGLE_S_ACCOUNT);
    }

    const connectionId = yield* validateArguments(params, serviceAccount);

    if (!isValidUUID(connectionId)) {
      yield* Console.log('[MAIN_WORKFLOW] Invalid connection id format:', connectionId);
      return yield* Effect.fail({
        _tag: 'InvalidConnectionId' as const,
        connectionId,
      });
    }

    const previousHistoryId = yield* Effect.tryPromise({
      try: () => env.gmail_history_id.get(connectionId),
      catch: () => ({ _tag: 'WorkflowCreationFailed' as const, error: 'Failed to get history ID' }),
    }).pipe(Effect.orElse(() => Effect.succeed(null)));

    if (providerId === EProviders.google) {
      yield* Console.log('[MAIN_WORKFLOW] Processing Google provider workflow');
      yield* Console.log('[MAIN_WORKFLOW] Previous history ID:', previousHistoryId);

      const zeroWorkflowParams = {
        connectionId,
        historyId: previousHistoryId || historyId,
        nextHistoryId: historyId,
      };

      const result = yield* runZeroWorkflow(zeroWorkflowParams).pipe(
        Effect.mapError(
          (error): MainWorkflowError => ({ _tag: 'WorkflowCreationFailed' as const, error }),
        ),
      );

      yield* Console.log('[MAIN_WORKFLOW] Zero workflow result:', result);
    } else {
      yield* Console.log('[MAIN_WORKFLOW] Unsupported provider:', providerId);
      return yield* Effect.fail({
        _tag: 'UnsupportedProvider' as const,
        providerId,
      });
    }

    yield* Console.log('[MAIN_WORKFLOW] Workflow completed successfully');
    return 'Workflow completed successfully';
  }).pipe(Effect.tapError((error) => Console.log('[MAIN_WORKFLOW] Error in workflow:', error)));

// Define the ZeroWorkflow parameters type
type ZeroWorkflowParams = {
  connectionId: string;
  historyId: string;
  nextHistoryId: string;
};

// Define error types for ZeroWorkflow
type ZeroWorkflowError =
  | { _tag: 'HistoryAlreadyProcessing'; connectionId: string; historyId: string }
  | { _tag: 'ConnectionNotFound'; connectionId: string }
  | { _tag: 'ConnectionNotAuthorized'; connectionId: string }
  | { _tag: 'HistoryNotFound'; historyId: string; connectionId: string }
  | { _tag: 'UnsupportedProvider'; providerId: string }
  | { _tag: 'DatabaseError'; error: unknown }
  | { _tag: 'GmailApiError'; error: unknown }
  | { _tag: 'WorkflowCreationFailed'; error: unknown };

export const runZeroWorkflow = (
  params: ZeroWorkflowParams,
): Effect.Effect<string, ZeroWorkflowError> =>
  Effect.gen(function* () {
    yield* Console.log('[ZERO_WORKFLOW] Starting workflow with payload:', params);
    const { connectionId, historyId, nextHistoryId } = params;

    const historyProcessingKey = `history_${connectionId}__${historyId}`;
    const isProcessing = yield* Effect.tryPromise({
      try: () => env.gmail_processing_threads.get(historyProcessingKey),
      catch: (error) => ({ _tag: 'WorkflowCreationFailed' as const, error }),
    });

    if (isProcessing === 'true') {
      yield* Console.log('[ZERO_WORKFLOW] History already being processed:', {
        connectionId,
        historyId,
        processingStatus: isProcessing,
      });
      return yield* Effect.fail({
        _tag: 'HistoryAlreadyProcessing' as const,
        connectionId,
        historyId,
      });
    }

    yield* Effect.tryPromise({
      try: () =>
        env.gmail_processing_threads.put(historyProcessingKey, 'true', { expirationTtl: 3600 }),
      catch: (error) => ({ _tag: 'WorkflowCreationFailed' as const, error }),
    });
    yield* Console.log('[ZERO_WORKFLOW] Set processing flag for history:', historyProcessingKey);

    const { db, conn } = createDb(env.HYPERDRIVE.connectionString);

    const foundConnection = yield* Effect.tryPromise({
      try: async () => {
        console.log('[ZERO_WORKFLOW] Finding connection:', connectionId);
        const [foundConnection] = await db
          .select()
          .from(connection)
          .where(eq(connection.id, connectionId.toString()));
        await conn.end();
        if (!foundConnection) {
          throw new Error(`Connection not found ${connectionId}`);
        }
        if (!foundConnection.accessToken || !foundConnection.refreshToken) {
          throw new Error(`Connection is not authorized ${connectionId}`);
        }
        console.log('[ZERO_WORKFLOW] Found connection:', foundConnection.id);
        return foundConnection;
      },
      catch: (error) => ({ _tag: 'DatabaseError' as const, error }),
    });

    yield* Effect.tryPromise({
      try: async () => conn.end(),
      catch: (error) => ({ _tag: 'DatabaseError' as const, error }),
    });

    const agent = yield* Effect.tryPromise({
      try: async () => await getZeroAgent(foundConnection.id),
      catch: (error) => ({ _tag: 'DatabaseError' as const, error }),
    });

    if (foundConnection.providerId === EProviders.google) {
      yield* Console.log('[ZERO_WORKFLOW] Processing Google provider workflow');

      const history = yield* Effect.tryPromise({
        try: async () => {
          console.log('[ZERO_WORKFLOW] Getting Gmail history with ID:', historyId);
          const { history } = (await agent.listHistory(historyId.toString())) as {
            history: gmail_v1.Schema$History[];
          };
          console.log('[ZERO_WORKFLOW] Found history entries:', history);
          return history;
        },
        catch: (error) => ({ _tag: 'GmailApiError' as const, error }),
      });

      if (!history.length) {
        yield* Console.log('[ZERO_WORKFLOW] No history found, skipping');
        return 'No history found';
      }

      yield* Effect.tryPromise({
        try: () => {
          console.log('[ZERO_WORKFLOW] Updating next history ID:', nextHistoryId);
          return env.gmail_history_id.put(connectionId.toString(), nextHistoryId.toString());
        },
        catch: (error) => ({ _tag: 'WorkflowCreationFailed' as const, error }),
      });

      // Extract thread IDs from history
      const threadsChanged = new Set<string>();
      const threadsAdded = new Set<string>();
      history.forEach((historyItem) => {
        if (historyItem.messagesAdded) {
          historyItem.messagesAdded.forEach((messageAdded) => {
            if (messageAdded.message?.threadId) {
              threadsChanged.add(messageAdded.message.threadId);
              threadsAdded.add(messageAdded.message.threadId);
            }
          });
        }
        if (historyItem.labelsAdded) {
          historyItem.labelsAdded.forEach((labelAdded) => {
            if (labelAdded.message?.threadId) {
              threadsChanged.add(labelAdded.message.threadId);
            }
          });
        }
        if (historyItem.labelsRemoved) {
          historyItem.labelsRemoved.forEach((labelRemoved) => {
            if (labelRemoved.message?.threadId) {
              threadsChanged.add(labelRemoved.message.threadId);
            }
          });
        }
      });

      yield* Console.log(
        '[ZERO_WORKFLOW] Found unique thread IDs:',
        Array.from(threadsChanged),
        Array.from(threadsAdded),
      );

      if (threadsAdded.size > 0) {
        const threadWorkflowParams = Array.from(threadsAdded);

        // Sync threads with proper error handling - use allSuccesses to collect successful syncs
        const syncResults = yield* Effect.allSuccesses(
          threadWorkflowParams.map((threadId) =>
            Effect.tryPromise({
              try: async () => {
                const result = await agent.syncThread({ threadId });
                console.log(`[ZERO_WORKFLOW] Successfully synced thread ${threadId}`);
                return { threadId, result };
              },
              catch: (error) => {
                console.error(`[ZERO_WORKFLOW] Failed to sync thread ${threadId}:`, error);
                // Let this effect fail so allSuccesses will exclude it
                throw new Error(
                  `Failed to sync thread ${threadId}: ${error instanceof Error ? error.message : String(error)}`,
                );
              },
            }),
          ),
          { concurrency: 1 }, // Limit concurrency to avoid rate limits
        );

        const syncedCount = syncResults.length;
        const failedCount = threadWorkflowParams.length - syncedCount;

        if (failedCount > 0) {
          yield* Console.log(
            `[ZERO_WORKFLOW] Warning: ${failedCount}/${threadWorkflowParams.length} thread syncs failed. Successfully synced: ${syncedCount}`,
          );
          // Continue with processing - sync failures shouldn't stop the entire workflow
          // The thread processing will continue with whatever data is available
        } else {
          yield* Console.log(`[ZERO_WORKFLOW] Successfully synced all ${syncedCount} threads`);
        }

        yield* Console.log('[ZERO_WORKFLOW] Synced threads:', syncResults);
      }

      // Process all threads concurrently using Effect.all
      if (threadsChanged.size > 0) {
        const threadWorkflowParams = Array.from(threadsChanged).map((threadId) => ({
          connectionId,
          threadId,
          providerId: foundConnection.providerId,
        }));

        const threadResults = yield* Effect.all(
          threadWorkflowParams.map((params) =>
            Effect.gen(function* () {
              // Set processing flag for thread
              yield* Effect.tryPromise({
                try: () => {
                  console.log(
                    '[ZERO_WORKFLOW] Setting processing flag for thread:',
                    params.threadId,
                  );
                  return env.gmail_processing_threads.put(params.threadId.toString(), 'true', {
                    expirationTtl: 1800,
                  });
                },
                catch: (error) => ({ _tag: 'WorkflowCreationFailed' as const, error }),
              });

              // Check if thread is already processing
              const isProcessing = yield* Effect.tryPromise({
                try: () => env.gmail_processing_threads.get(params.threadId.toString()),
                catch: (error) => ({ _tag: 'WorkflowCreationFailed' as const, error }),
              });

              if (isProcessing === 'true') {
                yield* Console.log('[ZERO_WORKFLOW] Thread already processing:', params.threadId);
                return 'Thread already processing';
              }

              // Run the thread workflow
              return yield* runThreadWorkflow(params).pipe(
                Effect.mapError(
                  (error): ZeroWorkflowError => ({
                    _tag: 'WorkflowCreationFailed' as const,
                    error,
                  }),
                ),
              );
            }),
          ),
          { concurrency: 1, discard: true }, // Process up to 5 threads concurrently
        );

        yield* Console.log('[ZERO_WORKFLOW] All thread workflows completed:', threadResults.length);
      } else {
        yield* Console.log('[ZERO_WORKFLOW] No threads to process');
      }

      //   // Clean up processing flag
      //   yield* Effect.tryPromise({
      //     try: () => {
      //       console.log('[ZERO_WORKFLOW] Clearing processing flag for history:', historyProcessingKey);
      //       return env.gmail_processing_threads.delete(historyProcessingKey);
      //     },
      //     catch: (error) => ({ _tag: 'WorkflowCreationFailed' as const, error }),
      //   }).pipe(Effect.orElse(() => Effect.succeed(null)));

      yield* Console.log('[ZERO_WORKFLOW] Processing complete');
      return 'Zero workflow completed successfully';
    } else {
      yield* Console.log('[ZERO_WORKFLOW] Unsupported provider:', foundConnection.providerId);
      return yield* Effect.fail({
        _tag: 'UnsupportedProvider' as const,
        providerId: foundConnection.providerId,
      });
    }
  }).pipe(
    Effect.tapError((error) => Console.log('[ZERO_WORKFLOW] Error in workflow:', error)),
    Effect.catchAll((error) => {
      // Clean up processing flag on error
      return Effect.tryPromise({
        try: () => {
          console.log(
            '[ZERO_WORKFLOW] Clearing processing flag for history after error:',
            `history_${params.connectionId}__${params.historyId}`,
          );
          return env.gmail_processing_threads.delete(
            `history_${params.connectionId}__${params.historyId}`,
          );
        },
        catch: () => ({
          _tag: 'WorkflowCreationFailed' as const,
          error: 'Failed to cleanup processing flag',
        }),
      }).pipe(
        Effect.orElse(() => Effect.succeed(null)),
        Effect.flatMap(() => Effect.fail(error)),
      );
    }),
  );

// Define the ThreadWorkflow parameters type
type ThreadWorkflowParams = {
  connectionId: string;
  threadId: string;
  providerId: string;
};

// Define error types for ThreadWorkflow
type ThreadWorkflowError =
  | { _tag: 'ConnectionNotFound'; connectionId: string }
  | { _tag: 'ConnectionNotAuthorized'; connectionId: string }
  | { _tag: 'ThreadNotFound'; threadId: string }
  | { _tag: 'UnsupportedProvider'; providerId: string }
  | { _tag: 'DatabaseError'; error: unknown }
  | { _tag: 'GmailApiError'; error: unknown }
  | { _tag: 'VectorizationError'; error: unknown };

/**
 * Runs the main workflow for processing a thread. The workflow is responsible for processing incoming messages from a Pub/Sub subscription and passing them to the appropriate pipeline.
 * @param params
 * @returns
 */
export const runThreadWorkflow = (
  params: ThreadWorkflowParams,
): Effect.Effect<string, ThreadWorkflowError> =>
  Effect.gen(function* () {
    yield* Console.log('[THREAD_WORKFLOW] Starting workflow with payload:', params);
    const { connectionId, threadId, providerId } = params;

    if (providerId === EProviders.google) {
      yield* Console.log('[THREAD_WORKFLOW] Processing Google provider workflow');
      const { db, conn } = createDb(env.HYPERDRIVE.connectionString);

      const foundConnection = yield* Effect.tryPromise({
        try: async () => {
          console.log('[THREAD_WORKFLOW] Finding connection:', connectionId);
          const [foundConnection] = await db
            .select()
            .from(connection)
            .where(eq(connection.id, connectionId.toString()));
          if (!foundConnection) {
            throw new Error(`Connection not found ${connectionId}`);
          }
          if (!foundConnection.accessToken || !foundConnection.refreshToken) {
            throw new Error(`Connection is not authorized ${connectionId}`);
          }
          console.log('[THREAD_WORKFLOW] Found connection:', foundConnection.id);
          return foundConnection;
        },
        catch: (error) => ({ _tag: 'DatabaseError' as const, error }),
      });

      const agent = yield* Effect.tryPromise({
        try: async () => await getZeroAgent(foundConnection.id),
        catch: (error) => ({ _tag: 'DatabaseError' as const, error }),
      });

      const thread = yield* Effect.tryPromise({
        try: async () => {
          console.log('[THREAD_WORKFLOW] Getting thread:', threadId);
          const thread = await agent.getThread(threadId.toString());
          console.log('[THREAD_WORKFLOW] Found thread with messages:', thread.messages.length);
          return thread;
        },
        catch: (error) => ({ _tag: 'GmailApiError' as const, error }),
      });

      if (!thread.messages || thread.messages.length === 0) {
        yield* Console.log('[THREAD_WORKFLOW] Thread has no messages, skipping processing');
        return 'Thread has no messages';
      }

      const autoDraftId = yield* Effect.tryPromise({
        try: async () => {
          if (!shouldGenerateDraft(thread, foundConnection)) {
            console.log('[THREAD_WORKFLOW] Skipping draft generation for thread:', threadId);
            return null;
          }

          const latestMessage = thread.messages[thread.messages.length - 1];
          const emailIntent = analyzeEmailIntent(latestMessage);

          console.log('[THREAD_WORKFLOW] Analyzed email intent:', {
            threadId,
            isQuestion: emailIntent.isQuestion,
            isRequest: emailIntent.isRequest,
            isMeeting: emailIntent.isMeeting,
            isUrgent: emailIntent.isUrgent,
          });

          if (
            !emailIntent.isQuestion &&
            !emailIntent.isRequest &&
            !emailIntent.isMeeting &&
            !emailIntent.isUrgent
          ) {
            console.log(
              '[THREAD_WORKFLOW] Email does not require a response, skipping draft generation',
            );
            return null;
          }

          console.log('[THREAD_WORKFLOW] Generating automatic draft for thread:', threadId);
          const draftContent = await generateAutomaticDraft(
            connectionId.toString(),
            thread,
            foundConnection,
          );

          if (draftContent) {
            const latestMessage = thread.messages[thread.messages.length - 1];

            const replyTo = latestMessage.sender?.email || '';
            const cc =
              latestMessage.cc
                ?.map((r) => r.email)
                .filter((email) => email && email !== foundConnection.email) || [];

            const originalSubject = latestMessage.subject || '';
            const replySubject = originalSubject.startsWith('Re: ')
              ? originalSubject
              : `Re: ${originalSubject}`;

            const draftData = {
              to: replyTo,
              cc: cc.join(', '),
              bcc: '',
              subject: replySubject,
              message: draftContent,
              attachments: [],
              id: null,
              threadId: threadId.toString(),
              fromEmail: foundConnection.email,
            };

            try {
              const createdDraft = await agent.createDraft(draftData);
              console.log('[THREAD_WORKFLOW] Created automatic draft:', {
                threadId,
                draftId: createdDraft?.id,
              });
              return createdDraft?.id || null;
            } catch (error) {
              console.log('[THREAD_WORKFLOW] Failed to create automatic draft:', {
                threadId,
                error: error instanceof Error ? error.message : String(error),
              });
              return null;
            }
          }

          return null;
        },
        catch: (error) => ({ _tag: 'DatabaseError' as const, error }),
      });

      yield* Console.log('[THREAD_WORKFLOW] ' + autoDraftId);

      yield* Console.log('[THREAD_WORKFLOW] Processing thread messages and vectorization');

      const messagesToVectorize = yield* Effect.tryPromise({
        try: async () => {
          console.log('[THREAD_WORKFLOW] Finding messages to vectorize');
          console.log('[THREAD_WORKFLOW] Getting message IDs from thread');
          const messageIds = thread.messages.map((message) => message.id);
          console.log('[THREAD_WORKFLOW] Found message IDs:', messageIds);

          console.log('[THREAD_WORKFLOW] Fetching existing vectorized messages');
          const existingMessages = await env.VECTORIZE_MESSAGE.getByIds(messageIds);
          console.log('[THREAD_WORKFLOW] Found existing messages:', existingMessages.length);

          const existingMessageIds = new Set(existingMessages.map((message) => message.id));
          console.log('[THREAD_WORKFLOW] Existing message IDs:', Array.from(existingMessageIds));

          const messagesToVectorize = thread.messages.filter(
            (message) => !existingMessageIds.has(message.id),
          );
          console.log('[THREAD_WORKFLOW] Messages to vectorize:', messagesToVectorize.length);

          return messagesToVectorize;
        },
        catch: (error) => ({ _tag: 'DatabaseError' as const, error }),
      });

      let finalEmbeddings: VectorizeVector[] = [];

      if (messagesToVectorize.length === 0) {
        yield* Console.log('[THREAD_WORKFLOW] No messages to vectorize, skipping vectorization');
      } else {
        finalEmbeddings = yield* Effect.tryPromise({
          try: async () => {
            console.log(
              '[THREAD_WORKFLOW] Starting message vectorization for',
              messagesToVectorize.length,
              'messages',
            );

            const maxConcurrentMessages = 3;
            const results: VectorizeVector[] = [];

            for (let i = 0; i < messagesToVectorize.length; i += maxConcurrentMessages) {
              const batch = messagesToVectorize.slice(i, i + maxConcurrentMessages);
              const batchResults = await Promise.all(
                batch.map(async (message) => {
                  try {
                    console.log('[THREAD_WORKFLOW] Converting message to XML:', message.id);
                    const prompt = await messageToXML(message);
                    if (!prompt) {
                      console.log('[THREAD_WORKFLOW] Message has no prompt, skipping:', message.id);
                      return null;
                    }
                    console.log('[THREAD_WORKFLOW] Got XML prompt for message:', message.id);

                    console.log(
                      '[THREAD_WORKFLOW] Getting summarize prompt for connection:',
                      message.connectionId ?? '',
                    );
                    const SummarizeMessagePrompt = await getPrompt(
                      getPromptName(message.connectionId ?? '', EPrompts.SummarizeMessage),
                      SummarizeMessage,
                    );
                    console.log('[THREAD_WORKFLOW] Got summarize prompt for message:', message.id);

                    console.log('[THREAD_WORKFLOW] Generating summary for message:', message.id);
                    const messages = [
                      { role: 'system', content: SummarizeMessagePrompt },
                      { role: 'user', content: prompt },
                    ];
                    const response = await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
                      messages,
                    });
                    console.log(
                      `[THREAD_WORKFLOW] Summary generated for message ${message.id}:`,
                      response,
                    );
                    const summary = 'response' in response ? response.response : response;
                    if (!summary || typeof summary !== 'string') {
                      throw new Error(`Invalid summary response for message ${message.id}`);
                    }

                    console.log(
                      '[THREAD_WORKFLOW] Getting embedding vector for message:',
                      message.id,
                    );
                    const embeddingVector = await getEmbeddingVector(summary);
                    console.log('[THREAD_WORKFLOW] Got embedding vector for message:', message.id);

                    if (!embeddingVector)
                      throw new Error(`Message Embedding vector is null ${message.id}`);

                    return {
                      id: message.id,
                      metadata: {
                        connection: message.connectionId ?? '',
                        thread: message.threadId ?? '',
                        summary,
                      },
                      values: embeddingVector,
                    } satisfies VectorizeVector;
                  } catch (error) {
                    console.log('[THREAD_WORKFLOW] Failed to vectorize message:', {
                      messageId: message.id,
                      error: error instanceof Error ? error.message : String(error),
                    });
                    return null;
                  }
                }),
              );

              const validResults = batchResults.filter(
                (result): result is NonNullable<typeof result> => result !== null,
              );
              results.push(...validResults);

              if (i + maxConcurrentMessages < messagesToVectorize.length) {
                console.log('[THREAD_WORKFLOW] Sleeping between message batches');
                await new Promise((resolve) => setTimeout(resolve, 1000));
              }
            }

            return results;
          },
          catch: (error) => ({ _tag: 'VectorizationError' as const, error }),
        });

        yield* Console.log('[THREAD_WORKFLOW] Generated embeddings for all messages');

        if (finalEmbeddings.length > 0) {
          yield* Effect.tryPromise({
            try: async () => {
              console.log('[THREAD_WORKFLOW] Upserting message vectors:', finalEmbeddings.length);
              await env.VECTORIZE_MESSAGE.upsert(finalEmbeddings);
              console.log('[THREAD_WORKFLOW] Successfully upserted message vectors');
            },
            catch: (error) => ({ _tag: 'VectorizationError' as const, error }),
          });
        }
      }

      const existingThreadSummary = yield* Effect.tryPromise({
        try: async () => {
          console.log('[THREAD_WORKFLOW] Getting existing thread summary for:', threadId);
          const threadSummary = await env.VECTORIZE.getByIds([threadId.toString()]);
          if (!threadSummary.length) {
            console.log('[THREAD_WORKFLOW] No existing thread summary found');
            return null;
          }
          console.log('[THREAD_WORKFLOW] Found existing thread summary');
          return threadSummary[0].metadata as { summary: string; lastMsg: string };
        },
        catch: (error) => ({ _tag: 'VectorizationError' as const, error }),
      });

      // Early exit if no new messages (prevents infinite loop from label changes)
      const newestMessage = thread.messages[thread.messages.length - 1];
      if (existingThreadSummary && existingThreadSummary.lastMsg === newestMessage?.id) {
        yield* Console.log(
          '[THREAD_WORKFLOW] No new messages since last processing, skipping AI processing',
        );
        return 'Thread workflow completed - no new messages';
      }

      const finalSummary = yield* Effect.tryPromise({
        try: async () => {
          console.log('[THREAD_WORKFLOW] Generating final thread summary');
          if (existingThreadSummary) {
            console.log('[THREAD_WORKFLOW] Using existing summary as context');
            return await summarizeThread(
              connectionId.toString(),
              thread.messages,
              existingThreadSummary.summary,
            );
          } else {
            console.log('[THREAD_WORKFLOW] Generating new summary without context');
            return await summarizeThread(connectionId.toString(), thread.messages);
          }
        },
        catch: (error) => ({ _tag: 'VectorizationError' as const, error }),
      });

      const userAccountLabels = yield* Effect.tryPromise({
        try: async () => {
          const userAccountLabels = await agent.getUserLabels();
          return userAccountLabels;
        },
        catch: (error) => ({ _tag: 'GmailApiError' as const, error }),
      });

      if (finalSummary) {
        yield* Console.log('[THREAD_WORKFLOW] Got final summary, processing labels');

        const userLabels = yield* Effect.tryPromise({
          try: async () => {
            console.log('[THREAD_WORKFLOW] Getting user labels for connection:', connectionId);
            let userLabels: { name: string; usecase: string }[] = [];
            const connectionLabels = await env.connection_labels.get(connectionId.toString());
            if (connectionLabels) {
              try {
                console.log('[THREAD_WORKFLOW] Parsing existing connection labels');
                const parsed = JSON.parse(connectionLabels);
                if (
                  Array.isArray(parsed) &&
                  parsed.every((label) => typeof label === 'object' && label.name && label.usecase)
                ) {
                  userLabels = parsed;
                } else {
                  throw new Error('Invalid label format');
                }
              } catch {
                console.log('[THREAD_WORKFLOW] Failed to parse labels, using defaults');
                await env.connection_labels.put(
                  connectionId.toString(),
                  JSON.stringify(defaultLabels),
                );
                userLabels = defaultLabels;
              }
            } else {
              console.log('[THREAD_WORKFLOW] No labels found, using defaults');
              await env.connection_labels.put(
                connectionId.toString(),
                JSON.stringify(defaultLabels),
              );
              userLabels = defaultLabels;
            }
            return userLabels.length ? userLabels : defaultLabels;
          },
          catch: (error) => ({ _tag: 'DatabaseError' as const, error }),
        });

        const generatedLabels = yield* Effect.tryPromise({
          try: async () => {
            console.log('[THREAD_WORKFLOW] Generating labels for thread:', threadId);
            const labelsResponse: any = await env.AI.run(
              '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
              {
                messages: [
                  { role: 'system', content: ThreadLabels(userLabels, thread.labels) },
                  { role: 'user', content: finalSummary },
                ],
              },
            );
            if (labelsResponse?.response?.replaceAll('!', '').trim()?.length) {
              console.log('[THREAD_WORKFLOW] Labels generated:', labelsResponse.response);
              const labels: string[] = labelsResponse?.response
                ?.split(',')
                .map((e: string) => e.trim())
                .filter((e: string) => e.length > 0)
                .filter((e: string) =>
                  userLabels.find((label) => label.name.toLowerCase() === e.toLowerCase()),
                );
              return labels;
            } else {
              console.log('[THREAD_WORKFLOW] No labels generated');
              return [];
            }
          },
          catch: (error) => ({ _tag: 'VectorizationError' as const, error }),
        }).pipe(Effect.orElse(() => Effect.succeed([])));

        if (generatedLabels && generatedLabels.length > 0) {
          yield* Effect.tryPromise({
            try: async () => {
              console.log('[THREAD_WORKFLOW] Modifying thread labels:', generatedLabels);
              const validLabelIds = generatedLabels
                .map((name) => userAccountLabels.find((e) => e.name === name)?.id)
                .filter((id): id is string => id !== undefined && id !== '');

              if (validLabelIds.length > 0) {
                // Check delta - only modify if there are actual changes
                const currentLabelIds = thread.labels?.map((l) => l.id) || [];
                const labelsToAdd = validLabelIds.filter((id) => !currentLabelIds.includes(id));
                const aiLabelIds = new Set(
                  userAccountLabels
                    .filter((l) => userLabels.some((ul) => ul.name === l.name))
                    .map((l) => l.id),
                );
                const labelsToRemove = currentLabelIds.filter(
                  (id) => aiLabelIds.has(id) && !validLabelIds.includes(id),
                );

                if (labelsToAdd.length > 0 || labelsToRemove.length > 0) {
                  console.log('[THREAD_WORKFLOW] Applying label changes:', {
                    add: labelsToAdd,
                    remove: labelsToRemove,
                  });
                  await agent.modifyLabels([threadId.toString()], labelsToAdd, labelsToRemove);
                  await agent.syncThread({ threadId: threadId.toString() });
                  console.log('[THREAD_WORKFLOW] Successfully modified thread labels');
                } else {
                  console.log('[THREAD_WORKFLOW] No label changes needed - labels already match');
                }
              }
            },
            catch: (error) => ({ _tag: 'GmailApiError' as const, error }),
          });
        }

        const embeddingVector = yield* Effect.tryPromise({
          try: async () => {
            console.log('[THREAD_WORKFLOW] Getting thread embedding vector');
            const embeddingVector = await getEmbeddingVector(finalSummary);
            console.log('[THREAD_WORKFLOW] Got thread embedding vector');
            return embeddingVector;
          },
          catch: (error) => ({ _tag: 'VectorizationError' as const, error }),
        });

        if (!embeddingVector) {
          yield* Console.log(
            '[THREAD_WORKFLOW] Thread Embedding vector is null, skipping vector upsert',
          );
          return 'Thread workflow completed successfully';
        }

        yield* Effect.tryPromise({
          try: async () => {
            console.log('[THREAD_WORKFLOW] Upserting thread vector');
            const newestMessage = thread.messages[thread.messages.length - 1];
            await env.VECTORIZE.upsert([
              {
                id: threadId.toString(),
                metadata: {
                  connection: connectionId.toString(),
                  thread: threadId.toString(),
                  summary: finalSummary,
                  lastMsg: newestMessage?.id, // Store last message ID to prevent reprocessing
                },
                values: embeddingVector,
              },
            ]);
            console.log('[THREAD_WORKFLOW] Successfully upserted thread vector');
          },
          catch: (error) => ({ _tag: 'VectorizationError' as const, error }),
        });
      } else {
        yield* Console.log(
          '[THREAD_WORKFLOW] No summary generated for thread',
          threadId,
          'messages count:',
          thread.messages.length,
        );
      }

      // Clean up thread processing flag
      yield* Effect.tryPromise({
        try: () => {
          console.log('[THREAD_WORKFLOW] Clearing processing flag for thread:', threadId);
          return env.gmail_processing_threads.delete(threadId.toString());
        },
        catch: (error) => ({ _tag: 'DatabaseError' as const, error }),
      }).pipe(Effect.orElse(() => Effect.succeed(null)));

      yield* Effect.tryPromise({
        try: async () => {
          await conn.end();
          console.log('[THREAD_WORKFLOW] Closed database connection');
        },
        catch: (error) => ({ _tag: 'DatabaseError' as const, error }),
      }).pipe(Effect.orElse(() => Effect.succeed(null)));

      yield* Console.log('[THREAD_WORKFLOW] Thread processing complete');
      return 'Thread workflow completed successfully';
    } else {
      yield* Console.log('[THREAD_WORKFLOW] Unsupported provider:', providerId);
      return yield* Effect.fail({
        _tag: 'UnsupportedProvider' as const,
        providerId,
      });
    }
  }).pipe(
    Effect.tapError((error) => Console.log('[THREAD_WORKFLOW] Error in workflow:', error)),
    Effect.catchAll((error) => {
      // Clean up thread processing flag on error
      return Effect.tryPromise({
        try: () => {
          console.log(
            '[THREAD_WORKFLOW] Clearing processing flag for thread after error:',
            params.threadId,
          );
          return env.gmail_processing_threads.delete(params.threadId.toString());
        },
        catch: () => ({
          _tag: 'DatabaseError' as const,
          error: 'Failed to cleanup thread processing flag',
        }),
      }).pipe(
        Effect.orElse(() => Effect.succeed(null)),
        Effect.flatMap(() => Effect.fail(error)),
      );
    }),
  );

// // Helper functions for vectorization and AI processing
// type VectorizeVectorMetadata = 'connection' | 'thread' | 'summary';
// type IThreadSummaryMetadata = Record<VectorizeVectorMetadata, VectorizeVectorMetadata>;

export async function htmlToText(decodedBody: string): Promise<string> {
  try {
    if (!decodedBody || typeof decodedBody !== 'string') {
      return '';
    }
    const $ = cheerio.load(decodedBody);
    $('script').remove();
    $('style').remove();
    return $('body')
      .text()
      .replace(/\r?\n|\r/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (error) {
    log('Error extracting text from HTML:', error);
    return '';
  }
}

const escapeXml = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const messageToXML = async (message: ParsedMessage) => {
  try {
    if (!message.decodedBody) return null;
    const body = await htmlToText(message.decodedBody || '');
    log('[MESSAGE_TO_XML] Body', body);
    if (!body || body.length < 10) {
      log('Skipping message with body length < 10', body);
      return null;
    }

    const safeSenderName = escapeXml(message.sender?.name || 'Unknown');
    const safeSubject = escapeXml(message.subject || '');
    const safeDate = escapeXml(message.receivedOn || '');

    const toElements = (message.to || [])
      .map((r) => `<to>${escapeXml(r?.email || '')}</to>`)
      .join('');
    const ccElements = (message.cc || [])
      .map((r) => `<cc>${escapeXml(r?.email || '')}</cc>`)
      .join('');

    return `
        <message>
          <from>${safeSenderName}</from>
          ${toElements}
          ${ccElements}
          <date>${safeDate}</date>
          <subject>${safeSubject}</subject>
          <body>${escapeXml(body)}</body>
        </message>
        `;
  } catch (error) {
    log('[MESSAGE_TO_XML] Failed to convert message to XML:', {
      messageId: message.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

export const getPrompt = async (promptName: string, fallback: string) => {
  try {
    if (!promptName || typeof promptName !== 'string') {
      log('[GET_PROMPT] Invalid prompt name:', promptName);
      return fallback;
    }

    const existingPrompt = await env.prompts_storage.get(promptName);
    if (!existingPrompt) {
      await env.prompts_storage.put(promptName, fallback);
      return fallback;
    }
    return existingPrompt;
  } catch (error) {
    log('[GET_PROMPT] Failed to get prompt:', {
      promptName,
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
};

export const getEmbeddingVector = async (text: string) => {
  try {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      log('[getEmbeddingVector] Empty or invalid text provided');
      return null;
    }

    const embeddingResponse = await env.AI.run(
      '@cf/baai/bge-large-en-v1.5',
      { text: text.trim() },
      {
        gateway: {
          id: 'vectorize-save',
        },
      },
    );
    const embeddingVector = (embeddingResponse as any).data?.[0];
    return embeddingVector ?? null;
  } catch (error) {
    log('[getEmbeddingVector] failed', error);
    return null;
  }
};

const getParticipants = (messages: ParsedMessage[]) => {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  const result = new Map<Sender['email'], Sender['name'] | ''>();
  const setIfUnset = (sender: Sender) => {
    if (sender?.email && !result.has(sender.email)) {
      result.set(sender.email, sender.name || '');
    }
  };

  for (const msg of messages) {
    if (msg?.sender) {
      setIfUnset(msg.sender);
    }
    if (msg?.cc && Array.isArray(msg.cc)) {
      for (const ccParticipant of msg.cc) {
        if (ccParticipant) setIfUnset(ccParticipant);
      }
    }
    if (msg?.to && Array.isArray(msg.to)) {
      for (const toParticipant of msg.to) {
        if (toParticipant) setIfUnset(toParticipant);
      }
    }
  }
  return Array.from(result.entries());
};

const threadToXML = async (messages: ParsedMessage[], existingSummary?: string) => {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('No messages provided for thread XML generation');
  }

  const firstMessage = messages[0];
  if (!firstMessage) {
    throw new Error('First message is null or undefined');
  }

  const { subject = '', title = '' } = firstMessage;
  const participants = getParticipants(messages);
  const messagesXML = await Promise.all(messages.map(messageToXML));
  const validMessagesXML = messagesXML.filter((xml): xml is string => xml !== null);

  if (existingSummary) {
    return `<thread>
            <title>${escapeXml(title)}</title>
            <subject>${escapeXml(subject)}</subject>
            <participants>
              ${participants.map(([email, name]) => {
                return `<participant>${escapeXml(name || email)} ${name ? `< ${escapeXml(email)} >` : ''}</participant>`;
              })}
            </participants>
            <existing_summary>
              ${escapeXml(existingSummary)}
            </existing_summary>
            <new_messages>
                ${validMessagesXML.map((e) => e + '\n')}
            </new_messages>
        </thread>`;
  }
  return `<thread>
          <title>${escapeXml(title)}</title>
          <subject>${escapeXml(subject)}</subject>
          <participants>
            ${participants.map(([email, name]) => {
              return `<participant>${escapeXml(name || email)} < ${escapeXml(email)} ></participant>`;
            })}
          </participants>
          <messages>
              ${validMessagesXML.map((e) => e + '\n')}
          </messages>
      </thread>`;
};

const summarizeThread = async (
  connectionId: string,
  messages: ParsedMessage[],
  existingSummary?: string,
): Promise<string | null> => {
  try {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      log('[SUMMARIZE_THREAD] No messages provided for summarization');
      return null;
    }

    if (!connectionId || typeof connectionId !== 'string') {
      log('[SUMMARIZE_THREAD] Invalid connection ID provided');
      return null;
    }

    const prompt = await threadToXML(messages, existingSummary);
    if (!prompt) {
      log('[SUMMARIZE_THREAD] Failed to generate thread XML');
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
      const response: any = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: promptMessages,
      });
      const summary = response?.response;
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
      const response: any = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: promptMessages,
      });
      const summary = response?.response;
      return typeof summary === 'string' ? summary : null;
    }
  } catch (error) {
    log('[SUMMARIZE_THREAD] Failed to summarize thread:', {
      connectionId,
      messageCount: messages?.length || 0,
      hasExistingSummary: !!existingSummary,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};
