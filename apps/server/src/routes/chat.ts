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
  AiChatPrompt,
  getCurrentDateContext,
  GmailSearchAssistantSystemPrompt,
} from '../lib/prompts';
import { type Connection, type ConnectionContext, type WSMessage } from 'agents';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createSimpleAuth, type SimpleAuth } from '../lib/auth';
import { connectionToDriver } from '../lib/server-utils';
import type { MailManager } from '../lib/driver/types';
import { FOLDERS, parseHeaders } from '../lib/utils';
import { AIChatAgent } from 'agents/ai-chat-agent';
import { tools as authTools } from './agent/tools';
import { processToolCalls } from './agent/utils';
import type { Message as ChatMessage } from 'ai';
import { connection } from '../db/schema';
import { env } from 'cloudflare:workers';
import { openai } from '@ai-sdk/openai';
import { McpAgent } from 'agents/mcp';
import { groq } from '@ai-sdk/groq';
import { eq } from 'drizzle-orm';
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

export class ZeroAgent extends AIChatAgent<typeof env> {
  private chatMessageAbortControllers: Map<string, AbortController> = new Map();
  driver: MailManager | null = null;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  private getDataStreamResponse(
    onFinish: StreamTextOnFinishCallback<{}>,
    options?: {
      abortSignal: AbortSignal | undefined;
    },
  ) {
    const dataStreamResponse = createDataStreamResponse({
      execute: async (dataStream) => {
        const connectionId = (await this.ctx.storage.get('connectionId')) as string;
        if (!connectionId || !this.driver) {
          console.log('Unauthorized no driver or connectionId [1]', connectionId, this.driver);
          await this.setupAuth();
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
          system: AiChatPrompt('', '', ''),
        });

        result.mergeIntoDataStream(dataStream);
      },
    });

    return dataStreamResponse;
  }

  private async setupAuth() {
    if (this.name) {
      const db = createDb(env.HYPERDRIVE.connectionString);
      const _connection = await db.query.connection.findFirst({
        where: eq(connection.id, this.name),
      });
      if (_connection) {
        await this.ctx.storage.put('connectionId', _connection.id);
        this.driver = connectionToDriver(_connection);
      }
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
    await this.setupAuth();
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
}

export class ZeroMCP extends McpAgent<typeof env, {}, { cookie: string }> {
  auth: SimpleAuth;
  server = new McpServer({
    name: 'zero-mcp',
    version: '1.0.0',
    description: 'Zero MCP',
  });

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.auth = createSimpleAuth();
  }

  async init(): Promise<void> {
    const session = await this.auth.api.getSession({ headers: parseHeaders(this.props.cookie) });
    if (!session) {
      throw new Error('Unauthorized');
    }
    const db = createDb(env.HYPERDRIVE.connectionString);
    const _connection = await db.query.connection.findFirst({
      where: eq(connection.email, session.user.email),
    });
    if (!_connection) {
      throw new Error('Unauthorized');
    }
    const driver = connectionToDriver(_connection);

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
                text: `Subject: ${loadedThread.latest?.subject} | ID: ${thread.id} | Received: ${loadedThread.latest?.receivedOn}`,
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
        const response = await env.VECTORIZE.getByIds([s.threadId]);
        if (response.length && response?.[0]?.metadata?.['content']) {
          const content = response[0].metadata['content'] as string;
          const shortResponse = await env.AI.run('@cf/facebook/bart-large-cnn', {
            input_text: content,
          });
          return {
            content: [
              {
                type: 'text',
                text: shortResponse.summary,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: `Subject: ${thread.latest?.subject}`,
            },
          ],
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
