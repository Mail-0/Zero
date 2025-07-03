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
import { connectionToDriver, notifyUser } from './lib/server-utils';
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
  }
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
      const serviceAccount = JSON.parse(env.GOOGLE_S_ACCOUNT);
      const connectionId = await step.do(
        `[ZERO] Validate Arguments ${providerId} ${subscriptionName} ${historyId}`,
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
      const status = await env.subscribed_accounts.get(`${connectionId}__${providerId}`);
      if (!status || status === 'pending') {
        log('[MAIN_WORKFLOW] Connection id is missing or not enabled %s', connectionId);
        return 'Connection is not enabled';
      }
      if (!isValidUUID(connectionId)) {
        log('[MAIN_WORKFLOW] Invalid connection id format:', connectionId);
        return 'Invalid connection id';
      }
      const previousHistoryId = await env.gmail_history_id.get(connectionId);
      if (providerId === EProviders.google) {
        log('[MAIN_WORKFLOW] Processing Google provider workflow');
        await step.do(`[ZERO] Send to Zero Workflow ${connectionId} ${historyId}`, async () => {
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
            const existingInstance = await env.ZERO_WORKFLOW.get(
              `${connectionId}__${historyId}`,
            ).catch(() => null);
            if (existingInstance && (await existingInstance.status()).status === 'running') {
              log('[MAIN_WORKFLOW] History already processing:', existingInstance.id);
              return;
            }
            const instance = await env.ZERO_WORKFLOW.create({
              id: `${connectionId}__${historyId}`,
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
        });
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
      if (isProcessing) {
        log('[ZERO_WORKFLOW] History already being processed:', {
          connectionId,
          historyId,
          processingStatus: isProcessing,
        });
        return;
      }

      await env.gmail_processing_threads.put(historyProcessingKey, 'true');
      log('[ZERO_WORKFLOW] Set processing flag for history:', historyProcessingKey);
      const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
      const foundConnection = await step.do(`[ZERO] Find Connection ${connectionId}`, async () => {
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
      });

      const driver = connectionToDriver(foundConnection);
      if (foundConnection.providerId === EProviders.google) {
        log('[ZERO_WORKFLOW] Processing Google provider workflow');
        const history = await step.do(
          `[ZERO] Get Gmail History for ${foundConnection.id}`,
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
        await step.do(`[ZERO] Update next history id for ${foundConnection.id}`, async () => {
          log('[ZERO_WORKFLOW] Updating next history ID:', nextHistoryId);
          await env.gmail_history_id.put(connectionId.toString(), nextHistoryId.toString());
        });
        const threadsAdded = await step.do('[ZERO] Get new Threads', async () => {
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
        });

        const threadsAddLabels = await step.do('[ZERO] Get Threads with new labels', async () => {
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
        });

        const threadsRemoveLabels = await step.do(
          '[ZERO] Get Threads with removed labels',
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

        const lastPage = await step.do('[ZERO] Get last page', async () => {
          log('[ZERO_WORKFLOW] Getting last page of threads');
          const lastThreads = await driver.list({
            folder: 'inbox',
            query: 'NOT is:spam',
            maxResults: 10,
          });
          log('[ZERO_WORKFLOW] Found threads in last page:', lastThreads.threads.length);
          return lastThreads.threads.map((thread) => thread.id);
        });

        const threadsToProcess = await step.do('[ZERO] Get threads to process', async () => {
          log('[ZERO_WORKFLOW] Combining threads to process');
          const threadsToProcess = [
            ...new Set([...threadsAdded, ...lastPage, ...threadsAddLabels, ...threadsRemoveLabels]),
          ];
          log('[ZERO_WORKFLOW] Total threads to process:', threadsToProcess.length);
          return threadsToProcess;
        });

        await step.do(`[ZERO] Send Thread Workflow Instances`, async () => {
          for (const threadId of threadsToProcess) {
            try {
              const isProcessing = await env.gmail_processing_threads.get(threadId.toString());
              if (isProcessing) {
                log('[ZERO_WORKFLOW] Thread already processing:', isProcessing, threadId);
                continue;
              }
              await env.gmail_processing_threads.put(threadId.toString(), 'true');
              const existingInstance = await env.THREAD_WORKFLOW.get(
                `${threadId.toString()}__${connectionId.toString()}`,
              ).catch(() => null);
              if (existingInstance && (await existingInstance.status()).status === 'running') {
                log('[ZERO_WORKFLOW] Thread already processing:', isProcessing, threadId);
                continue;
              }
              const instance = await env.THREAD_WORKFLOW.create({
                id: `${threadId.toString()}__${connectionId.toString()}`,
                params: { connectionId, threadId, providerId: foundConnection.providerId },
              });
              log('[ZERO_WORKFLOW] Created instance:', {
                id: instance.id,
                status: await instance.status(),
              });
              log('[ZERO_WORKFLOW] Sleeping for 4 seconds:', threadId);
              await step.sleep('[ZERO_WORKFLOW]', 4000);
              log('[ZERO_WORKFLOW] Done sleeping:', threadId);
              await env.gmail_processing_threads.delete(threadId.toString());
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
                    cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
                });
              }
              throw error;
            }
          }
        });

        try {
          await env.gmail_processing_threads.delete(historyProcessingKey);
          log('[ZERO_WORKFLOW] Cleared processing flag for history:', historyProcessingKey);
        } catch (cleanupError) {
          log('[ZERO_WORKFLOW] Failed to clear history processing flag:', {
            historyProcessingKey,
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          });
        }
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
          `[ZERO] Find Connection ${connectionId}`,
          async () => {
            log('[THREAD_WORKFLOW] Finding connection:', connectionId);
            const [foundConnection] = await db
              .select()
              .from(connection)
              .where(eq(connection.id, connectionId.toString()));
            this.ctx.waitUntil(conn.end());
            if (!foundConnection) throw new Error(`Connection not found ${connectionId}`);
            if (!foundConnection.accessToken || !foundConnection.refreshToken)
              throw new Error(`Connection is not authorized ${connectionId}`);
            log('[THREAD_WORKFLOW] Found connection:', foundConnection.id);
            return foundConnection;
          },
        );
        const driver = connectionToDriver(foundConnection);
        const thread = await step.do(`[ZERO] Get Thread ${threadId}`, async () => {
          log('[THREAD_WORKFLOW] Getting thread:', threadId);
          const thread = await driver.get(threadId.toString());
          await notifyUser({
            connectionId: connectionId.toString(),
            result: thread,
            threadId: threadId.toString(),
          });
          log('[THREAD_WORKFLOW] Found thread with messages:', thread.messages.length);
          return thread;
        });
        const messagesToVectorize = await step.do(
          `[ZERO] Get Thread Messages ${threadId}`,
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
        const finalEmbeddings: VectorizeVector[] = await step.do(
          `[ZERO] Vectorize Messages`,
          async () => {
            log(
              '[THREAD_WORKFLOW] Starting message vectorization for',
              messagesToVectorize.length,
              'messages',
            );
            return await Promise.all(
              messagesToVectorize.map(async (message) => {
                return step.do(`[ZERO] Vectorize Message ${message.id}`, async () => {
                  log('[THREAD_WORKFLOW] Converting message to XML:', message.id);
                  const prompt = await messageToXML(message);
                  if (!prompt) throw new Error(`Message has no prompt ${message.id}`);
                  log('[THREAD_WORKFLOW] Got XML prompt for message:', message.id);
                  log('[THREAD_WORKFLOW] Message:', message);

                  const SummarizeMessagePrompt = await step.do(
                    `[ZERO] Get Summarize Message Prompt ${message.id}`,
                    async () => {
                      log(
                        '[THREAD_WORKFLOW] Getting summarize prompt for connection:',
                        message.connectionId ?? '',
                        message,
                      );
                      return await getPrompt(
                        getPromptName(message.connectionId ?? '', EPrompts.SummarizeMessage),
                        SummarizeMessage,
                      );
                    },
                  );
                  log('[THREAD_WORKFLOW] Got summarize prompt for message:', message.id);

                  const summary: string = await step.do(
                    `[ZERO] Summarize Message ${message.id}`,
                    async () => {
                      try {
                        log('[THREAD_WORKFLOW] Generating summary for message:', message.id);
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
                        return 'response' in response ? response.response : response;
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
                    `[ZERO] Get Message Embedding Vector ${message.id}`,
                    async () => {
                      try {
                        log('[THREAD_WORKFLOW] Getting embedding vector for message:', message.id);
                        const embeddingVector = await getEmbeddingVector(summary);
                        log('[THREAD_WORKFLOW] Got embedding vector for message:', message.id);
                        return embeddingVector;
                      } catch (error) {
                        log('[THREAD_WORKFLOW] Failed to get embedding vector for message:', {
                          messageId: message.id,
                          error: error instanceof Error ? error.message : String(error),
                        });
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
                });
              }),
            );
          },
        );
        log('[THREAD_WORKFLOW] Generated embeddings for all messages');

        await step.do(
          `[ZERO] Thread Messages Vectors ${threadId} / ${finalEmbeddings.length}`,
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

        const existingThreadSummary = await step.do(
          `[ZERO] Get Thread Summary ${threadId}`,
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

        const finalSummary = await step.do(`[ZERO] Get Final Summary ${threadId}`, async () => {
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
        });

        const userAccountLabels = await step.do(
          `[ZERO] Get user-account labels ${connectionId}`,
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
            `[ZERO] Get user-defined labels ${connectionId}`,
            async () => {
              log('[THREAD_WORKFLOW] Getting user labels for connection:', connectionId);
              let userLabels: { name: string; usecase: string }[] = [];
              const connectionLabels = await env.connection_labels.get(connectionId.toString());
              if (connectionLabels) {
                try {
                  log('[THREAD_WORKFLOW] Parsing existing connection labels');
                  const parsed = JSON.parse(connectionLabels);
                  userLabels = parsed;
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
            `[ZERO] Generate Thread Labels ${threadId} / ${thread.messages.length}`,
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
                    .filter((e: string) =>
                      userLabels.find((label) => label.name.toLowerCase() === e.toLowerCase()),
                    );
                  return labels;
                } else {
                  log('[THREAD_WORKFLOW] No labels generated');
                }
              } catch (error) {
                log('[THREAD_WORKFLOW] Failed to generate labels for thread:', {
                  threadId,
                  error: error instanceof Error ? error.message : String(error),
                });
                throw error;
              }
            },
          );

          if (generatedLabels) {
            await step.do(`[ZERO] Modify Thread Labels ${threadId}`, async () => {
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
            });
          }

          const embeddingVector = await step.do(
            `[ZERO] Get Thread Embedding Vector ${threadId}`,
            async () => {
              log('[THREAD_WORKFLOW] Getting thread embedding vector');
              const embeddingVector = await getEmbeddingVector(finalSummary);
              log('[THREAD_WORKFLOW] Got thread embedding vector');
              return embeddingVector;
            },
          );

          if (!embeddingVector) return console.error('Thread Embedding vector is null');

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
    throw new Error('Failed to extract text from HTML');
  }
}

const messageToXML = async (message: ParsedMessage) => {
  try {
    if (!message.decodedBody) return null;
    const body = await htmlToText(message.decodedBody || '');
    log('[MESSAGE_TO_XML] Body', body);
    if (!body || (body?.length || 20) < 20) {
      log('Skipping message with body length < 20', body);
      return null;
    }
    return `
        <message>
          <from>${message.sender.name}</from>
          ${message.to.map((r) => `<to>${r.email}</to>`).join('')}
          ${message.cc ? message.cc.map((r) => `<cc>${r.email}</cc>`).join('') : ''}
          <date>${message.receivedOn}</date>
          <subject>${message.subject}</subject>
          <body>${body}</body>
        </message>
        `;
  } catch (error) {
    log('[MESSAGE_TO_XML] Failed to convert message to XML:', {
      messageId: message.id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export const getPromptName = (connectionId: string, prompt: EPrompts) => {
  return `${connectionId}-${prompt}`;
};

export const getPrompt = async (promptName: string, fallback: string) => {
  try {
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
    const embeddingResponse = await env.AI.run(
      '@cf/baai/bge-large-en-v1.5',
      { text },
      {
        gateway: {
          id: 'vectorize-save',
        },
      },
    );
    const embeddingVector = embeddingResponse.data[0];
    return embeddingVector ?? null;
  } catch (error) {
    log('[getEmbeddingVector] failed', error);
    return null;
  }
};

const isValidUUID = (string: string) => {
  return z.string().uuid().safeParse(string).success;
};

const getParticipants = (messages: ParsedMessage[]) => {
  const result = new Map<Sender['email'], Sender['name'] | ''>();
  const setIfUnset = (sender: Sender) => {
    if (!result.has(sender.email)) result.set(sender.email, sender.name);
  };
  for (const msg of messages) {
    setIfUnset(msg.sender);
    for (const ccParticipant of msg.cc ?? []) {
      setIfUnset(ccParticipant);
    }
    for (const toParticipant of msg.to) {
      setIfUnset(toParticipant);
    }
  }
  return Array.from(result.entries());
};

const threadToXML = async (messages: ParsedMessage[], existingSummary?: string) => {
  const { subject, title } = messages[0];
  const participants = getParticipants(messages);
  const messagesXML = await Promise.all(messages.map(messageToXML));
  if (existingSummary) {
    return `<thread>
            <title>${title}</title>
            <subject>${subject}</subject>
            <participants>
              ${participants.map(([email, name]) => {
                return `<participant>${name ?? email} ${name ? `< ${email} >` : ''}</participant>`;
              })}
            </participants>
            <existing_summary>
              ${existingSummary}
            </existing_summary>
            <new_messages>
                ${messagesXML.map((e) => e + '\n')}
            </new_messages>
        </thread>`;
  }
  return `<thread>
          <title>${title}</title>
          <subject>${subject}</subject>
          <participants>
            ${participants.map(([email, name]) => {
              return `<participant>${name} < ${email} ></participant>`;
            })}
          </participants>
          <messages>
              ${messagesXML.map((e) => e + '\n')}
          </messages>
      </thread>`;
};

const summarizeThread = async (
  connectionId: string,
  messages: ParsedMessage[],
  existingSummary?: string,
): Promise<string | null> => {
  try {
    if (existingSummary) {
      const prompt = await threadToXML(messages, existingSummary);
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
      return response.response ?? null;
    } else {
      const prompt = await threadToXML(messages, existingSummary);
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
      return response.response ?? null;
    }
  } catch (error) {
    log('[SUMMARIZE_THREAD] Failed to summarize thread:', {
      connectionId,
      messageCount: messages.length,
      hasExistingSummary: !!existingSummary,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};
