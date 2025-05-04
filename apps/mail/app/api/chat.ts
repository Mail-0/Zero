import { connectionToDriver, getActiveConnection } from '@/lib/server-utils';
import { prompt } from '@/lib/chat-prompts';
import { HonoContext } from '@/trpc/hono';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { z } from 'zod';

export const chatHandler = async (c: HonoContext) => {
  const driver = await getActiveConnection(c)
    .then((conn) => connectionToDriver(conn, c))
    .catch((err) => {
      console.error('Error in getActiveConnection:', err);
      throw c.json({ error: 'Failed to get active connection' }, 500);
    });

  const messages = await c.req.json().catch((err: Error) => {
    console.error('Error parsing JSON:', err);
    throw c.json({ error: 'Failed to parse request body' }, 400);
  });

  const result = streamText({
    model: openai('gpt-4o'),
    system: prompt,
    messages,
    tools: {
      listThreads: {
        description: 'List email threads',
        parameters: z.object({
          folder: z
            .string()
            .optional()
            .default('inbox')
            .describe('The folder to list threads from'),
          query: z.string().optional().describe('The search query'),
          maxResults: z.number().optional().default(20).describe('The maximum number of results'),
          labelIds: z.array(z.string()).optional().describe('The label IDs to filter by'),
        }),
        execute: async ({ folder, query, maxResults, labelIds }) => {
          return driver.list({ folder, query, maxResults, labelIds });
        },
      },
      archiveThreads: {
        description: 'Archive email threads by removing them from inbox',
        parameters: z.object({
          threadIds: z.array(z.string()).describe('Array of thread IDs to archive'),
        }),
        execute: async ({ threadIds }) => {
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
          try {
            console.log({ backgroundColor, textColor });

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
          return driver.getUserLabels();
        },
      },
    },
  });

  return result.toDataStreamResponse();
};
