import { getActiveConnection } from '@/actions/utils';
import { ToolInvocation, streamText } from 'ai';
import { NextResponse } from 'next/server';
import { createDriver } from '../driver';
import { getAIModel, AIProvider } from '@/lib/ai-providers';
import prompt from './prompt';
import { z } from 'zod';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: ToolInvocation[];
}

export async function POST(req: Request) {
  const connection = await getActiveConnection();
  if (!connection) throw new Error('No active connection found');
  const { messages }: { messages: Message[] } = await req.json();
  if (!connection?.accessToken || !connection?.refreshToken) {
    console.error('Unauthorized: No valid connection found');
    return NextResponse.json({}, { status: 401 });
  }

  const driver = await createDriver(connection.providerId, {
    auth: {
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken!,
      email: connection.email,
    },
  });

  // Initialize AI model using environment variables with fallbacks
  // DEFAULT_AI_PROVIDER: 'openai' | 'ollama' (if configured)
  // DEFAULT_AI_MODEL: model name (e.g. 'gpt-3.5-turbo' for OpenAI)
  let model;
  try {
    model = getAIModel({ 
      provider: (process.env.DEFAULT_AI_PROVIDER ?? 'openai') as AIProvider,
      model: process.env.DEFAULT_AI_MODEL ?? 'gpt-3.5-turbo'
    });
  } catch (error) {
    console.error('Failed to initialize AI model:', error);
    return NextResponse.json({ error: 'Unable to initialize AI model' }, { status: 500 });
  }

  // Stream text using the configured AI model
  const result = streamText({
    model,
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
          return driver.list(folder, query, maxResults, labelIds, undefined);
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
}
