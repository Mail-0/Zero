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
import { defaultLabels, EPrompts, EProviders, type ParsedMessage, type Sender } from './types';
import { WorkflowEntrypoint, WorkflowStep, type WorkflowEvent } from 'cloudflare:workers';
import { connectionToDriver, getZeroAgent, notifyUser } from './lib/server-utils';
import { type gmail_v1 } from '@googleapis/gmail';
import { env } from 'cloudflare:workers';
import { connection } from './db/schema';
import * as cheerio from 'cheerio';
import { eq } from 'drizzle-orm';
import { createDb } from './db';
import { z } from 'zod';

const showLogs = true;

const log = (message: string, ...args: any[]) => {
  if (showLogs) {
    console.log(message, ...args);
    return message;
  }
  return 'no message';
};

type VectorizeVectorMetadata = 'connection' | 'thread' | 'summary';

type IThreadSummaryMetadata = Record<VectorizeVectorMetadata, VectorizeVectorMetadata>;

export class MainWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(
    event: Readonly<WorkflowEvent<Params<'providerId' | 'historyId' | 'subscriptionName'>>>,
    step: WorkflowStep,
  ) {
    log('[MAIN_WORKFLOW] Starting workflow with payload:', event.payload);
    try {
      const { providerId, historyId, subscriptionName } = event.payload;

      if (!env.GOOGLE_S_ACCOUNT) {
        throw new Error('GOOGLE_S_ACCOUNT environment variable is not set');
      }

      const serviceAccount = JSON.parse(env.GOOGLE_S_ACCOUNT);
      const connectionId = await step.do(
        `[MAIN_WORKFLOW] Validate Arguments ${providerId} ${subscriptionName} ${historyId}`,
        async () => {
          log('[MAIN_WORKFLOW] Validating arguments');
          const regex = new RegExp(
            `projects/${serviceAccount.project_id}/subscriptions/notifications__([a-z0-9-]+)`,
          );
          const match = subscriptionName.toString().match(regex);
          if (!match) {
            log('[MAIN_WORKFLOW] Invalid subscription name:', subscriptionName);
            throw new Error(`Invalid subscription name ${subscriptionName}`);
          }
          const [, connectionId] = match;
          log('[MAIN_WORKFLOW] Extracted connectionId:', connectionId);
          return connectionId;
        },
      );
      if (!isValidUUID(connectionId)) {
        log('[MAIN_WORKFLOW] Invalid connection id format:', connectionId);
        return 'Invalid connection id';
      }
      const previousHistoryId = await env.gmail_history_id.get(connectionId);
      if (providerId === EProviders.google) {
        log('[MAIN_WORKFLOW] Processing Google provider workflow');
        await step.do(
          `[MAIN_WORKFLOW] Send to Zero Workflow ${connectionId} ${historyId}`,
          async () => {
            log('[MAIN_WORKFLOW] Previous history ID:', previousHistoryId);
            if (previousHistoryId) {
              log('[MAIN_WORKFLOW] Creating workflow instance with previous history');
              const instance = await env.ZERO_WORKFLOW.create({
                params: {
                  connectionId,
                  historyId: previousHistoryId,
                  nextHistoryId: historyId,
                },
              });
              log('[MAIN_WORKFLOW] Created instance:', {
                id: instance.id,
                status: await instance.status(),
              });
            } else {
              log('[MAIN_WORKFLOW] Creating workflow instance with current history');
              //   const existingInstance = await env.ZERO_WORKFLOW.get(
              //     `${connectionId}__${historyId}`,
              //   ).catch(() => null);
              //   if (existingInstance && (await existingInstance.status()).status === 'running') {
              //     log('[MAIN_WORKFLOW] History already processing:', existingInstance.id);
              //     return;
              //   }
              const instance = await env.ZERO_WORKFLOW.create({
                // id: `${connectionId}__${historyId}`,
                params: {
                  connectionId,
                  historyId: historyId,
                  nextHistoryId: historyId,
                },
              });
              log('[MAIN_WORKFLOW] Created instance:', {
                id: instance.id,
                status: await instance.status(),
              });
            }
          },
        );
      } else {
        log('[MAIN_WORKFLOW] Unsupported provider:', providerId);
        throw new Error(`Unsupported provider: ${providerId}`);
      }
      log('[MAIN_WORKFLOW] Workflow completed successfully');
    } catch (error) {
      log('[MAIN_WORKFLOW] Error in workflow:', error);
      log('[MAIN_WORKFLOW] Error details:', {
        providerId: event.payload.providerId,
        historyId: event.payload.historyId,
        subscriptionName: event.payload.subscriptionName,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}

export class ZeroWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(
    event: Readonly<WorkflowEvent<Params<'connectionId' | 'historyId' | 'nextHistoryId'>>>,
    step: WorkflowStep,
  ) {
    log('[ZERO_WORKFLOW] Starting workflow with payload:', event.payload);
    try {
      const { connectionId, historyId, nextHistoryId } = event.payload;

      const historyProcessingKey = `history_${connectionId}__${historyId}`;
      const isProcessing = await env.gmail_processing_threads.get(historyProcessingKey);
      if (isProcessing === 'true') {
        return log('[ZERO_WORKFLOW] History already being processed:', {
          connectionId,
          historyId,
          processingStatus: isProcessing,
        });
      }

      await env.gmail_processing_threads.put(historyProcessingKey, 'true', { expirationTtl: 3600 });
      log('[ZERO_WORKFLOW] Set processing flag for history:', historyProcessingKey);

      const { db, conn } = createDb(env.HYPERDRIVE.connectionString);

      const foundConnection = await step.do(
        `[ZERO_WORKFLOW] Find Connection ${connectionId}`,
        async () => {
          log('[ZERO_WORKFLOW] Finding connection:', connectionId);
          const [foundConnection] = await db
            .select()
            .from(connection)
            .where(eq(connection.id, connectionId.toString()));
          if (!foundConnection) throw new Error(`Connection not found ${connectionId}`);
          if (!foundConnection.accessToken || !foundConnection.refreshToken)
            throw new Error(`Connection is not authorized ${connectionId}`);
          log('[ZERO_WORKFLOW] Found connection:', foundConnection.id);
          return foundConnection;
        },
      );

      const driver = connectionToDriver(foundConnection);
      if (foundConnection.providerId === EProviders.google) {
        log('[ZERO_WORKFLOW] Processing Google provider workflow');
        const history = await step.do(
          `[ZERO_WORKFLOW] Get Gmail History ${foundConnection.id} ${historyId}`,
          async () => {
            try {
              log('[ZERO_WORKFLOW] Getting Gmail history with ID:', historyId);
              const { history } = await driver.listHistory<gmail_v1.Schema$History>(
                historyId.toString(),
              );
              if (!history.length) throw new Error(`No history found ${historyId} ${connectionId}`);
              log('[ZERO_WORKFLOW] Found history entries:', history.length);
              return history;
            } catch (error) {
              log('[ZERO_WORKFLOW] Failed to get Gmail history:', {
                historyId,
                connectionId: foundConnection.id,
                error: error instanceof Error ? error.message : String(error),
              });
              throw error;
            }
          },
        );
        await step.do(
          `[ZERO_WORKFLOW] Update next history id ${foundConnection.id} ${nextHistoryId}`,
          async () => {
            log('[ZERO_WORKFLOW] Updating next history ID:', nextHistoryId);
            await env.gmail_history_id.put(connectionId.toString(), nextHistoryId.toString());
          },
        );
        const threadsAdded = await step.do(
          `[ZERO_WORKFLOW] Get new Threads ${connectionId}`,
          async () => {
            log('[ZERO_WORKFLOW] Finding threads with changed messages');
            const historiesWithChangedMessages = history.filter(
              (history) => history.messagesAdded?.length,
            );
            const threadsAdded = [
              ...new Set(
                historiesWithChangedMessages.flatMap((history) =>
                  history
                    .messagesAdded!.map((message) => message.message?.threadId)
                    .filter((threadId): threadId is string => threadId !== undefined),
                ),
              ),
            ];
            log('[ZERO_WORKFLOW] Found new threads:', threadsAdded.length);
            return threadsAdded;
          },
        );

        const threadsAddLabels = await step.do(
          `[ZERO_WORKFLOW] Get Threads with new labels ${connectionId}`,
          async () => {
            log('[ZERO_WORKFLOW] Finding threads with new labels');
            const historiesWithNewLabels = history.filter((history) => history.labelsAdded?.length);
            const threadsWithLabelsAdded = [
              ...new Set(
                historiesWithNewLabels.flatMap((history) =>
                  history
                    .labelsAdded!.filter((label) => label.message?.threadId)
                    .map((label) => label.message!.threadId)
                    .filter((threadId): threadId is string => threadId !== undefined),
                ),
              ),
            ];
            log('[ZERO_WORKFLOW] Found threads with new labels:', threadsWithLabelsAdded.length);
            return threadsWithLabelsAdded;
          },
        );

        const threadsRemoveLabels = await step.do(
          `[ZERO_WORKFLOW] Get Threads with removed labels ${connectionId}`,
          async () => {
            log('[ZERO_WORKFLOW] Finding threads with removed labels');
            const historiesWithRemovedLabels = history.filter(
              (history) => history.labelsRemoved?.length,
            );
            const threadsWithLabelsRemoved = [
              ...new Set(
                historiesWithRemovedLabels.flatMap((history) =>
                  history
                    .labelsRemoved!.filter((label) => label.message?.threadId)
                    .map((label) => label.message!.threadId)
                    .filter((threadId): threadId is string => threadId !== undefined),
                ),
              ),
            ];
            log(
              '[ZERO_WORKFLOW] Found threads with removed labels:',
              threadsWithLabelsRemoved.length,
            );
            return threadsWithLabelsRemoved;
          },
        );

        // const lastPage = await step.do(
        //   `[ZERO_WORKFLOW] Get last page ${connectionId}`,
        //   async () => {
        //     log('[ZERO_WORKFLOW] Getting last page of threads');
        //     const lastThreads = await driver.list({
        //       folder: 'inbox',
        //       query: 'NOT is:spam',
        //       maxResults: 10,
        //     });
        //     log('[ZERO_WORKFLOW] Found threads in last page:', lastThreads.threads.length);
        //     return lastThreads.threads.map((thread) => thread.id);
        //   },
        // );

        const threadsToProcess = await step.do(
          `[ZERO_WORKFLOW] Get threads to process ${connectionId}`,
          async () => {
            log('[ZERO_WORKFLOW] Combining threads to process');
            const threadsToProcess = [
              ...new Set([
                ...threadsAdded,
                // ...lastPage,
                ...threadsAddLabels,
                ...threadsRemoveLabels,
              ]),
            ];
            log('[ZERO_WORKFLOW] Total threads to process:', threadsToProcess.length);
            return threadsToProcess;
          },
        );

        const agent = await getZeroAgent(connectionId.toString());

        await step.do(`[ZERO_WORKFLOW] Sync Threads ${historyProcessingKey}`, async () => {
          for (const threadId of threadsToProcess) {
            try {
              await agent.syncThread(threadId.toString());
            } catch (error) {
              log('[ZERO_WORKFLOW] Failed to sync thread:', {
                threadId,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        });

        const status = await env.subscribed_accounts.get(
          `${connectionId}__${foundConnection.providerId}`,
        );
        if (!status || status === 'pending') {
          log('[MAIN_WORKFLOW] Connection id is missing or not enabled %s', connectionId);
          return 'Connection is not enabled, not processing threads';
        }

        await step.do(
          `[ZERO_WORKFLOW] Send Thread Workflow Instances ${connectionId}`,
          async () => {
            const maxConcurrentThreads = 5;
            const delayBetweenBatches = 2000;

            for (let i = 0; i < threadsToProcess.length; i += maxConcurrentThreads) {
              const batch = threadsToProcess.slice(i, i + maxConcurrentThreads);

              await Promise.all(
                batch.map(async (threadId) => {
                  try {
                    const isProcessing = await env.gmail_processing_threads.get(
                      threadId.toString(),
                    );
                    if (isProcessing) {
                      log('[ZERO_WORKFLOW] Thread already processing:', isProcessing, threadId);
                      return;
                    }
                    await env.gmail_processing_threads.put(threadId.toString(), 'true', {
                      expirationTtl: 1800,
                    });
                    // const existingInstance = await env.THREAD_WORKFLOW.get(
                    //   `${threadId.toString()}__${connectionId.toString()}`,
                    // ).catch(() => null);
                    // if (
                    //   existingInstance &&
                    //   (await existingInstance.status()).status === 'running'
                    // ) {
                    //   log('[ZERO_WORKFLOW] Thread already processing:', isProcessing, threadId);
                    //   await env.gmail_processing_threads.delete(threadId.toString());
                    //   return;
                    // }
                    const instance = await env.THREAD_WORKFLOW.create({
                      //   id: `${threadId.toString()}__${connectionId.toString()}`,
                      params: { connectionId, threadId, providerId: foundConnection.providerId },
                    });
                    log('[ZERO_WORKFLOW] Created instance:', {
                      id: instance.id,
                      status: await instance.status(),
                    });
                  } catch (error) {
                    log('[ZERO_WORKFLOW] Failed to process thread:', {
                      threadId,
                      connectionId,
                      error: error instanceof Error ? error.message : String(error),
                    });

                    try {
                      await env.gmail_processing_threads.delete(threadId.toString());
                    } catch (cleanupError) {
                      log('[ZERO_WORKFLOW] Failed to cleanup processing flag:', {
                        threadId,
                        error:
                          cleanupError instanceof Error
                            ? cleanupError.message
                            : String(cleanupError),
                      });
                    }
                  }
                }),
              );

              if (i + maxConcurrentThreads < threadsToProcess.length) {
                log('[ZERO_WORKFLOW] Sleeping between batches:', delayBetweenBatches);
                await step.sleep(
                  `[ZERO_WORKFLOW] Sleeping between batches ${i} ${threadsToProcess.length}`,
                  delayBetweenBatches,
                );
              }
            }
          },
        );
      } else {
        log('[ZERO_WORKFLOW] Unsupported provider:', foundConnection.providerId);
        throw new Error(`Unsupported provider: ${foundConnection.providerId}`);
      }

      try {
        await env.gmail_processing_threads.delete(historyProcessingKey);
        log('[ZERO_WORKFLOW] Cleared processing flag for history:', historyProcessingKey);
      } catch (cleanupError) {
        log('[ZERO_WORKFLOW] Failed to clear history processing flag:', {
          historyProcessingKey,
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }

      this.ctx.waitUntil(conn.end());
    } catch (error) {
      const historyProcessingKey = `history_${event.payload.connectionId}__${event.payload.historyId}`;
      try {
        await env.gmail_processing_threads.delete(historyProcessingKey);
        log(
          '[ZERO_WORKFLOW] Cleared processing flag for history after error:',
          historyProcessingKey,
        );
      } catch (cleanupError) {
        log('[ZERO_WORKFLOW] Failed to clear history processing flag after error:', {
          historyProcessingKey,
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }

      log('[ZERO_WORKFLOW] Error in workflow:', error);
      log('[ZERO_WORKFLOW] Error details:', {
        connectionId: event.payload.connectionId,
        historyId: event.payload.historyId,
        nextHistoryId: event.payload.nextHistoryId,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}
export class ThreadWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(
    event: Readonly<WorkflowEvent<Params<'connectionId' | 'threadId' | 'providerId'>>>,
    step: WorkflowStep,
  ) {
    log('[THREAD_WORKFLOW] Starting workflow with payload:', event.payload);
    try {
      const { connectionId, threadId, providerId } = event.payload;
      if (providerId === EProviders.google) {
        log('[THREAD_WORKFLOW] Processing Google provider workflow');
        const { db, conn } = createDb(env.HYPERDRIVE.connectionString);

        const foundConnection = await step.do(
          `[THREAD_WORKFLOW] Find Connection ${connectionId}`,
          async () => {
            log('[THREAD_WORKFLOW] Finding connection:', connectionId);
            const [foundConnection] = await db
              .select()
              .from(connection)
              .where(eq(connection.id, connectionId.toString()));
            if (!foundConnection) throw new Error(`Connection not found ${connectionId}`);
            if (!foundConnection.accessToken || !foundConnection.refreshToken)
              throw new Error(`Connection is not authorized ${connectionId}`);
            log('[THREAD_WORKFLOW] Found connection:', foundConnection.id);
            return foundConnection;
          },
        );
        const driver = connectionToDriver(foundConnection);
        const thread = await step.do(
          `[THREAD_WORKFLOW] Get Thread ${threadId} ${connectionId}`,
          async () => {
            log('[THREAD_WORKFLOW] Getting thread:', threadId);
            const thread = await driver.get(threadId.toString());
            // await notifyUser({
            //   connectionId: connectionId.toString(),
            //   result: thread,
            //   threadId: threadId.toString(),
            // });
            log('[THREAD_WORKFLOW] Found thread with messages:', thread.messages.length);
            return thread;
          },
        );

        if (!thread.messages || thread.messages.length === 0) {
          log('[THREAD_WORKFLOW] Thread has no messages, skipping processing');
          return;
        }

        const messagesToVectorize = await step.do(
          `[THREAD_WORKFLOW] Get Thread Messages ${threadId} ${connectionId}`,
          async () => {
            log('[THREAD_WORKFLOW] Finding messages to vectorize');
            log('[THREAD_WORKFLOW] Getting message IDs from thread');
            const messageIds = thread.messages.map((message) => message.id);
            log('[THREAD_WORKFLOW] Found message IDs:', messageIds);

            log('[THREAD_WORKFLOW] Fetching existing vectorized messages');
            const existingMessages = await env.VECTORIZE_MESSAGE.getByIds(messageIds);
            log('[THREAD_WORKFLOW] Found existing messages:', existingMessages.length);

            const existingMessageIds = new Set(existingMessages.map((message) => message.id));
            log('[THREAD_WORKFLOW] Existing message IDs:', Array.from(existingMessageIds));

            const messagesToVectorize = thread.messages.filter(
              (message) => !existingMessageIds.has(message.id),
            );
            log('[THREAD_WORKFLOW] Messages to vectorize:', messagesToVectorize.length);

            return messagesToVectorize;
          },
        );

        if (messagesToVectorize.length === 0) {
          log('[THREAD_WORKFLOW] No messages to vectorize, skipping vectorization');
        } else {
          const finalEmbeddings: VectorizeVector[] = await step.do(
            `[THREAD_WORKFLOW] Vectorize Messages ${threadId} ${connectionId}`,
            async () => {
              log(
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
                    return step.do(
                      `[THREAD_WORKFLOW] Vectorize Message ${message.id} ${threadId}`,
                      async () => {
                        try {
                          log('[THREAD_WORKFLOW] Converting message to XML:', message.id);
                          const prompt = await messageToXML(message);
                          if (!prompt) {
                            log('[THREAD_WORKFLOW] Message has no prompt, skipping:', message.id);
                            return null;
                          }
                          log('[THREAD_WORKFLOW] Got XML prompt for message:', message.id);

                          const SummarizeMessagePrompt = await step.do(
                            `[THREAD_WORKFLOW] Get Summarize Message Prompt ${message.id} ${threadId}`,
                            async () => {
                              log(
                                '[THREAD_WORKFLOW] Getting summarize prompt for connection:',
                                message.connectionId ?? '',
                              );
                              return await getPrompt(
                                getPromptName(
                                  message.connectionId ?? '',
                                  EPrompts.SummarizeMessage,
                                ),
                                SummarizeMessage,
                              );
                            },
                          );
                          log('[THREAD_WORKFLOW] Got summarize prompt for message:', message.id);

                          const summary: string = await step.do(
                            `[THREAD_WORKFLOW] Summarize Message ${message.id} ${threadId}`,
                            async () => {
                              try {
                                log(
                                  '[THREAD_WORKFLOW] Generating summary for message:',
                                  message.id,
                                );
                                const messages = [
                                  { role: 'system', content: SummarizeMessagePrompt },
                                  {
                                    role: 'user',
                                    content: prompt,
                                  },
                                ];
                                const response: any = await env.AI.run(
                                  '@cf/meta/llama-4-scout-17b-16e-instruct',
                                  {
                                    messages,
                                  },
                                );
                                log(
                                  `[THREAD_WORKFLOW] Summary generated for message ${message.id}:`,
                                  response,
                                );
                                const summary =
                                  'response' in response ? response.response : response;
                                if (!summary || typeof summary !== 'string') {
                                  throw new Error(
                                    `Invalid summary response for message ${message.id}`,
                                  );
                                }
                                return summary;
                              } catch (error) {
                                log('[THREAD_WORKFLOW] Failed to generate summary for message:', {
                                  messageId: message.id,
                                  error: error instanceof Error ? error.message : String(error),
                                });
                                throw error;
                              }
                            },
                          );

                          const embeddingVector = await step.do(
                            `[THREAD_WORKFLOW] Get Message Embedding Vector ${message.id} ${threadId}`,
                            async () => {
                              try {
                                log(
                                  '[THREAD_WORKFLOW] Getting embedding vector for message:',
                                  message.id,
                                );
                                const embeddingVector = await getEmbeddingVector(summary);
                                log(
                                  '[THREAD_WORKFLOW] Got embedding vector for message:',
                                  message.id,
                                );
                                return embeddingVector;
                              } catch (error) {
                                log(
                                  '[THREAD_WORKFLOW] Failed to get embedding vector for message:',
                                  {
                                    messageId: message.id,
                                    error: error instanceof Error ? error.message : String(error),
                                  },
                                );
                                throw error;
                              }
                            },
                          );

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
                          log('[THREAD_WORKFLOW] Failed to vectorize message:', {
                            messageId: message.id,
                            error: error instanceof Error ? error.message : String(error),
                          });
                          return null;
                        }
                      },
                    );
                  }),
                );

                const validResults = batchResults.filter(
                  (result): result is NonNullable<typeof result> => result !== null,
                );
                results.push(...validResults);

                if (i + maxConcurrentMessages < messagesToVectorize.length) {
                  log('[THREAD_WORKFLOW] Sleeping between message batches');
                  await step.sleep('[THREAD_WORKFLOW]', 1000);
                }
              }

              return results;
            },
          );
          log('[THREAD_WORKFLOW] Generated embeddings for all messages');

          if (finalEmbeddings.length > 0) {
            await step.do(
              `[THREAD_WORKFLOW] Thread Messages Vectors ${threadId} ${connectionId} ${finalEmbeddings.length}`,
              async () => {
                try {
                  log('[THREAD_WORKFLOW] Upserting message vectors:', finalEmbeddings.length);
                  await env.VECTORIZE_MESSAGE.upsert(finalEmbeddings);
                  log('[THREAD_WORKFLOW] Successfully upserted message vectors');
                } catch (error) {
                  log('[THREAD_WORKFLOW] Failed to upsert message vectors:', {
                    threadId,
                    vectorCount: finalEmbeddings.length,
                    error: error instanceof Error ? error.message : String(error),
                  });
                  throw error;
                }
              },
            );
          }
        }

        const existingThreadSummary = await step.do(
          `[THREAD_WORKFLOW] Get Thread Summary ${threadId} ${connectionId}`,
          async () => {
            log('[THREAD_WORKFLOW] Getting existing thread summary for:', threadId);
            const threadSummary = await env.VECTORIZE.getByIds([threadId.toString()]);
            if (!threadSummary.length) {
              log('[THREAD_WORKFLOW] No existing thread summary found');
              return null;
            }
            log('[THREAD_WORKFLOW] Found existing thread summary');
            return threadSummary[0].metadata as IThreadSummaryMetadata;
          },
        );

        const finalSummary = await step.do(
          `[THREAD_WORKFLOW] Get Final Summary ${threadId} ${connectionId}`,
          async () => {
            log('[THREAD_WORKFLOW] Generating final thread summary');
            if (existingThreadSummary) {
              log('[THREAD_WORKFLOW] Using existing summary as context');
              return await summarizeThread(
                connectionId.toString(),
                thread.messages,
                existingThreadSummary.summary,
              );
            } else {
              log('[THREAD_WORKFLOW] Generating new summary without context');
              return await summarizeThread(connectionId.toString(), thread.messages);
            }
          },
        );

        const userAccountLabels = await step.do(
          `[THREAD_WORKFLOW] Get user-account labels ${connectionId}`,
          async () => {
            try {
              const userAccountLabels = await driver.getUserLabels();
              return userAccountLabels;
            } catch (error) {
              log('[THREAD_WORKFLOW] Failed to get user account labels:', {
                connectionId,
                error: error instanceof Error ? error.message : String(error),
              });
              throw error;
            }
          },
        );

        if (finalSummary) {
          log('[THREAD_WORKFLOW] Got final summary, processing labels');
          const userLabels = await step.do(
            `[THREAD_WORKFLOW] Get user-defined labels ${connectionId}`,
            async () => {
              log('[THREAD_WORKFLOW] Getting user labels for connection:', connectionId);
              let userLabels: { name: string; usecase: string }[] = [];
              const connectionLabels = await env.connection_labels.get(connectionId.toString());
              if (connectionLabels) {
                try {
                  log('[THREAD_WORKFLOW] Parsing existing connection labels');
                  const parsed = JSON.parse(connectionLabels);
                  if (
                    Array.isArray(parsed) &&
                    parsed.every(
                      (label) => typeof label === 'object' && label.name && label.usecase,
                    )
                  ) {
                    userLabels = parsed;
                  } else {
                    throw new Error('Invalid label format');
                  }
                } catch {
                  log('[THREAD_WORKFLOW] Failed to parse labels, using defaults');
                  await env.connection_labels.put(
                    connectionId.toString(),
                    JSON.stringify(defaultLabels),
                  );
                  userLabels = defaultLabels;
                }
              } else {
                log('[THREAD_WORKFLOW] No labels found, using defaults');
                await env.connection_labels.put(
                  connectionId.toString(),
                  JSON.stringify(defaultLabels),
                );
                userLabels = defaultLabels;
              }
              return userLabels.length ? userLabels : defaultLabels;
            },
          );

          const generatedLabels = await step.do(
            `[THREAD_WORKFLOW] Generate Thread Labels ${threadId} ${connectionId} ${thread.messages.length}`,
            async () => {
              try {
                log('[THREAD_WORKFLOW] Generating labels for thread:', threadId);
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
                  log('[THREAD_WORKFLOW] Labels generated:', labelsResponse.response);
                  const labels: string[] = labelsResponse?.response
                    ?.split(',')
                    .map((e: string) => e.trim())
                    .filter((e: string) => e.length > 0)
                    .filter((e: string) =>
                      userLabels.find((label) => label.name.toLowerCase() === e.toLowerCase()),
                    );
                  return labels;
                } else {
                  log('[THREAD_WORKFLOW] No labels generated');
                  return [];
                }
              } catch (error) {
                log('[THREAD_WORKFLOW] Failed to generate labels for thread:', {
                  threadId,
                  error: error instanceof Error ? error.message : String(error),
                });
                return [];
              }
            },
          );

          if (generatedLabels && generatedLabels.length > 0) {
            await step.do(
              `[THREAD_WORKFLOW] Modify Thread Labels ${threadId} ${connectionId}`,
              async () => {
                log('[THREAD_WORKFLOW] Modifying thread labels:', generatedLabels);
                const validLabelIds = generatedLabels
                  .map((name) => userAccountLabels.find((e) => e.name === name)?.id)
                  .filter((id): id is string => id !== undefined && id !== '');

                if (validLabelIds.length > 0) {
                  await driver.modifyLabels([threadId.toString()], {
                    addLabels: validLabelIds,
                    removeLabels: [],
                  });
                }
                log('[THREAD_WORKFLOW] Successfully modified thread labels');
              },
            );
          }

          const embeddingVector = await step.do(
            `[THREAD_WORKFLOW] Get Thread Embedding Vector ${threadId} ${connectionId}`,
            async () => {
              log('[THREAD_WORKFLOW] Getting thread embedding vector');
              const embeddingVector = await getEmbeddingVector(finalSummary);
              log('[THREAD_WORKFLOW] Got thread embedding vector');
              return embeddingVector;
            },
          );

          if (!embeddingVector) {
            log('[THREAD_WORKFLOW] Thread Embedding vector is null, skipping vector upsert');
            return;
          }

          try {
            log('[THREAD_WORKFLOW] Upserting thread vector');
            await env.VECTORIZE.upsert([
              {
                id: threadId.toString(),
                metadata: {
                  connection: connectionId.toString(),
                  thread: threadId.toString(),
                  summary: finalSummary,
                },
                values: embeddingVector,
              },
            ]);
            log('[THREAD_WORKFLOW] Successfully upserted thread vector');
          } catch (error) {
            log('[THREAD_WORKFLOW] Failed to upsert thread vector:', {
              threadId,
              connectionId,
              error: error instanceof Error ? error.message : String(error),
            });
            throw error;
          }
        } else {
          log(
            '[THREAD_WORKFLOW] No summary generated for thread',
            threadId,
            thread.messages.length,
          );
        }

        this.ctx.waitUntil(conn.end());
      } else {
        log('[THREAD_WORKFLOW] Unsupported provider:', providerId);
        throw new Error(`Unsupported provider: ${providerId}`);
      }
    } catch (error) {
      log('[THREAD_WORKFLOW] Error in workflow:', error);
      log('[THREAD_WORKFLOW] Error details:', {
        connectionId: event.payload.connectionId,
        threadId: event.payload.threadId,
        providerId: event.payload.providerId,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}

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

export const getPromptName = (connectionId: string, prompt: EPrompts) => {
  return `${connectionId}-${prompt}`;
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

const isValidUUID = (string: string) => {
  if (!string || typeof string !== 'string') return false;
  return z.string().uuid().safeParse(string).success;
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
