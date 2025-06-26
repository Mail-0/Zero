import {
  streamText,
  generateObject,
  tool,
  type StreamTextOnFinishCallback,
  createDataStreamResponse,
  generateText,
  appendResponseMessages,
} from 'ai';
import {
  getCurrentDateContext,
  GmailSearchAssistantSystemPrompt,
  AiChatPrompt,
} from '../lib/prompts';
import { type Connection, type ConnectionContext, type WSMessage } from 'agents';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createSimpleAuth, type SimpleAuth } from '../lib/auth';
import { EPrompts, type IOutgoingMessage } from '../types';
import { connectionToDriver } from '../lib/server-utils';
import type { MailManager } from '../lib/driver/types';
import type { CreateDraftData } from '../lib/schemas';
import { FOLDERS, parseHeaders } from '../lib/utils';
import { env, RpcTarget } from 'cloudflare:workers';
import { AIChatAgent } from 'agents/ai-chat-agent';
import { tools as authTools } from './agent/tools';
import { processToolCalls } from './agent/utils';
import type { Message as ChatMessage } from 'ai';
import { getPromptName } from '../pipelines';
import { connection } from '../db/schema';
import { getPrompt } from '../lib/brain';
import { openai } from '@ai-sdk/openai';
import { and, eq } from 'drizzle-orm';
import { McpAgent } from 'agents/mcp';
import { groq } from '@ai-sdk/groq';
import { createDb } from '../db';
import { z } from 'zod';

const decoder = new TextDecoder();

export enum IncomingMessageType {
  UseChatRequest = 'cf_agent_use_chat_request',
  ChatClear = 'cf_agent_chat_clear',
  ChatMessages = 'cf_agent_chat_messages',
  ChatRequestCancel = 'cf_agent_chat_request_cancel',
  Mail_List = 'zero_mail_list_threads',
  Mail_Get = 'zero_mail_get_thread',
}

export enum OutgoingMessageType {
  ChatMessages = 'cf_agent_chat_messages',
  UseChatResponse = 'cf_agent_use_chat_response',
  ChatClear = 'cf_agent_chat_clear',
  Mail_List = 'zero_mail_list_threads',
  Mail_Get = 'zero_mail_get_thread',
}

export type IncomingMessage =
  | {
      type: IncomingMessageType.UseChatRequest;
      id: string;
      init: Pick<RequestInit, 'method' | 'headers' | 'body'>;
    }
  | {
      type: IncomingMessageType.ChatClear;
    }
  | {
      type: IncomingMessageType.ChatMessages;
      messages: ChatMessage[];
    }
  | {
      type: IncomingMessageType.ChatRequestCancel;
      id: string;
    }
  | {
      type: IncomingMessageType.Mail_List;
      folder: string;
      query: string;
      maxResults: number;
      labelIds: string[];
      pageToken: string;
    }
  | {
      type: IncomingMessageType.Mail_Get;
      id: string;
    };

export type OutgoingMessage =
  | {
      type: OutgoingMessageType.ChatMessages;
      messages: ChatMessage[];
    }
  | {
      type: OutgoingMessageType.UseChatResponse;
      id: string;
      body: string;
      done: boolean;
    }
  | {
      type: OutgoingMessageType.ChatClear;
    }
  | {
      type: OutgoingMessageType.Mail_List;
      result: {
        threads: {
          id: string;
          historyId: string | null;
        }[];
        nextPageToken: string | null;
      };
    };

export class AgentRpcDO extends RpcTarget {
  constructor(
    private mainDo: ZeroAgent,
    private connectionId: string,
  ) {
    super();
  }

  async getUserLabels() {
    return await this.mainDo.getUserLabels();
  }

  async getLabel(id: string) {
    return await this.mainDo.getLabel(id);
  }

  async createLabel(label: {
    name: string;
    color?: { backgroundColor: string; textColor: string };
  }) {
    return await this.mainDo.createLabel(label);
  }

  async updateLabel(
    id: string,
    label: { name: string; color?: { backgroundColor: string; textColor: string } },
  ) {
    return await this.mainDo.updateLabel(id, label);
  }

  async deleteLabel(id: string) {
    return await this.mainDo.deleteLabel(id);
  }

  async bulkDelete(threadIds: string[]) {
    return await this.mainDo.bulkDelete(threadIds);
  }

  async bulkArchive(threadIds: string[]) {
    return await this.mainDo.bulkArchive(threadIds);
  }

  async buildGmailSearchQuery(query: string) {
    return await this.mainDo.buildGmailSearchQuery(query);
  }

  async listThreads(params: {
    folder: string;
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string;
  }) {
    return await this.mainDo.listThreads(params);
  }

  async getThread(threadId: string) {
    return await this.mainDo.getThread(threadId);
  }

  async markThreadsRead(threadIds: string[]) {
    return await this.mainDo.markThreadsRead(threadIds);
  }

  async markThreadsUnread(threadIds: string[]) {
    return await this.mainDo.markThreadsUnread(threadIds);
  }

  async modifyLabels(threadIds: string[], addLabelIds: string[], removeLabelIds: string[]) {
    return await this.mainDo.modifyLabels(threadIds, addLabelIds, removeLabelIds);
  }

  async createDraft(draftData: CreateDraftData) {
    return await this.mainDo.createDraft(draftData);
  }

  async getDraft(id: string) {
    return await this.mainDo.getDraft(id);
  }

  async listDrafts(params: { q?: string; maxResults?: number; pageToken?: string }) {
    return await this.mainDo.listDrafts(params);
  }

  async count() {
    return await this.mainDo.count();
  }

  async list(params: {
    folder: string;
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string;
  }) {
    return await this.mainDo.list(params);
  }

  async markAsRead(threadIds: string[]) {
    return await this.mainDo.markAsRead(threadIds);
  }

  async markAsUnread(threadIds: string[]) {
    return await this.mainDo.markAsUnread(threadIds);
  }

  async normalizeIds(ids: string[]) {
    return await this.mainDo.normalizeIds(ids);
  }

  async get(id: string) {
    return await this.mainDo.get(id);
  }

  async sendDraft(id: string, data: IOutgoingMessage) {
    return await this.mainDo.sendDraft(id, data);
  }

  async create(data: IOutgoingMessage) {
    return await this.mainDo.create(data);
  }

  async delete(id: string) {
    return await this.mainDo.delete(id);
  }

  async deleteAllSpam() {
    return await this.mainDo.deleteAllSpam();
  }

  async getEmailAliases() {
    return await this.mainDo.getEmailAliases();
  }

  async setupAuth(connectionId: string) {
    return await this.mainDo.setupAuth(connectionId);
  }

  async broadcast(message: string) {
    return this.mainDo.broadcast(message);
  }
}

export class ZeroAgent extends AIChatAgent<typeof env> {
  private chatMessageAbortControllers: Map<string, AbortController> = new Map();
  driver: MailManager | null = null;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async setMetaData(connectionId: string) {
    return new AgentRpcDO(this, connectionId);
  }

  private getDataStreamResponse(
    onFinish: StreamTextOnFinishCallback<{}>,
    options?: {
      abortSignal: AbortSignal | undefined;
    },
  ) {
    const dataStreamResponse = createDataStreamResponse({
      execute: async (dataStream) => {
        const connectionId = this.name;
        if (!connectionId || !this.driver) {
          console.log('Unauthorized no driver or connectionId [1]', connectionId, this.driver);
          await this.setupAuth(connectionId);
          if (!connectionId || !this.driver) {
            console.log('Unauthorized no driver or connectionId', connectionId, this.driver);
            throw new Error('Unauthorized no driver or connectionId [2]');
          }
        }
        const tools = { ...authTools(this.driver, connectionId), buildGmailSearchQuery };
        const processedMessages = await processToolCalls(
          {
            messages: this.messages,
            dataStream,
            tools,
          },
          {},
        );

        const result = streamText({
          model: openai('gpt-4o'),
          messages: processedMessages,
          tools,
          onFinish,
          system: await getPrompt(
            getPromptName(connectionId, EPrompts.Chat),
            AiChatPrompt('', '', ''),
          ),
        });

        result.mergeIntoDataStream(dataStream);
      },
    });

    return dataStreamResponse;
  }

  public async setupAuth(connectionId: string) {
    if (!this.driver) {
      const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
      const _connection = await db.query.connection.findFirst({
        where: eq(connection.id, connectionId),
      });
      if (_connection) this.driver = connectionToDriver(_connection);
      this.ctx.waitUntil(conn.end());
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
        case IncomingMessageType.Mail_List: {
          if (!this.driver) {
            throw new Error('Unauthorized no driver');
          }
          const result = await this.driver.list({
            folder: data.folder,
            query: data.query,
            maxResults: data.maxResults,
          });
          connection.send(
            JSON.stringify({
              type: OutgoingMessageType.Mail_List,
              result,
            }),
          );
        }
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
    return await this.driver.list(params);
  }

  async getThread(threadId: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.get(threadId);
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

  async getUserLabels() {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return (await this.driver.getUserLabels()).filter((label) => label.type === 'user');
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

  async buildGmailSearchQuery(query: string) {
    const result = await generateText({
      model: openai('gpt-4o'),
      system: GmailSearchAssistantSystemPrompt(),
      prompt: query,
    });
    return result.text;
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
    return await this.driver.list(params);
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
    return await this.driver.get(id);
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
}

export class ZeroMCP extends McpAgent<typeof env, {}, { userId: string }> {
  server = new McpServer({
    name: 'zero-mcp',
    version: '1.0.0',
    description: 'Zero MCP',
  });

  activeConnectionId: string | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async init(): Promise<void> {
    const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
    const _connection = await db.query.connection.findFirst({
      where: eq(connection.userId, this.props.userId),
    });
    if (!_connection) {
      throw new Error('Unauthorized');
    }
    this.activeConnectionId = _connection.id;
    const driver = connectionToDriver(_connection);

    this.server.tool('getConnections', async () => {
      const connections = await db.query.connection.findMany({
        where: eq(connection.userId, this.props.userId),
      });
      return {
        content: connections.map((c) => ({
          type: 'text',
          text: `Email: ${c.email} | Provider: ${c.providerId}`,
        })),
      };
    });

    this.server.tool('getActiveConnection', async () => {
      if (!this.activeConnectionId) {
        throw new Error('No active connection');
      }
      const _connection = await db.query.connection.findFirst({
        where: eq(connection.id, this.activeConnectionId),
      });
      if (!_connection) {
        throw new Error('Connection not found');
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: `Email: ${_connection.email} | Provider: ${_connection.providerId}`,
          },
        ],
      };
    });

    this.server.tool(
      'setActiveConnection',
      {
        email: z.string(),
      },
      async (s) => {
        const _connection = await db.query.connection.findFirst({
          where: and(eq(connection.userId, this.props.userId), eq(connection.email, s.email)),
        });
        if (!_connection) {
          throw new Error('Connection not found');
        }
        this.activeConnectionId = _connection.id;
        return {
          content: [
            {
              type: 'text' as const,
              text: `Active connection set to ${_connection.email}`,
            },
          ],
        };
      },
    );

    this.server.tool(
      'buildGmailSearchQuery',
      {
        query: z.string(),
      },
      async (s) => {
        const result = await generateText({
          model: openai('gpt-4o'),
          system: GmailSearchAssistantSystemPrompt(),
          prompt: s.query,
        });
        return {
          content: [
            {
              type: 'text',
              text: result.text,
            },
          ],
        };
      },
    );

    this.server.tool(
      'listThreads',
      {
        folder: z.string().default(FOLDERS.INBOX),
        query: z.string().optional(),
        maxResults: z.number().optional().default(5),
        labelIds: z.array(z.string()).optional(),
        pageToken: z.string().optional(),
      },
      async (s) => {
        const result = await driver.list({
          folder: s.folder,
          query: s.query,
          maxResults: s.maxResults,
          labelIds: s.labelIds,
          pageToken: s.pageToken,
        });
        const content = await Promise.all(
          result.threads.map(async (thread) => {
            const loadedThread = await driver.get(thread.id);
            return [
              {
                type: 'text' as const,
                text: `Subject: ${loadedThread.latest?.subject} | ID: ${thread.id} | Latest Message Received: ${loadedThread.latest?.receivedOn}`,
              },
              {
                type: 'text' as const,
                text: `Latest Message Sender: ${loadedThread.latest?.sender}`,
              },
            ];
          }),
        );
        return {
          content: content.length
            ? content.flat()
            : [
                {
                  type: 'text' as const,
                  text: 'No threads found',
                },
              ],
        };
      },
    );

    this.server.tool(
      'getThread',
      {
        threadId: z.string(),
      },
      async (s) => {
        const thread = await driver.get(s.threadId);
        const initialResponse = [
          {
            type: 'text' as const,
            text: `Subject: ${thread.latest?.subject}`,
          },
          {
            type: 'text' as const,
            text: `Latest Message Received: ${thread.latest?.receivedOn}`,
          },
          {
            type: 'text' as const,
            text: `Latest Message Sender: ${thread.latest?.sender}`,
          },
          {
            type: 'text' as const,
            text: `Latest Message Raw Content: ${thread.latest?.decodedBody}`,
          },
          {
            type: 'text' as const,
            text: `Thread ID: ${s.threadId}`,
          },
        ];
        const response = await env.VECTORIZE.getByIds([s.threadId]);
        if (response.length && response?.[0]?.metadata?.['summary']) {
          const content = response[0].metadata['summary'] as string;
          const shortResponse = await env.AI.run('@cf/facebook/bart-large-cnn', {
            input_text: content,
          });
          return {
            content: [
              ...initialResponse,
              {
                type: 'text',
                text: `Subject: ${thread.latest?.subject}`,
              },
              {
                type: 'text',
                text: `Long Summary: ${content}`,
              },
              {
                type: 'text',
                text: `Short Summary: ${shortResponse.summary}`,
              },
            ],
          };
        }
        return {
          content: initialResponse,
        };
      },
    );

    this.server.tool(
      'markThreadsRead',
      {
        threadIds: z.array(z.string()),
      },
      async (s) => {
        await driver.modifyLabels(s.threadIds, {
          addLabels: [],
          removeLabels: ['UNREAD'],
        });
        return {
          content: [
            {
              type: 'text',
              text: 'Threads marked as read',
            },
          ],
        };
      },
    );

    this.server.tool(
      'markThreadsUnread',
      {
        threadIds: z.array(z.string()),
      },
      async (s) => {
        await driver.modifyLabels(s.threadIds, {
          addLabels: ['UNREAD'],
          removeLabels: [],
        });
        return {
          content: [
            {
              type: 'text',
              text: 'Threads marked as unread',
            },
          ],
        };
      },
    );

    this.server.tool(
      'modifyLabels',
      {
        threadIds: z.array(z.string()),
        addLabelIds: z.array(z.string()),
        removeLabelIds: z.array(z.string()),
      },
      async (s) => {
        await driver.modifyLabels(s.threadIds, {
          addLabels: s.addLabelIds,
          removeLabels: s.removeLabelIds,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Successfully modified ${s.threadIds.length} thread(s)`,
            },
          ],
        };
      },
    );

    this.server.tool('getCurrentDate', async () => {
      return {
        content: [
          {
            type: 'text',
            text: getCurrentDateContext(),
          },
        ],
      };
    });

    this.server.tool('getUserLabels', async () => {
      const labels = await driver.getUserLabels();
      return {
        content: [
          {
            type: 'text',
            text: labels
              .map((label) => `Name: ${label.name} ID: ${label.id} Color: ${label.color}`)
              .join('\n'),
          },
        ],
      };
    });

    this.server.tool(
      'getLabel',
      {
        id: z.string(),
      },
      async (s) => {
        const label = await driver.getLabel(s.id);
        return {
          content: [
            {
              type: 'text',
              text: `Name: ${label.name}`,
            },
            {
              type: 'text',
              text: `ID: ${label.id}`,
            },
          ],
        };
      },
    );

    this.server.tool(
      'createLabel',
      {
        name: z.string(),
        backgroundColor: z.string().optional(),
        textColor: z.string().optional(),
      },
      async (s) => {
        try {
          await driver.createLabel({
            name: s.name,
            color:
              s.backgroundColor && s.textColor
                ? {
                    backgroundColor: s.backgroundColor,
                    textColor: s.textColor,
                  }
                : undefined,
          });
          return {
            content: [
              {
                type: 'text',
                text: 'Label has been created',
              },
            ],
          };
        } catch (e) {
          return {
            content: [
              {
                type: 'text',
                text: 'Failed to create label',
              },
            ],
          };
        }
      },
    );

    this.server.tool(
      'bulkDelete',
      {
        threadIds: z.array(z.string()),
      },
      async (s) => {
        try {
          await driver.modifyLabels(s.threadIds, {
            addLabels: ['TRASH'],
            removeLabels: ['INBOX'],
          });
          return {
            content: [
              {
                type: 'text',
                text: 'Threads moved to trash',
              },
            ],
          };
        } catch (e) {
          return {
            content: [
              {
                type: 'text',
                text: 'Failed to move threads to trash',
              },
            ],
          };
        }
      },
    );

    this.server.tool(
      'bulkArchive',
      {
        threadIds: z.array(z.string()),
      },
      async (s) => {
        try {
          await driver.modifyLabels(s.threadIds, {
            addLabels: [],
            removeLabels: ['INBOX'],
          });
          return {
            content: [
              {
                type: 'text',
                text: 'Threads archived',
              },
            ],
          };
        } catch (e) {
          return {
            content: [
              {
                type: 'text',
                text: 'Failed to archive threads',
              },
            ],
          };
        }
      },
    );
    this.ctx.waitUntil(conn.end());
  }
}

const buildGmailSearchQuery = tool({
  description: 'Build a Gmail search query',
  parameters: z.object({
    query: z.string().describe('The search query to build, provided in natural language'),
  }),
  execute: async ({ query }) => {
    const result = await generateObject({
      model: openai('gpt-4o'),
      system: GmailSearchAssistantSystemPrompt(),
      prompt: query,
      schema: z.object({
        query: z.string(),
      }),
    });
    return result.object;
  },
});
