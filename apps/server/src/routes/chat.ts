import { connectionToDriver, getActiveConnection } from '../lib/server-utils';
import { AiChatPrompt } from '../lib/prompts';
import type { HonoContext } from '../ctx';
import { openai } from '@ai-sdk/openai';
import { Autumn } from 'autumn-js';
import { streamText } from 'ai';
import { z } from 'zod';

export const chatHandler = async (c: HonoContext) => {
  const { session } = c.var;
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const canSendMessages = await Autumn.check({
    feature_id: 'chat-messages',
    customer_id: session.user.id,
  });

  if (!canSendMessages.data) {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }

  if (!canSendMessages.data.balance && !canSendMessages.data.unlimited) {
    return c.json({ error: 'Insufficient plan quota' }, 403);
  }

  if ((canSendMessages.data.balance ?? 0) <= 0) {
    return c.json({ error: 'Insufficient plan balance' }, 403);
  }

  const driver = await getActiveConnection(c)
    .then((conn) => connectionToDriver(conn, c))
    .catch((err) => {
      console.error('Error in getActiveConnection:', err);
      throw c.json({ error: 'Failed to get active connection' }, 500);
    });

  const { messages, threadId, currentFolder, currentFilter } = await c.req
    .json()
    .catch((err: Error) => {
      console.error('Error parsing JSON:', err);
      throw c.json({ error: 'Failed to parse request body' }, 400);
    });

  const result = streamText({
    model: openai('gpt-4o'),
    system: AiChatPrompt(threadId, currentFolder, currentFilter),
    messages,
    tools: {
      getThread: {
        description: 'Get a thread by ID',
        parameters: z.object({
          threadId: z.string().describe('The thread ID to get'),
        }),
        execute: async ({ threadId }) => {
          void Autumn.track({ feature_id: 'chat-messages', customer_id: session.user.id });
          return driver.get(threadId);
        },
      },
      listThreads: {
        description: 'List email threads',
        parameters: z.object({
          folder: z
            .string()
            .optional()
            .default('inbox')
            .describe('The folder to list threads from'),
          query: z.string().optional().describe('The search query'),
          maxResults: z.number().optional().default(5).describe('The maximum number of results'),
          labelIds: z.array(z.string()).optional().describe('The label IDs to filter by'),
        }),
        execute: async ({ folder, query, maxResults, labelIds }) => {
          void Autumn.track({ feature_id: 'chat-messages', customer_id: session.user.id });
          return driver.list({ folder, query, maxResults, labelIds });
        },
      },
      archiveThreads: {
        description: 'Archive email threads by removing them from inbox',
        parameters: z.object({
          threadIds: z.array(z.string()).describe('Array of thread IDs to archive'),
        }),
        execute: async ({ threadIds }) => {
          void Autumn.track({ feature_id: 'chat-messages', customer_id: session.user.id });
          await driver.modifyLabels(threadIds, {
            removeLabels: ['INBOX'],
            addLabels: [],
          });
          return { archived: threadIds.length };
        },
      },
      markThreadsRead: {
        description: 'Mark email threads as read',
        parameters: z.object({
          threadIds: z.array(z.string()).describe('Array of thread IDs to mark as read'),
        }),
        execute: async ({ threadIds }) => {
          void Autumn.track({ feature_id: 'chat-messages', customer_id: session.user.id });
          await driver.markAsRead(threadIds);
          return { marked: threadIds.length };
        },
      },
      markThreadsUnread: {
        description: 'Mark email threads as unread',
        parameters: z.object({
          threadIds: z.array(z.string()).describe('Array of thread IDs to mark as unread'),
        }),
        execute: async ({ threadIds }) => {
          void Autumn.track({ feature_id: 'chat-messages', customer_id: session.user.id });
          await driver.markAsUnread(threadIds);
          return { marked: threadIds.length };
        },
      },
      createLabel: {
        description: 'Create a new label',
        parameters: z.object({
          name: z.string().describe('Name of the label to create'),
          backgroundColor: z.string().optional().describe('Background color for the label'),
          textColor: z.string().optional().describe('Text color for the label'),
        }),
        execute: async ({ name, backgroundColor = '#f691b3', textColor = '#434343' }) => {
          void Autumn.track({ feature_id: 'chat-messages', customer_id: session.user.id });
          try {
            const label = await driver.createLabel({
              name,
              color: { backgroundColor, textColor },
            });
            console.log('label', label);
          } catch (error) {
            console.error('Error creating label:', error);
            throw new Error('Failed to create label');
          }
          return { success: true };
        },
      },
      addLabelsToThreads: {
        description: 'Add labels to email threads',
        parameters: z.object({
          threadIds: z.array(z.string()).describe('Array of thread IDs to label'),
          labelIds: z.array(z.string()).describe('Array of label IDs to add'),
        }),
        execute: async ({ threadIds, labelIds }) => {
          void Autumn.track({ feature_id: 'chat-messages', customer_id: session.user.id });
          await driver.modifyLabels(threadIds, {
            addLabels: labelIds,
            removeLabels: [],
          });
          return { labeled: threadIds.length };
        },
      },
      getUserLabels: {
        description: 'Get all user labels',
        parameters: z.object({}),
        execute: async () => {
          void Autumn.track({ feature_id: 'chat-messages', customer_id: session.user.id });
          return driver.getUserLabels();
        },
      },
    },
  });

  return result.toDataStreamResponse();
};
