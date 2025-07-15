import { getCurrentDateContext, GmailSearchAssistantSystemPrompt } from '../lib/prompts';
import { systemPrompt } from '../services/call-service/system-prompt';
import { composeEmail } from '../trpc/routes/ai/compose';
import { getZeroAgent } from '../lib/server-utils';
import { env } from 'cloudflare:workers';
import { openai } from '@ai-sdk/openai';
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
  if (env.VOICE_SECRET !== c.req.header('X-Voice-Secret'))
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  if (!c.req.header('X-Caller')) return c.json({ success: false, error: 'Unauthorized' }, 401);
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  const user = await db.query.user.findFirst({
    where: (user, { eq, and }) =>
      and(eq(user.phoneNumber, c.req.header('X-Caller')!), eq(user.phoneNumberVerified, true)),
  });
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);

  const connection = await db.query.connection.findFirst({
    where: (connection, { eq, or }) =>
      or(eq(connection.id, user.defaultConnectionId!), eq(connection.userId, user.id)),
  });
  await conn.end();
  if (!connection) return c.json({ success: false, error: 'Unauthorized' }, 401);

  try {
    const action = c.req.param('action') as Tools;
    const body = await c.req.json();
    console.log('[DEBUG] action', action, body);
    const agent = await getZeroAgent(connection.id);
    switch (action) {
      case Tools.ComposeEmail:
        const newBody = await composeEmail({
          prompt: body.prompt,
          emailSubject: body.emailSubject,
          username: 'Nizar Abi Zaher',
          connectionId: connection.id,
        });
        return c.json({ success: true, result: newBody });
      case Tools.SendEmail:
        const result = await agent.create({
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
  console.log('[DEBUG] Received call request');

  if (env.DISABLE_CALLS) {
    console.log('[DEBUG] Calls are disabled');
    return c.json({ success: false, error: 'Not implemented' }, 400);
  }

  if (env.VOICE_SECRET !== c.req.header('X-Voice-Secret')) {
    console.log('[DEBUG] Invalid voice secret');
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  if (!c.req.header('X-Caller')) {
    console.log('[DEBUG] Missing caller header');
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  console.log('[DEBUG] Parsing request body');
  const { success, data } = await z
    .object({
      query: z.string(),
    })
    .safeParseAsync(await c.req.json());

  if (!success) {
    console.log('[DEBUG] Invalid request body');
    return c.json({ success: false, error: 'Invalid request' }, 400);
  }

  console.log('[DEBUG] Connecting to database');
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);

  console.log('[DEBUG] Finding user by phone number:', c.req.header('X-Caller'));
  const user = await db.query.user.findFirst({
    where: (user, { eq, and }) =>
      and(eq(user.phoneNumber, c.req.header('X-Caller')!), eq(user.phoneNumberVerified, true)),
  });

  if (!user) {
    console.log('[DEBUG] User not found or not verified');
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  console.log('[DEBUG] Finding connection for user:', user.id);
  const connection = await db.query.connection.findFirst({
    where: (connection, { eq, or }) =>
      or(eq(connection.id, user.defaultConnectionId!), eq(connection.userId, user.id)),
  });

  await conn.end();

  if (!connection) {
    console.log('[DEBUG] No connection found for user');
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  console.log('[DEBUG] Creating driver for connection:', connection.id);
  const agent = await getZeroAgent(connection.id);

  const { text } = await generateText({
    model: openai(env.OPENAI_MODEL || 'gpt-4o'),
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
            model: openai(env.OPENAI_MODEL || 'gpt-4o'),
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
      //     description: 'List threads',
      //     parameters: z.object({
      //       folder: z.string().default(FOLDERS.INBOX).describe('The folder to list threads from'),
      //       query: z.string().optional().describe('The query to filter threads by'),
      //       maxResults: z
      //         .number()
      //         .optional()
      //         .default(5)
      //         .describe('The maximum number of threads to return'),
      //       labelIds: z.array(z.string()).optional().describe('The label IDs to filter threads by'),
      //       pageToken: z.string().optional().describe('The page token to use for pagination'),
      //     }),
      //     execute: async (params) => {
      //       console.log('[DEBUG] listThreads', params);

      //       const result = await agent.listThreads({
      //         folder: params.folder,
      //         query: params.query,
      //         maxResults: params.maxResults,
      //         labelIds: params.labelIds,
      //         pageToken: params.pageToken,
      //       });
      //       const content = await Promise.all(
      //         result.threads.map(async (thread: any) => {
      //           const loadedThread = await agent.getThread(thread.id);
      //           return [
      //             {
      //               type: 'text' as const,
      //               text: `Subject: ${loadedThread.latest?.subject} | Received: ${loadedThread.latest?.receivedOn}`,
      //             },
      //           ];
      //         }),
      //       );
      //       return {
      //         content: content.length
      //           ? content.flat()
      //           : [
      //               {
      //                 type: 'text' as const,
      //                 text: 'No threads found',
      //               },
      //             ],
      //       };
      //     },
      //   }),
      [Tools.GetThread]: tool({
        description: 'Get a thread',
        parameters: z.object({
          threadId: z.string().describe('The ID of the thread to get'),
        }),
        execute: async (params) => {
          console.log('[DEBUG] getThread', params);

          try {
            const thread = await agent.getThread(params.threadId);

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

          await agent.modifyLabels(params.threadIds, [], ['UNREAD']);
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

          await agent.modifyLabels(params.threadIds, ['UNREAD'], []);
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

          await agent.modifyLabels(params.threadIds, params.addLabelIds, params.removeLabelIds);
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
      }),
      getLabel: tool({
        description: 'Get a label',
        parameters: z.object({
          id: z.string().describe('The ID of the label to get'),
        }),
        execute: async (s) => {
          console.log('[DEBUG] getLabel', s);

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
            await agent.createLabel({
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
            await agent.modifyLabels(params.threadIds, ['TRASH'], ['INBOX']);
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
            await agent.modifyLabels(params.threadIds, [], ['INBOX']);
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
