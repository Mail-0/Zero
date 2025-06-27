import { getCurrentDateContext, GmailSearchAssistantSystemPrompt } from '../../lib/prompts';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createDriver } from '../../lib/driver';
import { FOLDERS } from '../../lib/utils';
import { env } from 'cloudflare:workers';
import { openai } from '@ai-sdk/openai';
import { McpAgent } from 'agents/mcp';
import { createDb } from '../../db';
import { generateText } from 'ai';
import { z } from 'zod';

export const getDriverFromConnectionId = async (connectionId: string) => {
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  const activeConnection = await db.query.connection.findFirst({
    where: (connection, ops) => ops.eq(connection.id, connectionId),
    columns: {
      providerId: true,
      userId: true,
      accessToken: true,
      refreshToken: true,
      email: true,
    },
  });

  await conn.end();

  if (!activeConnection || !activeConnection.accessToken || !activeConnection.refreshToken) {
    throw new Error('No connection found');
  }

  return createDriver(activeConnection.providerId, {
    auth: {
      userId: activeConnection.userId,
      accessToken: activeConnection.accessToken,
      refreshToken: activeConnection.refreshToken,
      email: activeConnection.email,
    },
  });
};

export class ZeroMCP extends McpAgent<typeof env, {}, { connectionId: string }> {
  public server = new McpServer({
    name: 'zero-mcp',
    version: '1.0.0',
    description: 'Zero MCP',
  });

  async init(): Promise<void> {
    const driver = await getDriverFromConnectionId(this.props.connectionId);

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
        folder: z.string().default(FOLDERS.INBOX).describe('The folder to list threads from'),
        query: z.string().optional().describe('The query to filter threads by'),
        maxResults: z
          .number()
          .optional()
          .default(5)
          .describe('The maximum number of threads to return'),
        labelIds: z.array(z.string()).optional().describe('The label IDs to filter threads by'),
        pageToken: z.string().optional().describe('The page token to use for pagination'),
      },
      async (s) => {
        console.log('[DEBUG] listThreads', s);

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
        threadId: z.string().describe('The ID of the thread to get'),
      },
      async (s) => {
        console.log('[DEBUG] getThread', s);

        try {
          const thread = await driver.get(s.threadId);

          const content = thread.messages.at(-1)?.body;

          return {
            content: [
              {
                type: 'text',
                text: `Subject:\n\n${thread.latest?.subject}\n\nBody:\n\n${content}`,
              },
            ],
          };

          // const response = await env.VECTORIZE.getByIds([s.threadId]);
          // if (response.length && response?.[0]?.metadata?.['summary']) {
          //   const content = response[0].metadata['summary'] as string;
          //   const shortResponse = await env.AI.run('@cf/facebook/bart-large-cnn', {
          //     input_text: content,
          //   });
          //   return {
          //     content: [
          //       {
          //         type: 'text',
          //         text: shortResponse.summary,
          //       },
          //     ],
          //   };
          // }
          // return {
          //   content: [
          //     {
          //       type: 'text',
          //       text: `Subject: ${thread.latest?.subject}`,
          //     },
          //   ],
          // };
        } catch (error) {
          console.error('[DEBUG] getThread error', error);
          return {
            content: [
              {
                type: 'text',
                text: 'Failed to get thread',
              },
            ],
          };
        }
      },
    );

    this.server.tool(
      'markThreadsRead',
      {
        threadIds: z.array(z.string()).describe('The IDs of the threads to mark as read'),
      },
      async (s) => {
        console.log('[DEBUG] markThreadsRead', s);

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
        threadIds: z.array(z.string()).describe('The IDs of the threads to mark as unread'),
      },
      async (s) => {
        console.log('[DEBUG] markThreadsUnread', s);

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
        threadIds: z.array(z.string()).describe('The IDs of the threads to modify'),
        addLabelIds: z.array(z.string()).describe('The IDs of the labels to add'),
        removeLabelIds: z.array(z.string()).describe('The IDs of the labels to remove'),
      },
      async (s) => {
        console.log('[DEBUG] modifyLabels', s);

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
      console.log('[DEBUG] getCurrentDate');

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
      console.log('[DEBUG] getUserLabels');

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
        id: z.string().describe('The ID of the label to get'),
      },
      async (s) => {
        console.log('[DEBUG] getLabel', s);

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
        name: z.string().describe('The name of the label to create'),
        backgroundColor: z.string().optional().describe('The background color of the label'),
        textColor: z.string().optional().describe('The text color of the label'),
      },
      async (s) => {
        console.log('[DEBUG] createLabel', s);

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
        threadIds: z.array(z.string()).describe('The IDs of the threads to delete'),
      },
      async (s) => {
        console.log('[DEBUG] bulkDelete', s);

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
        threadIds: z.array(z.string()).describe('The IDs of the threads to archive'),
      },
      async (s) => {
        console.log('[DEBUG] bulkArchive', s);

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
