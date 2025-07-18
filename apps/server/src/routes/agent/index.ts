/*
 * Licensed to Zero Email Inc. under one or more contributor license agreements.
 * You may not use this file except in compliance with the Apache License, Version 2.0 (the "License").
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Reuse or distribution of this file requires a license from Zero Email Inc.
 */

import {
  type StreamTextOnFinishCallback,
  createDataStreamResponse,
  streamText,
  appendResponseMessages,
} from 'ai';
import {
  IncomingMessageType,
  OutgoingMessageType,
  type IncomingMessage,
  type OutgoingMessage,
} from './types';
import { DurableObjectOAuthClientProvider } from 'agents/mcp/do-oauth-client-provider';
import { EPrompts, type IOutgoingMessage, type ParsedMessage } from '../../types';
import type { MailManager, IGetThreadResponse } from '../../lib/driver/types';
import { connectionToDriver } from '../../lib/server-utils';
import type { CreateDraftData } from '../../lib/schemas';
import type { Connection, WSMessage } from 'partyserver';
import { withRetry } from '../../lib/gmail-rate-limit';
import { getPrompt } from '../../pipelines.effect';
import { AIChatAgent } from 'agents/ai-chat-agent';
import { ToolOrchestrator } from './orchestrator';
import { AiChatPrompt } from '../../lib/prompts';
import { getPromptName } from '../../pipelines';
import { anthropic } from '@ai-sdk/anthropic';
import { connection } from '../../db/schema';
import { tools as authTools } from './tools';
import { processToolCalls } from './utils';
import { env } from 'cloudflare:workers';
import { createDb } from '../../db';
import { AgentRpcDO } from './rpc';
import { eq } from 'drizzle-orm';
import { Effect } from 'effect';
const decoder = new TextDecoder();

const shouldDropTables = env.DROP_AGENT_TABLES === 'true';
const maxCount = parseInt(env.THREAD_SYNC_MAX_COUNT || '10', 10);
const shouldLoop = env.THREAD_SYNC_LOOP !== 'false';

export class ZeroAgent extends AIChatAgent<typeof env> {
  private chatMessageAbortControllers: Map<string, AbortController> = new Map();
  private foldersInSync: Map<string, boolean> = new Map();
  private syncThreadsInProgress: Map<string, boolean> = new Map();
  private currentFolder: string | null = 'inbox';
  driver: MailManager | null = null;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    if (shouldDropTables) this.dropTables();
    this.sql`
        CREATE TABLE IF NOT EXISTS threads (
            id TEXT PRIMARY KEY,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            thread_id TEXT NOT NULL,
            provider_id TEXT NOT NULL,
            latest_sender TEXT,
            latest_received_on TEXT,
            latest_subject TEXT,
            latest_label_ids TEXT,
            categories TEXT
        );
    `;
  }

  async dropTables() {
    return this.sql`       
        DROP TABLE IF EXISTS threads;`;
  }

  async setMetaData(connectionId: string) {
    await this.setName(connectionId);
    return new AgentRpcDO(this, connectionId);
  }

  async registerZeroMCP() {
    await this.mcp.connect(env.VITE_PUBLIC_BACKEND_URL + '/sse', {
      transport: {
        authProvider: new DurableObjectOAuthClientProvider(
          this.ctx.storage,
          'zero-mcp',
          env.VITE_PUBLIC_BACKEND_URL,
        ),
      },
    });
  }

  onStart(): void | Promise<void> {
    // this.registerZeroMCP();
  }

  private getDataStreamResponse(
    onFinish: StreamTextOnFinishCallback<{}>,
    _?: {
      abortSignal: AbortSignal | undefined;
    },
  ) {
    const dataStreamResponse = createDataStreamResponse({
      execute: async (dataStream) => {
        const connectionId = this.name;
        if (connectionId === 'general') return;
        if (!connectionId || !this.driver) {
          console.log('Unauthorized no driver or connectionId [1]', connectionId, this.driver);
          await this.setupAuth(connectionId);
          if (!connectionId || !this.driver) {
            console.log('Unauthorized no driver or connectionId', connectionId, this.driver);
            throw new Error('Unauthorized no driver or connectionId [2]');
          }
        }
        const orchestrator = new ToolOrchestrator(dataStream, connectionId);
        // const mcpTools = await this.mcp.unstable_getAITools();

        const rawTools = {
          ...(await authTools(this, connectionId)),
        };
        const tools = orchestrator.processTools({});
        const processedMessages = await processToolCalls(
          {
            messages: this.messages,
            dataStream,
            tools,
          },
          {},
        );

        const result = streamText({
          model: anthropic(env.OPENAI_MODEL || 'claude-3-5-haiku-latest'),
          maxSteps: 10,
          messages: processedMessages,
          tools: rawTools,
          onFinish,
          onError: (error) => {
            console.error('Error in streamText', error);
          },
          system: await getPrompt(getPromptName(connectionId, EPrompts.Chat), AiChatPrompt('')),
        });

        result.mergeIntoDataStream(dataStream);
      },
    });

    return dataStreamResponse;
  }

  public async setupAuth(connectionId: string) {
    if (connectionId === 'general') return;
    if (!this.driver) {
      const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
      const _connection = await db.query.connection.findFirst({
        where: eq(connection.id, connectionId),
      });
      if (_connection) this.driver = connectionToDriver(_connection);
      this.ctx.waitUntil(conn.end());
      this.ctx.waitUntil(this.syncThreads('inbox'));
      this.ctx.waitUntil(this.syncThreads('sent'));
      this.ctx.waitUntil(this.syncThreads('spam'));
      this.ctx.waitUntil(this.syncThreads('archive'));
    }
  }

  private async tryCatchChat<T>(fn: () => T | Promise<T>) {
    try {
      return await fn();
    } catch (e) {
      throw this.onError(e);
    }
  }

  private getAbortSignal(id: string): AbortSignal | undefined {
    // Defensive check, since we're coercing message types at the moment
    if (typeof id !== 'string') {
      return undefined;
    }

    if (!this.chatMessageAbortControllers.has(id)) {
      this.chatMessageAbortControllers.set(id, new AbortController());
    }

    return this.chatMessageAbortControllers.get(id)?.signal;
  }

  /**
   * Remove an abort controller from the cache of pending message responses
   */
  private removeAbortController(id: string) {
    this.chatMessageAbortControllers.delete(id);
  }

  private broadcastChatMessage(message: OutgoingMessage, exclude?: string[]) {
    this.broadcast(JSON.stringify(message), exclude);
  }

  private cancelChatRequest(id: string) {
    if (this.chatMessageAbortControllers.has(id)) {
      const abortController = this.chatMessageAbortControllers.get(id);
      abortController?.abort();
    }
  }

  async onMessage(connection: Connection, message: WSMessage) {
    if (typeof message === 'string') {
      let data: IncomingMessage;
      try {
        data = JSON.parse(message) as IncomingMessage;
      } catch (error) {
        console.warn(error);
        // silently ignore invalid messages for now
        // TODO: log errors with log levels
        return;
      }
      switch (data.type) {
        case IncomingMessageType.UseChatRequest: {
          if (data.init.method !== 'POST') break;

          const { body } = data.init;

          const { messages } = JSON.parse(body as string);
          this.broadcastChatMessage(
            {
              type: OutgoingMessageType.ChatMessages,
              messages,
            },
            [connection.id],
          );
          await this.persistMessages(messages, [connection.id]);

          const chatMessageId = data.id;
          const abortSignal = this.getAbortSignal(chatMessageId);

          return this.tryCatchChat(async () => {
            const response = await this.onChatMessage(
              async ({ response }) => {
                const finalMessages = appendResponseMessages({
                  messages,
                  responseMessages: response.messages,
                });

                await this.persistMessages(finalMessages, [connection.id]);
                this.removeAbortController(chatMessageId);
              },
              abortSignal ? { abortSignal } : undefined,
            );

            if (response) {
              await this.reply(data.id, response);
            } else {
              console.warn(
                `[AIChatAgent] onChatMessage returned no response for chatMessageId: ${chatMessageId}`,
              );
              this.broadcastChatMessage(
                {
                  id: data.id,
                  type: OutgoingMessageType.UseChatResponse,
                  body: 'No response was generated by the agent.',
                  done: true,
                },
                [connection.id],
              );
            }
          });
        }
        case IncomingMessageType.ChatClear: {
          this.destroyAbortControllers();
          this.sql`delete from cf_ai_chat_agent_messages`;
          this.messages = [];
          this.broadcastChatMessage(
            {
              type: OutgoingMessageType.ChatClear,
            },
            [connection.id],
          );
          break;
        }
        case IncomingMessageType.ChatMessages: {
          await this.persistMessages(data.messages, [connection.id]);
          break;
        }
        case IncomingMessageType.ChatRequestCancel: {
          this.cancelChatRequest(data.id);
          break;
        }
        // case IncomingMessageType.Mail_List: {
        //   const result = await this.getThreadsFromDB({
        //     labelIds: data.labelIds,
        //     folder: data.folder,
        //     q: data.query,
        //     max: data.maxResults,
        //     cursor: data.pageToken,
        //   });
        //   this.currentFolder = data.folder;
        //   connection.send(
        //     JSON.stringify({
        //       type: OutgoingMessageType.Mail_List,
        //       result,
        //     }),
        //   );
        //   break;
        // }
        // case IncomingMessageType.Mail_Get: {
        //   const result = await this.getThreadFromDB(data.threadId);
        //   connection.send(
        //     JSON.stringify({
        //       type: OutgoingMessageType.Mail_Get,
        //       result,
        //       threadId: data.threadId,
        //     }),
        //   );
        //   break;
        // }
      }
    }
  }

  private async reply(id: string, response: Response) {
    // now take chunks out from dataStreamResponse and send them to the client
    return this.tryCatchChat(async () => {
      for await (const chunk of response.body!) {
        const body = decoder.decode(chunk);

        this.broadcastChatMessage({
          id,
          type: OutgoingMessageType.UseChatResponse,
          body,
          done: false,
        });
      }

      this.broadcastChatMessage({
        id,
        type: OutgoingMessageType.UseChatResponse,
        body: '',
        done: true,
      });
    });
  }

  async onConnect() {
    await this.setupAuth(this.name);
  }

  private destroyAbortControllers() {
    for (const controller of this.chatMessageAbortControllers.values()) {
      controller?.abort();
    }
    this.chatMessageAbortControllers.clear();
  }

  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<{}>,
    options?: {
      abortSignal: AbortSignal | undefined;
    },
  ) {
    return this.getDataStreamResponse(onFinish, options);
  }

  async listThreads(params: {
    folder: string;
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string;
  }) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.getThreadsFromDB(params);
  }

  async rawListThreads(params: {
    folder: string;
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string;
  }) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.list(params);
  }

  async getThread(threadId: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.getThreadFromDB(threadId);
  }

  async markThreadsRead(threadIds: string[]) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.modifyLabels(threadIds, {
      addLabels: [],
      removeLabels: ['UNREAD'],
    });
  }

  async markThreadsUnread(threadIds: string[]) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.modifyLabels(threadIds, {
      addLabels: ['UNREAD'],
      removeLabels: [],
    });
  }

  async modifyLabels(threadIds: string[], addLabelIds: string[], removeLabelIds: string[]) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.modifyLabels(threadIds, {
      addLabels: addLabelIds,
      removeLabels: removeLabelIds,
    });
  }

  async listHistory<T>(historyId: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.listHistory<T>(historyId);
  }

  async getUserLabels() {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.getUserLabels();
  }

  async getLabel(id: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.getLabel(id);
  }

  async createLabel(params: {
    name: string;
    color?: {
      backgroundColor: string;
      textColor: string;
    };
  }) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.createLabel(params);
  }

  async bulkDelete(threadIds: string[]) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.modifyLabels(threadIds, {
      addLabels: ['TRASH'],
      removeLabels: ['INBOX'],
    });
  }

  async bulkArchive(threadIds: string[]) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.modifyLabels(threadIds, {
      addLabels: [],
      removeLabels: ['INBOX'],
    });
  }

  async updateLabel(
    id: string,
    label: { name: string; color?: { backgroundColor: string; textColor: string } },
  ) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.updateLabel(id, label);
  }

  async deleteLabel(id: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.deleteLabel(id);
  }

  async createDraft(draftData: CreateDraftData) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.createDraft(draftData);
  }

  async getDraft(id: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.getDraft(id);
  }

  async listDrafts(params: { q?: string; maxResults?: number; pageToken?: string }) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.listDrafts(params);
  }

  // Additional mail operations
  async count() {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.count();
  }

  async list(params: {
    folder: string;
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string;
  }) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.getThreadsFromDB(params);
  }

  async markAsRead(threadIds: string[]) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.markAsRead(threadIds);
  }

  async markAsUnread(threadIds: string[]) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.markAsUnread(threadIds);
  }

  async normalizeIds(ids: string[]) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return this.driver.normalizeIds(ids);
  }

  async get(id: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.getThreadFromDB(id);
  }

  async sendDraft(id: string, data: IOutgoingMessage) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.sendDraft(id, data);
  }

  async create(data: IOutgoingMessage) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.create(data);
  }

  async delete(id: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.delete(id);
  }

  async deleteAllSpam() {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.deleteAllSpam();
  }

  async getEmailAliases() {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.getEmailAliases();
  }

  async getMessageAttachments(messageId: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.getMessageAttachments(messageId);
  }

  async getThreadCount() {
    const count = this.sql`SELECT COUNT(*) FROM threads`;
    return count[0]['COUNT(*)'] as number;
  }

  async syncThread({ threadId }: { threadId: string }) {
    if (this.name === 'general') return;
    if (!this.driver) {
      await this.setupAuth(this.name);
    }

    if (!this.driver) {
      console.error('No driver available for syncThread');
      throw new Error('No driver available');
    }

    if (this.syncThreadsInProgress.has(threadId)) {
      console.log(`Sync already in progress for thread ${threadId}, skipping...`);
      return;
    }
    this.syncThreadsInProgress.set(threadId, true);

    console.log('Server: syncThread called for thread', threadId);
    try {
      const threadData = await this.getWithRetry(threadId);
      const latest = threadData.latest;

      if (latest) {
        // Convert receivedOn to ISO format for proper sorting
        const normalizedReceivedOn = new Date(latest.receivedOn).toISOString();

        await env.THREADS_BUCKET.put(this.getThreadKey(threadId), JSON.stringify(threadData), {
          customMetadata: {
            threadId,
          },
        });

        this.sql`
          INSERT OR REPLACE INTO threads (
            id, 
            thread_id, 
            provider_id,  
            latest_sender, 
            latest_received_on, 
            latest_subject, 
            latest_label_ids,
            updated_at
          ) VALUES (
            ${threadId},
            ${threadId},
            'google',
            ${JSON.stringify(latest.sender)},
            ${normalizedReceivedOn},
            ${latest.subject},
            ${JSON.stringify(latest.tags.map((tag) => tag.id))},
            CURRENT_TIMESTAMP
          )
        `;
        if (this.currentFolder === 'inbox') {
          this.broadcastChatMessage({
            type: OutgoingMessageType.Mail_Get,
            threadId,
          });
        }
        this.syncThreadsInProgress.delete(threadId);
        console.log('Server: syncThread result', {
          threadId,
          labels: threadData.labels,
        });
        return { success: true, threadId, threadData };
      } else {
        this.syncThreadsInProgress.delete(threadId);
        console.log(`Skipping thread ${threadId} - no latest message`);
        return { success: false, threadId, reason: 'No latest message' };
      }
    } catch (error) {
      this.syncThreadsInProgress.delete(threadId);
      console.error(`Failed to sync thread ${threadId}:`, error);
      throw error;
    }
  }

  getThreadKey(threadId: string) {
    return `${this.name}/${threadId}.json`;
  }

  private async listWithRetry(params: Parameters<MailManager['list']>[0]) {
    if (!this.driver) throw new Error('No driver available');

    return Effect.runPromise(withRetry(Effect.tryPromise(() => this.driver!.list(params))));
  }

  private async getWithRetry(threadId: string): Promise<IGetThreadResponse> {
    if (!this.driver) throw new Error('No driver available');

    return Effect.runPromise(withRetry(Effect.tryPromise(() => this.driver!.get(threadId))));
  }

  async *streamThreads(folder: string) {
    let pageToken: string | null = null;
    let hasMore = true;
    let _pageCount = 0;

    while (hasMore) {
      _pageCount++;

      // Rate limiting delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const result = await this.listWithRetry({
        folder,
        maxResults: maxCount, // Smaller batches for streaming
        pageToken: pageToken || undefined,
      });

      // Stream each thread individually
      for (const thread of result.threads) {
        yield thread;
      }

      pageToken = result.nextPageToken;
      hasMore = pageToken !== null && shouldLoop;
    }
  }

  async syncThreads(folder: string) {
    if (!this.driver) {
      console.error('No driver available for syncThreads');
      throw new Error('No driver available');
    }

    if (this.foldersInSync.has(folder)) {
      console.log('Sync already in progress, skipping...');
      return { synced: 0, message: 'Sync already in progress' };
    }

    const threadCount = await this.getThreadCount();
    if (threadCount >= maxCount && !shouldLoop) {
      console.log('Threads already synced, skipping...');
      return { synced: 0, message: 'Threads already synced' };
    }

    this.foldersInSync.set(folder, true);

    try {
      let totalSynced = 0;

      // Process threads one by one without buffering
      for await (const thread of this.streamThreads(folder)) {
        try {
          const id = await this.queue('syncThread', thread.id);
          console.log(`Synced thread ${thread.id} to queue ${id}`);
          totalSynced++;
        } catch (error) {
          console.error(`Failed to sync thread ${thread.id}:`, error);
        }

        // // Broadcast progress after each thread
        // this.broadcastChatMessage({
        //   type: OutgoingMessageType.Mail_List,
        //   folder,
        // });
      }

      return { synced: totalSynced };
    } catch (error) {
      console.error('Failed to sync inbox threads:', error);
      throw error;
    } finally {
      console.log('Setting isSyncing to false');
      this.foldersInSync.delete(folder);
      this.broadcastChatMessage({
        type: OutgoingMessageType.Mail_List,
        folder,
      });
    }
  }

  async inboxRag(query: string) {
    if (!env.AUTORAG_ID) return { result: 'Not enabled', data: [] };
    const answer = await env.AI.autorag(env.AUTORAG_ID).aiSearch({
      query: query,
      //   rewrite_query: true,
      max_num_results: 3,
      ranking_options: {
        score_threshold: 0.3,
      },
      //   stream: true,
      filters: {
        type: 'eq',
        key: 'folder',
        value: `${this.name}/`,
      },
    });
    return { result: answer.response, data: answer.data };
  }

  async searchThreads(params: {
    query: string;
    folder?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string;
  }) {
    const { query, folder = 'inbox', maxResults = 50, labelIds = [], pageToken } = params;

    if (!this.driver) {
      throw new Error('No driver available');
    }

    // Create parallel Effect operations
    const ragEffect = Effect.tryPromise(() =>
      this.inboxRag(query).then((rag) => {
        const ids = rag?.data?.map((d) => d.attributes.threadId).filter(Boolean) ?? [];
        return ids.slice(0, maxResults);
      }),
    ).pipe(Effect.catchAll(() => Effect.succeed([])));

    const rawEffect = Effect.tryPromise(() =>
      this.driver!.list({
        folder,
        query,
        labelIds,
        maxResults,
        pageToken,
      }).then((r) => r.threads.map((t) => t.id)),
    ).pipe(Effect.catchAll(() => Effect.succeed([])));

    // Run both in parallel and wait for results
    const results = await Effect.runPromise(
      Effect.all([ragEffect, rawEffect], { concurrency: 'unbounded' }),
    );

    const [ragIds, rawIds] = results;

    // Return InboxRag results if found, otherwise fallback to raw
    if (ragIds.length > 0) {
      return {
        threadIds: ragIds,
        source: 'autorag' as const,
      };
    }

    return {
      threadIds: rawIds,
      source: 'raw' as const,
      nextPageToken: pageToken,
    };
  }

  async getThreadsFromDB(params: {
    labelIds?: string[];
    folder?: string;
    q?: string;
    maxResults?: number;
    pageToken?: string;
  }) {
    const { labelIds = [], folder, q, maxResults = 50, pageToken } = params;

    try {
      // Build WHERE conditions
      const whereConditions: string[] = [];

      // Add folder condition (maps to specific label)
      if (folder) {
        const folderLabel = folder.toUpperCase();
        whereConditions.push(`EXISTS (
            SELECT 1 FROM json_each(latest_label_ids) WHERE value = '${folderLabel}'
          )`);
      }

      // Add label conditions (OR logic for multiple labels)
      if (labelIds.length > 0) {
        if (labelIds.length === 1) {
          whereConditions.push(`EXISTS (
              SELECT 1 FROM json_each(latest_label_ids) WHERE value = '${labelIds[0]}'
            )`);
        } else {
          // Multiple labels with OR logic
          const multiLabelCondition = labelIds
            .map(
              (labelId) =>
                `EXISTS (SELECT 1 FROM json_each(latest_label_ids) WHERE value = '${labelId}')`,
            )
            .join(' OR ');
          whereConditions.push(`(${multiLabelCondition})`);
        }
      }

      //   // Add search query condition
      if (q) {
        const searchTerm = q.replace(/'/g, "''"); // Escape single quotes
        whereConditions.push(`(
            latest_subject LIKE '%${searchTerm}%' OR
            latest_sender LIKE '%${searchTerm}%'
          )`);
      }

      // Add cursor condition
      if (pageToken) {
        whereConditions.push(`latest_received_on < '${pageToken}'`);
      }

      // Execute query based on conditions
      let result;

      if (whereConditions.length === 0) {
        // No conditions
        result = await this.sql`
            SELECT id, latest_received_on
            FROM threads
            ORDER BY latest_received_on DESC
            LIMIT ${maxResults}
          `;
      } else if (whereConditions.length === 1) {
        // Single condition
        const condition = whereConditions[0];
        if (condition.includes('latest_received_on <')) {
          const cursorValue = pageToken!;
          result = await this.sql`
              SELECT id, latest_received_on
              FROM threads
              WHERE latest_received_on < ${cursorValue}
              ORDER BY latest_received_on DESC
              LIMIT ${maxResults}
            `;
        } else if (folder) {
          // Folder condition
          const folderLabel = folder.toUpperCase();
          result = await this.sql`
              SELECT id, latest_received_on
              FROM threads
              WHERE EXISTS (
                SELECT 1 FROM json_each(latest_label_ids) WHERE value = ${folderLabel}
              )
              ORDER BY latest_received_on DESC
              LIMIT ${maxResults}
            `;
        } else {
          // Single label condition
          const labelId = labelIds[0];
          result = await this.sql`
              SELECT id, latest_received_on
              FROM threads
              WHERE EXISTS (
                SELECT 1 FROM json_each(latest_label_ids) WHERE value = ${labelId}
              )
              ORDER BY latest_received_on DESC
              LIMIT ${maxResults}
            `;
        }
      } else {
        // Multiple conditions - handle combinations
        if (folder && labelIds.length === 0 && pageToken) {
          // Folder + cursor
          const folderLabel = folder.toUpperCase();
          result = await this.sql`
              SELECT id, latest_received_on
              FROM threads
              WHERE EXISTS (
                SELECT 1 FROM json_each(latest_label_ids) WHERE value = ${folderLabel}
              ) AND latest_received_on < ${pageToken}
              ORDER BY latest_received_on DESC
              LIMIT ${maxResults}
            `;
        } else if (labelIds.length === 1 && pageToken && !folder) {
          // Single label + cursor
          const labelId = labelIds[0];
          result = await this.sql`
              SELECT id, latest_received_on
              FROM threads
              WHERE EXISTS (
                SELECT 1 FROM json_each(latest_label_ids) WHERE value = ${labelId}
              ) AND latest_received_on < ${pageToken}
              ORDER BY latest_received_on DESC
              LIMIT ${maxResults}
            `;
        } else {
          // For now, fallback to just cursor if complex combinations
          const cursorValue = pageToken || '';
          result = await this.sql`
              SELECT id, latest_received_on
              FROM threads
              WHERE latest_received_on < ${cursorValue}
              ORDER BY latest_received_on DESC
              LIMIT ${maxResults}
            `;
        }
      }

      const threads = result.map((row: any) => ({
        id: row.id,
        historyId: null,
      }));

      // Use latest_received_on for pagination cursor
      const nextPageToken =
        threads.length === maxResults && result.length > 0
          ? result[result.length - 1].latest_received_on
          : null;

      return {
        threads,
        nextPageToken,
      };
    } catch (error) {
      console.error('Failed to get threads from database:', error);
      throw error;
    }
  }

  async getThreadFromDB(id: string, lastAttempt = false): Promise<IGetThreadResponse> {
    try {
      const result = this.sql`
          SELECT
            id,
            thread_id,
            provider_id,
            latest_sender,
            latest_received_on,
            latest_subject,
            latest_label_ids,
            created_at,
            updated_at
          FROM threads
          WHERE id = ${id}
          LIMIT 1
        `;

      if (!result || result.length === 0) {
        if (lastAttempt) {
          throw new Error('Thread not found in database, Sync Failed once');
        }
        await this.syncThread({ threadId: id });
        return this.getThreadFromDB(id, true);
      }
      const row = result[0] as any;
      const storedThread = await env.THREADS_BUCKET.get(this.getThreadKey(id));

      const messages: ParsedMessage[] = storedThread
        ? (JSON.parse(await storedThread.text()) as IGetThreadResponse).messages
        : [];

      const latestLabelIds = JSON.parse(row.latest_label_ids || '[]');

      return {
        messages,
        latest: messages.findLast((e) => e.isDraft !== true),
        hasUnread: latestLabelIds.includes('UNREAD'),
        totalReplies: messages.filter((e) => e.isDraft !== true).length,
        labels: latestLabelIds.map((id: string) => ({ id, name: id })),
      } satisfies IGetThreadResponse;
    } catch (error) {
      console.error('Failed to get thread from database:', error);
      throw error;
    }
  }
}
