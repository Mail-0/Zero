import { getCurrentDateContext, GmailSearchAssistantSystemPrompt } from '../lib/prompts';
import { getDriverFromConnectionId } from '../services/mcp-service/mcp';
import { systemPrompt } from '../services/call-service/system-prompt';
import { composeEmail } from '../trpc/routes/ai/compose';
import { connectionToDriver } from '../lib/server-utils';
import { env } from 'cloudflare:workers';
import { openai } from '@ai-sdk/openai';
import { FOLDERS } from '../lib/utils';
import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { Tools } from '../types';
import { createDb } from '../db';
import { Hono } from 'hono';
import { tool } from 'ai';
import { z } from 'zod';

export const aiRouter = new Hono();

aiRouter.get('/', (c) => c.text('Twilio + ElevenLabs + AI Phone System Ready'));

aiRouter.post('/do/:action', async (c) => {
  if (env.DISABLE_CALLS) return c.json({ success: false, error: 'Not implemented' }, 400);
  const action = c.req.param('action') as Tools;
  const body = await c.req.json();
  console.log('[DEBUG] action', action, body);
  const connectionId = c.req.header('X-Connection-Id');
  if (!connectionId) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    const driver = await getDriverFromConnectionId(connectionId);
    switch (action) {
      case Tools.ListThreads:
        const threads = await Promise.all(
          (await driver.list({ folder: 'inbox', maxResults: 5 })).threads.map((thread) =>
            driver.get(thread.id).then((thread) => ({
              id: thread.latest?.id,
              subject: thread.latest?.subject,
              sender: thread.latest?.sender,
              date: thread.latest?.receivedOn,
            })),
          ),
        );
        return c.json({ success: true, result: threads });
      case Tools.ComposeEmail:
        const newBody = await composeEmail({
          prompt: body.prompt,
          emailSubject: body.emailSubject,
          username: 'Nizar Abi Zaher',
          connectionId,
        });
        return c.json({ success: true, result: newBody });
      case Tools.SendEmail:
        const result = await driver.create({
          to: body.to.map((to: any) => ({
            name: to.name ?? to.email,
            email: to.email ?? 'founders@0.email',
          })),
          subject: body.subject,
          message: body.message,
          attachments: [],
          headers: {},
        });
        return c.json({ success: true, result });
      default:
        return c.json({ success: false, error: 'Not implemented' }, 400);
    }
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 400);
  }
});

aiRouter.post('/call', async (c) => {
  if (env.DISABLE_CALLS === 'true')
    return c.json({ success: false, error: 'Not implemented' }, 400);
  const connectionId = c.req.header('X-Connection-Id');

  if (!connectionId) {
    return c.text('Missing connectionId', 400);
  }

  const { success, data } = await z
    .object({
      query: z.string(),
    })
    .safeParseAsync(await c.req.json());

  if (!success) {
    return c.text('Invalid request', 400);
  }

  const db = createDb(env.HYPERDRIVE.connectionString);
  const activeConnection = await db.query.connection.findFirst({
    where: (connection, { eq }) => eq(connection.id, connectionId),
  });

  if (!activeConnection) {
    return c.text('Unauthorized', 401);
  }

  const driver = connectionToDriver(activeConnection);

  const { text } = await generateText({
    model: openai('gpt-4o'),
    system: systemPrompt,
    prompt: data.query,
    tools: {
      buildGmailSearchQuery: tool({
        description: 'Build a Gmail search query',
        parameters: z.object({
          query: z.string().describe('The search query to build, provided in natural language'),
        }),
        execute: async (params) => {
          console.log('[DEBUG] buildGmailSearchQuery', params);

          const result = await generateText({
            model: openai('gpt-4o'),
            system: GmailSearchAssistantSystemPrompt(),
            prompt: params.query,
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
      }),
      [Tools.ListThreads]: tool({
        description: 'List threads',
        parameters: z.object({
          folder: z.string().default(FOLDERS.INBOX).describe('The folder to list threads from'),
          query: z.string().optional().describe('The query to filter threads by'),
          maxResults: z
            .number()
            .optional()
            .default(5)
            .describe('The maximum number of threads to return'),
          labelIds: z.array(z.string()).optional().describe('The label IDs to filter threads by'),
          pageToken: z.string().optional().describe('The page token to use for pagination'),
        }),
        execute: async (params) => {
          console.log('[DEBUG] listThreads', params);

          const result = await driver.list({
            folder: params.folder,
            query: params.query,
            maxResults: params.maxResults,
            labelIds: params.labelIds,
            pageToken: params.pageToken,
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
      }),
      [Tools.GetThread]: tool({
        description: 'Get a thread',
        parameters: z.object({
          threadId: z.string().describe('The ID of the thread to get'),
        }),
        execute: async (params) => {
          console.log('[DEBUG] getThread', params);

          try {
            const thread = await driver.get(params.threadId);

            const content = thread.messages.at(-1)?.body;

            return {
              content: [
                {
                  type: 'text',
                  text: `Subject:\n\n${thread.latest?.subject}\n\nBody:\n\n${content}`,
                },
              ],
            };
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
      }),
      [Tools.MarkThreadsRead]: tool({
        description: 'Mark threads as read',
        parameters: z.object({
          threadIds: z.array(z.string()).describe('The IDs of the threads to mark as read'),
        }),
        execute: async (params) => {
          console.log('[DEBUG] markThreadsRead', params);

          await driver.modifyLabels(params.threadIds, {
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
      }),
      [Tools.MarkThreadsUnread]: tool({
        description: 'Mark threads as unread',
        parameters: z.object({
          threadIds: z.array(z.string()).describe('The IDs of the threads to mark as unread'),
        }),
        execute: async (params) => {
          console.log('[DEBUG] markThreadsUnread', params);

          await driver.modifyLabels(params.threadIds, {
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
      }),
      [Tools.ModifyLabels]: tool({
        description: 'Modify labels',
        parameters: z.object({
          threadIds: z.array(z.string()).describe('The IDs of the threads to modify'),
          addLabelIds: z.array(z.string()).describe('The IDs of the labels to add'),
          removeLabelIds: z.array(z.string()).describe('The IDs of the labels to remove'),
        }),
        execute: async (params) => {
          console.log('[DEBUG] modifyLabels', params);

          await driver.modifyLabels(params.threadIds, {
            addLabels: params.addLabelIds,
            removeLabels: params.removeLabelIds,
          });
          return {
            content: [
              {
                type: 'text',
                text: `Successfully modified ${params.threadIds.length} thread(s)`,
              },
            ],
          };
        },
      }),
      getCurrentDate: tool({
        description: 'Get the current date',
        parameters: z.object({}).default({}),
        execute: async () => {
          console.log('[DEBUG] getCurrentDate');

          return {
            content: [
              {
                type: 'text',
                text: getCurrentDateContext(),
              },
            ],
          };
        },
      }),
      getUserLabels: tool({
        description: 'Get the user labels',
        parameters: z.object({}).default({}),
        execute: async () => {
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
        },
      }),
      getLabel: tool({
        description: 'Get a label',
        parameters: z.object({
          id: z.string().describe('The ID of the label to get'),
        }),
        execute: async (s) => {
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
      }),
      createLabel: tool({
        description: 'Create a label',
        parameters: z.object({
          name: z.string().describe('The name of the label to create'),
          backgroundColor: z.string().optional().describe('The background color of the label'),
          textColor: z.string().optional().describe('The text color of the label'),
        }),
        execute: async (params) => {
          console.log('[DEBUG] createLabel', params);

          try {
            await driver.createLabel({
              name: params.name,
              color:
                params.backgroundColor && params.textColor
                  ? {
                      backgroundColor: params.backgroundColor,
                      textColor: params.textColor,
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
          } catch (error) {
            console.error('Failed to create label:', error);

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
      }),
      bulkDelete: tool({
        description: 'Bulk delete threads',
        parameters: z.object({
          threadIds: z.array(z.string()).describe('The IDs of the threads to delete'),
        }),
        execute: async (params) => {
          console.log('[DEBUG] bulkDelete', params);

          try {
            await driver.modifyLabels(params.threadIds, {
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
          } catch (error) {
            console.error('Failed to move threads:', error);

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
      }),
      bulkArchive: tool({
        description: 'Bulk archive threads',
        parameters: z.object({
          threadIds: z.array(z.string()).describe('The IDs of the threads to archive'),
        }),
        execute: async (params) => {
          console.log('[DEBUG] bulkArchive', params);

          try {
            await driver.modifyLabels(params.threadIds, {
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
          } catch (error) {
            console.error('Failed to archive threads:', error);

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
      }),
    },
    maxSteps: 10,
  });

  return new Response(text, {
    headers: { 'Content-Type': 'text/plain' },
  });
});
