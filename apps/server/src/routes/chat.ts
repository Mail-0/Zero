import {
  streamText,
  generateObject,
  tool,
  type StreamTextOnFinishCallback,
  createDataStreamResponse,
  generateText,
} from 'ai';
import {
  AiChatPrompt,
  getCurrentDateContext,
  GmailSearchAssistantSystemPrompt,
} from '../lib/prompts';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Connection, type ConnectionContext } from 'agents';
import { createSimpleAuth, type SimpleAuth } from '../lib/auth';
import { connectionToDriver } from '../lib/server-utils';
import type { MailManager } from '../lib/driver/types';
import { FOLDERS, parseHeaders } from '../lib/utils';
import { AIChatAgent } from 'agents/ai-chat-agent';
import { tools as authTools } from './agent/tools';
import { processToolCalls } from './agent/utils';
import { connection } from '../db/schema';
import { env } from 'cloudflare:workers';
import { openai } from '@ai-sdk/openai';
import { McpAgent } from 'agents/mcp';
import { eq } from 'drizzle-orm';
import { createDb } from '../db';
import { z } from 'zod';

export class ZeroAgent extends AIChatAgent<typeof env> {
  auth: SimpleAuth;
  driver: MailManager | null = null;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.auth = createSimpleAuth();
  }

  private getDataStreamResponse(onFinish: StreamTextOnFinishCallback<{}>) {
    const dataStreamResponse = createDataStreamResponse({
      execute: async (dataStream) => {
        const connectionId = (await this.ctx.storage.get('connectionId')) as string;
        if (!connectionId || !this.driver) {
          console.log('Unauthorized no driver or connectionId');
          throw new Error('Unauthorized');
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

  //   async onRequest(request: Request): Promise<Response> {
  //     const token = request.headers.get('cookie');
  //     if (!token) {
  //       return new Response('Unauthorized', { status: 401 });
  //     }
  //     await this.setupAuth(token);
  //     return this.getDataStreamResponse(() => {});
  //   }

  private async getSession(token: string) {
    const session = await this.auth.api.getSession({ headers: parseHeaders(token) });
    return session;
  }

  private async setupAuth(token: string) {
    if (token) {
      const session = await this.getSession(token);
      if (session) {
        const db = createDb(env.HYPERDRIVE.connectionString);
        const _connection = await db.query.connection.findFirst({
          where: eq(connection.email, session.user.email),
        });
        if (_connection) {
          await this.ctx.storage.put('connectionId', _connection.id);
          this.driver = connectionToDriver(_connection);
          this.setName(session.user.email);
        }
        console.log('session exists', session.user.email);
      } else {
        console.log('No session', token);
      }
    }
  }

  async onConnect(_: Connection, ctx: ConnectionContext) {
    const token = ctx.request.headers.get('Cookie');
    if (!token) {
      console.log('no token found, checking driver');
      if (!this.driver || !this.ctx.storage.get('connectionId')) {
        console.log('Unauthorized no token and no driver');
        throw new Error('Unauthorized');
      }
    } else {
      console.log('token found, setting up auth');
      await this.setupAuth(token);
    }
  }

  async onChatMessage(onFinish: StreamTextOnFinishCallback<{}>) {
    return this.getDataStreamResponse(onFinish);
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
                text: loadedThread.latest?.subject ?? '',
              },
              {
                type: 'text' as const,
                text: `ThreadId: ${thread.id}`,
              },
            ];
          }),
        );
        return {
          content: content.flat(),
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
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(thread),
            },
            {
              type: 'text',
              text: `Subject: ${thread.latest?.subject}`,
            },
            {
              type: 'text',
              text: `Total Messages: ${thread.totalReplies}`,
            },
            {
              type: 'text',
              text: `ThreadId: ${s.threadId}`,
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
