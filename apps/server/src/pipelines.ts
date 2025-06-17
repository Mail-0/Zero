import {
  ReSummarizeThread,
  SummarizeMessage,
  SummarizeThread,
  ThreadLabels,
} from './lib/brain.fallback.prompts';
import { defaultLabels, EPrompts, EProviders, type ParsedMessage, type Sender } from './types';
import { WorkflowEntrypoint, WorkflowStep, type WorkflowEvent } from 'cloudflare:workers';
import { connectionToDriver } from './lib/server-utils';
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
    await step.do('[MAIN_WORKFLOW] Delete all processing threads', async () => {
      log('[MAIN_WORKFLOW] Deleting all processing threads');
      const processingThreads = await env.gmail_processing_threads.list();
      log('[MAIN_WORKFLOW] Found processing threads:', processingThreads.keys.length);
      for (const threadId of processingThreads.keys) {
        await env.gmail_processing_threads.delete(threadId.name.toString());
      }
      log('[MAIN_WORKFLOW] Deleted all processing threads');
    });
    log('[MAIN_WORKFLOW] Starting workflow with payload:', event.payload);
    const { providerId, historyId, subscriptionName } = event.payload;
    const connectionId = await step.do(
      `[ZERO] Validate Arguments ${providerId} ${subscriptionName} ${historyId}`,
      async () => {
        log('[MAIN_WORKFLOW] Validating arguments');
        const serviceAccount = JSON.parse(env.GOOGLE_S_ACCOUNT);
        const regex = new RegExp(
          `projects/${serviceAccount.project_id}/subscriptions/notifications__([a-z0-9-]+)`,
        );
        const match = subscriptionName.toString().match(regex);
        if (!match) {
          log('[MAIN_WORKFLOW] Invalid subscription name:', subscriptionName);
          throw new Error('Invalid subscription name');
        }
        const [, connectionId] = match;
        log('[MAIN_WORKFLOW] Extracted connectionId:', connectionId);
        const status = await env.subscribed_accounts.get(`${connectionId}__${providerId}`);
        log('[MAIN_WORKFLOW] Connection status:', status);
        if (!status) throw new Error('Connection not found');
        if (status === 'pending') throw new Error('Connection is pending');
        return connectionId;
      },
    );
    if (!connectionId) {
      log('[MAIN_WORKFLOW] Connection id is missing');
      throw new Error('Connection id is required');
    }
    if (!isValidUUID(connectionId)) {
      log('[MAIN_WORKFLOW] Invalid connection id format:', connectionId);
      throw new Error('Invalid connection id');
    }
    if (providerId === EProviders.google) {
      log('[MAIN_WORKFLOW] Processing Google provider workflow');
      await step.do(`[ZERO] Send to Zero Workflow ${connectionId} ${historyId}`, async () => {
        const previousHistoryId = await env.gmail_history_id.get(connectionId);
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
            status: instance.status,
          });
        } else {
          log('[MAIN_WORKFLOW] Creating workflow instance with current history');
          const instance = await env.ZERO_WORKFLOW.create({
            params: {
              connectionId,
              historyId: historyId,
              nextHistoryId: historyId,
            },
          });
          log('[MAIN_WORKFLOW] Created instance:', {
            id: instance.id,
            status: instance.status,
          });
        }
      });
    } else {
      log('[MAIN_WORKFLOW] Unsupported provider:', providerId);
    }
    log('[MAIN_WORKFLOW] Workflow completed successfully');
  }
}

export class ZeroWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(
    event: Readonly<WorkflowEvent<Params<'connectionId' | 'historyId' | 'nextHistoryId'>>>,
    step: WorkflowStep,
  ) {
    log('[ZERO_WORKFLOW] Starting workflow with payload:', event.payload);
    const { connectionId, historyId, nextHistoryId } = event.payload;
    const db = createDb(env.HYPERDRIVE.connectionString);
    const foundConnection = await step.do(`[ZERO] Find Connection ${connectionId}`, async () => {
      log('[ZERO_WORKFLOW] Finding connection:', connectionId);
      const [foundConnection] = await db
        .select()
        .from(connection)
        .where(eq(connection.id, connectionId.toString()));
      if (!foundConnection) throw new Error('Connection not found');
      if (!foundConnection.accessToken || !foundConnection.refreshToken)
        throw new Error('Connection is not authorized');
      log('[ZERO_WORKFLOW] Found connection:', foundConnection.id);
      return foundConnection;
    });

    const driver = connectionToDriver(foundConnection);
    if (foundConnection.providerId === EProviders.google) {
      log('[ZERO_WORKFLOW] Processing Google provider workflow');
      const history = await step.do(
        `[ZERO] Get Gmail History for ${foundConnection.id}`,
        async () => {
          log('[ZERO_WORKFLOW] Getting Gmail history with ID:', historyId);
          const { history } = await driver.listHistory<gmail_v1.Schema$History>(
            historyId.toString(),
          );
          if (!history.length) throw new Error('No history found');
          log('[ZERO_WORKFLOW] Found history entries:', history.length);
          return history;
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

      // TODO: Notify user about new threads

      const lastPage = await step.do('[ZERO] Get last page', async () => {
        log('[ZERO_WORKFLOW] Getting last page of threads');
        const lastThreads = await driver.list({
          folder: 'inbox',
          query: 'NOT is:spam',
          maxResults: 1,
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

      // we send individually to avoid rate limiting
      await step.do(`[ZERO] Send Thread Workflow Instances`, async () => {
        for (const threadId of threadsToProcess) {
          const isProcessing = await env.gmail_processing_threads.get(threadId.toString());
          if (isProcessing) {
            log('[ZERO_WORKFLOW] Thread already processing:', isProcessing, threadId);
            continue;
          }
          await env.gmail_processing_threads.put(threadId.toString(), 'true');
          await env.THREAD_WORKFLOW.create({
            params: { connectionId, threadId, providerId: foundConnection.providerId },
          });
          log('[ZERO_WORKFLOW] Sleeping for 4 seconds:', threadId);
          await step.sleep('[ZERO_WORKFLOW]', 4000);
          log('[ZERO_WORKFLOW] Done sleeping:', threadId);
          await env.gmail_processing_threads.delete(threadId.toString());
        }
      });
    }
  }
}

export class ThreadWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(
    event: Readonly<WorkflowEvent<Params<'connectionId' | 'threadId' | 'providerId'>>>,
    step: WorkflowStep,
  ) {
    log('[THREAD_WORKFLOW] Starting workflow with payload:', event.payload);
    const { connectionId, threadId, providerId } = event.payload;
    if (providerId === EProviders.google) {
      log('[THREAD_WORKFLOW] Processing Google provider workflow');
      const db = createDb(env.HYPERDRIVE.connectionString);
      const foundConnection = await step.do(`[ZERO] Find Connection ${connectionId}`, async () => {
        log('[THREAD_WORKFLOW] Finding connection:', connectionId);
        const [foundConnection] = await db
          .select()
          .from(connection)
          .where(eq(connection.id, connectionId.toString()));
        if (!foundConnection) throw new Error('Connection not found');
        if (!foundConnection.accessToken || !foundConnection.refreshToken)
          throw new Error('Connection is not authorized');
        log('[THREAD_WORKFLOW] Found connection:', foundConnection.id);
        return foundConnection;
      });
      const driver = connectionToDriver(foundConnection);
      const thread = await step.do(`[ZERO] Get Thread ${threadId}`, async () => {
        log('[THREAD_WORKFLOW] Getting thread:', threadId);
        const thread = await driver.get(threadId.toString());
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
                if (!prompt) throw new Error('Message has no prompt');
                log('[THREAD_WORKFLOW] Got XML prompt for message:', message.id);

                const SummarizeMessagePrompt = await step.do(
                  `[ZERO] Get Summarize Message Prompt ${message.id}`,
                  async () => {
                    if (!message.connectionId) throw new Error('Message has no connection id');
                    log(
                      '[THREAD_WORKFLOW] Getting summarize prompt for connection:',
                      message.connectionId,
                    );
                    return await getPrompt(
                      getPromptName(message.connectionId, EPrompts.SummarizeMessage),
                      SummarizeMessage,
                    );
                  },
                );
                log('[THREAD_WORKFLOW] Got summarize prompt for message:', message.id);

                const summary: string = await step.do(
                  `[ZERO] Summarize Message ${message.id}`,
                  async () => {
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
                    log(`[THREAD_WORKFLOW] Summary generated for message ${message.id}:`, response);
                    return 'response' in response ? response.response : response;
                  },
                );

                const embeddingVector = await step.do(
                  `[ZERO] Get Message Embedding Vector ${message.id}`,
                  async () => {
                    log('[THREAD_WORKFLOW] Getting embedding vector for message:', message.id);
                    const embeddingVector = await getEmbeddingVector(summary);
                    log('[THREAD_WORKFLOW] Got embedding vector for message:', message.id);
                    return embeddingVector;
                  },
                );

                if (!embeddingVector) throw new Error('Message Embedding vector is null');

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
          log('[THREAD_WORKFLOW] Upserting message vectors:', finalEmbeddings.length);
          await env.VECTORIZE_MESSAGE.upsert(finalEmbeddings);
          log('[THREAD_WORKFLOW] Successfully upserted message vectors');
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
          const userAccountLabels = await driver.getUserLabels();
          return userAccountLabels;
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
            log('[THREAD_WORKFLOW] Generating labels for thread:', threadId);
            const labelsResponse: any = await env.AI.run(
              '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
              {
                messages: [
                  { role: 'system', content: ThreadLabels(userLabels) },
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

        if (!embeddingVector) throw new Error('Thread Embedding vector is null');

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
      } else {
        log('[THREAD_WORKFLOW] No summary generated for thread', threadId, thread.messages.length);
      }
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
};

export const getPromptName = (connectionId: string, prompt: EPrompts) => {
  return `${connectionId}-${prompt}`;
};

export const getPrompt = async (promptName: string, fallback: string) => {
  const existingPrompt = await env.prompts_storage.get(promptName);
  if (!existingPrompt) {
    await env.prompts_storage.put(promptName, fallback);
    return fallback;
  }
  return existingPrompt;
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
};
