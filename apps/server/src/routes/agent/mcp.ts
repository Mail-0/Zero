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

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getThread, getZeroAgent } from '../../lib/server-utils';
import { composeEmail } from '../../trpc/routes/ai/compose';
import { getCurrentDateContext } from '../../lib/prompts';
import { connection } from '../../db/schema';
import { FOLDERS } from '../../lib/utils';
import { env } from 'cloudflare:workers';
import { eq, and } from 'drizzle-orm';
import { McpAgent } from 'agents/mcp';
import { createDb } from '../../db';
import z from 'zod';

export class ZeroMCP extends McpAgent<typeof env, Record<string, unknown>, { userId: string }> {
  server = new McpServer({
    name: 'zero-mcp',
    version: '1.0.0',
    description: 'Zero MCP',
  });

  activeConnectionId: string | undefined;

  async init(): Promise<void> {
    if (!this.props.userId) return;
    const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
    const _connection = await db.query.connection.findFirst({
      where: eq(connection.userId, this.props.userId),
    });
    if (!_connection) {
      throw new Error('Unauthorized');
    }
    this.activeConnectionId = _connection.id;
    this.server.registerTool(
      'getConnections',
      {
        description:
          'Use this tool to get all connections for the user. This helps you know what accounts(connections) the user has available.',
        inputSchema: {},
      },
      async () => {
        const connections = await db.query.connection.findMany({
          where: eq(connection.userId, this.props.userId),
        });
        return {
          content: connections.map((c) => ({
            type: 'text',
            text: `Email: ${c.email} | Provider: ${c.providerId}`,
          })),
        };
      },
    );

    this.server.registerTool(
      'getThreadSummary',
      {
        description: 'Get the summary of a specific email thread',
        inputSchema: {
          id: z.string(),
        },
      },
      async (s) => {
        if (!this.activeConnectionId) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No active connection',
              },
            ],
          };
        }
        const response = await env.VECTORIZE.getByIds([s.id]);
        const { result: thread } = await getThread(this.activeConnectionId, s.id);
        if (response.length && response?.[0]?.metadata?.['summary'] && thread?.latest?.subject) {
          const result = response[0].metadata as { summary: string; connection: string };
          if (result.connection !== this.activeConnectionId) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: 'No summary found for this connection',
                },
              ],
            };
          }
          const shortResponse = await env.AI.run('@cf/facebook/bart-large-cnn', {
            input_text: result.summary,
          });
          return {
            content: [
              {
                type: 'text' as const,
                text: shortResponse.summary as string,
              },
              {
                type: 'text' as const,
                text: `Subject: ${thread.latest?.subject}`,
              },
              {
                type: 'text' as const,
                text: `Sender: ${thread.latest?.sender.name} <${thread.latest?.sender.email}>`,
              },
              {
                type: 'text' as const,
                text: `Date: ${thread.latest?.receivedOn}`,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No summary found',
            },
          ],
        };
      },
    );

    this.server.registerTool(
      'getActiveConnection',
      {
        description: 'Get the currently active email connection',
      },
      async () => {
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
      },
    );

    this.server.registerTool(
      'setActiveConnection',
      {
        description: 'Set the active email connection by email address',
        inputSchema: {
          email: z.string(),
        },
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

    const { stub: agent } = await getZeroAgent(_connection.id);

    this.server.registerTool(
      'composeEmail',
      {
        description: 'Compose an email using AI assistance',
        inputSchema: {
          prompt: z.string(),
          emailSubject: z.string().optional(),
          to: z.array(z.string()).optional(),
          cc: z.array(z.string()).optional(),
          threadMessages: z
            .array(
              z.object({
                from: z.string(),
                to: z.array(z.string()),
                cc: z.array(z.string()).optional(),
                subject: z.string(),
                body: z.string(),
              }),
            )
            .optional(),
        },
      },
      async (data) => {
        if (!this.activeConnectionId) {
          throw new Error('No active connection');
        }
        const newBody = await composeEmail({
          prompt: data.prompt,
          emailSubject: data.emailSubject,
          to: data.to,
          cc: data.cc,
          threadMessages: data.threadMessages,
          username: 'AI Assistant',
          connectionId: this.activeConnectionId,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: newBody,
            },
          ],
        };
      },
    );

    this.server.registerTool(
      'sendEmail',
      {
        description: 'Send a new email',
        inputSchema: {
          to: z.array(
            z.object({
              email: z.string(),
              name: z.string().optional(),
            }),
          ),
          subject: z.string(),
          message: z.string(),
          cc: z
            .array(
              z.object({
                email: z.string(),
                name: z.string().optional(),
              }),
            )
            .optional(),
          bcc: z
            .array(
              z.object({
                email: z.string(),
                name: z.string().optional(),
              }),
            )
            .optional(),
          threadId: z.string().optional(),
          draftId: z.string().optional(),
        },
      },
      async (data) => {
        if (!this.activeConnectionId) {
          throw new Error('No active connection');
        }
        try {
          const { draftId, ...mail } = data;

          if (draftId) {
            await agent.sendDraft(draftId, {
              ...mail,
              attachments: [],
              headers: {},
            });
          } else {
            await agent.create({
              ...mail,
              attachments: [],
              headers: {},
            });
          }

          return {
            content: [
              {
                type: 'text' as const,
                text: 'Email sent successfully',
              },
            ],
          };
        } catch (error) {
          console.error('Error sending email:', error);
          throw new Error(
            'Failed to send email: ' + (error instanceof Error ? error.message : String(error)),
          );
        }
      },
    );

    this.server.registerTool(
      'listThreads',
      {
        description: 'List email threads with optional filters and pagination',
        inputSchema: {
          folder: z.string().default(FOLDERS.INBOX),
          query: z.string().optional(),
          maxResults: z.number().optional().default(5),
          labelIds: z.array(z.string()).optional(),
          pageToken: z.string().optional(),
        },
      },
      async (s) => {
        const result = await agent.rawListThreads({
          folder: s.folder,
          query: s.query,
          maxResults: s.maxResults,
          labelIds: s.labelIds,
          pageToken: s.pageToken,
        });
        const content = await Promise.all(
          result.threads.map(async (thread) => {
            const { result: loadedThread } = await getThread(this.activeConnectionId!, thread.id);
            return [
              {
                type: 'text' as const,
                text: `Subject: ${loadedThread.latest?.subject} | ID: ${thread.id} | Latest Message Received: ${loadedThread.latest?.receivedOn}`,
              },
              {
                type: 'text' as const,
                text: `Latest Message Sender: ${thread.latest?.sender.name} <${thread.latest?.sender.email}>`,
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

    this.server.registerTool(
      'getThread',
      {
        description: 'Get detailed information about a specific email thread',
        inputSchema: {
          threadId: z.string(),
        },
      },
      async (s) => {
        const { result: thread } = await getThread(this.activeConnectionId!, s.threadId);
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
            text: `Latest Message Sender: ${thread.latest?.sender.name} <${thread.latest?.sender.email}>`,
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
        return {
          content: initialResponse,
        };
      },
    );

    this.server.registerTool(
      'markThreadsRead',
      {
        description: 'Mark email threads as read',
        inputSchema: {
          threadIds: z.array(z.string()),
        },
      },
      async (s) => {
        await Promise.all(
          s.threadIds.map((threadId) => agent.modifyThreadLabelsInDB(threadId, [], ['UNREAD'])),
        );
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

    this.server.registerTool(
      'markThreadsUnread',
      {
        description: 'Mark email threads as unread',
        inputSchema: {
          threadIds: z.array(z.string()),
        },
      },
      async (s) => {
        await Promise.all(
          s.threadIds.map((threadId) => agent.modifyThreadLabelsInDB(threadId, ['UNREAD'], [])),
        );
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

    this.server.registerTool(
      'modifyLabels',
      {
        description: 'Add or remove labels from email threads',
        inputSchema: {
          threadIds: z.array(z.string()),
          addLabelIds: z.array(z.string()),
          removeLabelIds: z.array(z.string()),
        },
      },
      async (s) => {
        await Promise.all(
          s.threadIds.map((threadId) =>
            agent.modifyThreadLabelsInDB(threadId, s.addLabelIds, s.removeLabelIds),
          ),
        );
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

    this.server.registerTool(
      'getCurrentDate',
      {
        description: 'Get the current date and time',
        inputSchema: z.object({}).shape,
      },
      async () => {
        return {
          content: [
            {
              type: 'text',
              text: getCurrentDateContext(),
            },
          ],
        };
      },
    );

    this.server.registerTool(
      'getUserLabels',
      { description: 'Get all available labels for the user' },
      async () => {
        const labels = await agent.getUserLabels();
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
      },
    );

    this.server.registerTool(
      'getLabel',
      {
        description: 'Get details about a specific label',
        inputSchema: {
          id: z.string(),
        },
      },
      async (s) => {
        const label = await agent.getLabel(s.id);
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

    this.server.registerTool(
      'createLabel',
      {
        description: 'Create a new email label',
        inputSchema: {
          name: z.string(),
          backgroundColor: z.string().optional(),
          textColor: z.string().optional(),
        },
      },
      async (s) => {
        try {
          await agent.createLabel({
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
          console.error(e);
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
    this.ctx.waitUntil(conn.end());
  }
}
