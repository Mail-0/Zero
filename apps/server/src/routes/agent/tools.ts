import { connectionToDriver, getActiveConnection } from '../../lib/server-utils';
import { composeEmail } from '../../trpc/routes/ai/compose';
import type { MailManager } from '../../lib/driver/types';
import { perplexity } from '@ai-sdk/perplexity';
import { colors } from '../../lib/prompts';
import { env } from 'cloudflare:workers';
import { generateText, tool } from 'ai';
import { Tools } from '../../types';
import { z } from 'zod';

type ModelTypes = 'summarize' | 'general' | 'chat' | 'vectorize';

const models: Record<ModelTypes, any> = {
  summarize: '@cf/facebook/bart-large-cnn',
  general: 'llama-3.3-70b-instruct-fp8-fast',
  chat: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  vectorize: '@cf/baai/bge-large-en-v1.5',
};

export const getEmbeddingVector = async (
  text: string,
  gatewayId: 'vectorize-save' | 'vectorize-load',
) => {
  try {
    const embeddingResponse = await env.AI.run(
      models.vectorize,
      { text },
      {
        gateway: {
          id: gatewayId,
        },
      },
    );
    const embeddingVector = embeddingResponse.data[0];
    return embeddingVector ?? null;
  } catch (error) {
    console.log('[getEmbeddingVector] failed', error);
    return null;
  }
};

const askZeroMailbox = (connectionId: string) =>
  tool({
    description: 'Ask Zero a question about the mailbox',
    parameters: z.object({
      question: z.string().describe('The question to ask Zero'),
      topK: z.number().describe('The number of results to return').max(9).min(1).default(3),
    }),
    execute: async ({ question, topK = 3 }) => {
      const embedding = await getEmbeddingVector(question, 'vectorize-load');
      if (!embedding) {
        return { error: 'Failed to get embedding' };
      }
      const threadResults = await env.VECTORIZE.query(embedding, {
        topK,
        returnMetadata: 'all',
        filter: {
          connection: connectionId,
        },
      });

      if (!threadResults.matches.length) {
        return {
          response: [],
          success: false,
        };
      }
      return {
        response: threadResults.matches.map((e) => e.metadata?.['content'] ?? 'no content'),
        success: true,
      };
    },
  });

const askZeroThread = (connectionId: string) =>
  tool({
    description: 'Ask Zero a question about a specific thread',
    parameters: z.object({
      threadId: z.string().describe('The ID of the thread to ask Zero about'),
      question: z.string().describe('The question to ask Zero'),
    }),
    execute: async ({ threadId, question }) => {
      const response = await env.VECTORIZE.getByIds([threadId]);
      if (!response.length) return { response: "I don't know, no threads found", success: false };
      const embedding = await getEmbeddingVector(question, 'vectorize-load');
      if (!embedding) {
        return { error: 'Failed to get embedding' };
      }
      const threadResults = await env.VECTORIZE.query(embedding, {
        topK: 1,
        returnMetadata: 'all',
        filter: {
          thread: threadId,
          connection: connectionId,
        },
      });
      const topThread = threadResults.matches[0];
      if (!topThread) return { response: "I don't know, no threads found", success: false };
      return {
        response: topThread.metadata?.['content'] ?? 'no content',
        success: true,
      };
    },
  });

const getEmail = (driver: MailManager) =>
  tool({
    description: 'Get a specific email thread by ID',
    parameters: z.object({
      id: z.string().describe('The ID of the email thread to retrieve'),
    }),
    execute: async ({ id }) => {
      return await driver.get(id);
    },
  });

const composeEmailTool = (connectionId: string) =>
  tool({
    description: 'Compose an email using AI assistance',
    parameters: z.object({
      prompt: z.string().describe('The prompt or rough draft for the email'),
      emailSubject: z.string().optional().describe('The subject of the email'),
      to: z.array(z.string()).optional().describe('Recipients of the email'),
      cc: z.array(z.string()).optional().describe('CC recipients of the email'),
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
        .optional()
        .describe('Previous messages in the thread for context'),
    }),
    execute: async (data) => {
      const newBody = await composeEmail({
        ...data,
        username: 'AI Assistant',
        connectionId,
      });
      return { newBody };
    },
  });

const listEmails = (driver: MailManager) =>
  tool({
    description: 'List emails in a specific folder',
    parameters: z.object({
      folder: z.string(),
      query: z.string().optional(),
      maxResults: z.number().optional(),
      labelIds: z.array(z.string()).optional(),
      pageToken: z.string().optional(),
    }),
    execute: async (params) => {
      return await driver.list(params);
    },
  });

const markAsRead = (driver: MailManager) =>
  tool({
    description: 'Mark emails as read',
    parameters: z.object({
      threadIds: z.array(z.string()),
    }),
    execute: async ({ threadIds }) => {
      await driver.markAsRead(threadIds);
      return { threadIds, success: true };
    },
  });

const markAsUnread = (driver: MailManager) =>
  tool({
    description: 'Mark emails as unread',
    parameters: z.object({
      threadIds: z.array(z.string()),
    }),
    execute: async ({ threadIds }) => {
      await driver.markAsUnread(threadIds);
      return { threadIds, success: true };
    },
  });

const modifyLabels = (driver: MailManager) =>
  tool({
    description: 'Modify labels on emails',
    parameters: z.object({
      threadIds: z.array(z.string()),
      options: z.object({
        addLabels: z.array(z.string()).default([]),
        removeLabels: z.array(z.string()).default([]),
      }),
    }),
    execute: async ({ threadIds, options }) => {
      await driver.modifyLabels(threadIds, options);
      return { threadIds, options, success: true };
    },
  });

const getUserLabels = (driver: MailManager) =>
  tool({
    description: 'Get all user labels',
    parameters: z.object({}),
    execute: async () => {
      return await driver.getUserLabels();
    },
  });

const sendEmail = (driver: MailManager) =>
  tool({
    description: 'Send a new email',
    parameters: z.object({
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
      // fromEmail: z.string().optional(),
      draftId: z.string().optional(),
    }),
    execute: async (data) => {
      try {
        const { draftId, ...mail } = data;

        if (draftId) {
          await driver.sendDraft(draftId, {
            ...mail,
            attachments: [],
            headers: {},
          });
        } else {
          await driver.create({
            ...mail,
            attachments: [],
            headers: {},
          });
        }

        return { success: true };
      } catch (error) {
        console.error('Error sending email:', error);
        throw new Error(
          'Failed to send email: ' + (error instanceof Error ? error.message : String(error)),
        );
      }
    },
  });

const createLabel = (driver: MailManager) =>
  tool({
    description: 'Create a new label with custom colors, if it does nto exist already',
    parameters: z.object({
      name: z.string().describe('The name of the label to create'),
      backgroundColor: z
        .string()
        .describe('The background color of the label in hex format')
        .refine((color) => colors.includes(color), {
          message: 'Background color must be one of the predefined colors',
        }),
      textColor: z
        .string()
        .describe('The text color of the label in hex format')
        .refine((color) => colors.includes(color), {
          message: 'Text color must be one of the predefined colors',
        }),
    }),
    execute: async ({ name, backgroundColor, textColor }) => {
      await driver.createLabel({ name, color: { backgroundColor, textColor } });
      return { name, backgroundColor, textColor, success: true };
    },
  });

const bulkDelete = (driver: MailManager) =>
  tool({
    description: 'Move multiple emails to trash by adding the TRASH label',
    parameters: z.object({
      threadIds: z.array(z.string()).describe('Array of email IDs to move to trash'),
    }),
    execute: async ({ threadIds }) => {
      await driver.modifyLabels(threadIds, { addLabels: ['TRASH'], removeLabels: [] });
      return { threadIds, success: true };
    },
  });

const bulkArchive = (driver: MailManager) =>
  tool({
    description: 'Move multiple emails to the archive by removing the INBOX label',
    parameters: z.object({
      threadIds: z.array(z.string()).describe('Array of email IDs to move to archive'),
    }),
    execute: async ({ threadIds }) => {
      await driver.modifyLabels(threadIds, { addLabels: [], removeLabels: ['INBOX'] });
      return { threadIds, success: true };
    },
  });

const deleteLabel = (driver: MailManager) =>
  tool({
    description: "Delete a label from the user's account",
    parameters: z.object({
      id: z.string().describe('The ID of the label to delete'),
    }),
    execute: async ({ id }) => {
      await driver.deleteLabel(id);
      return { id, success: true };
    },
  });

export const webSearch = tool({
  description: 'Search the web for information using Perplexity AI',
  parameters: z.object({
    query: z.string().describe('The query to search the web for'),
  }),
  execute: async ({ query }) => {
    try {
      const { text } = await generateText({
        model: perplexity('sonar'),
        messages: [
          { role: 'system', content: 'Be precise and concise.' },
          { role: 'user', content: query },
        ],
        maxTokens: 1024,
      });

      return text;
    } catch (error) {
      console.error('Error searching the web:', error);
      throw new Error('Failed to search the web');
    }
  },
});

export const tools = (driver: MailManager, connectionId: string) => {
  return {
    [Tools.GetThread]: getEmail(driver),
    [Tools.ComposeEmail]: composeEmailTool(connectionId),
    [Tools.ListThreads]: listEmails(driver),
    [Tools.MarkThreadsRead]: markAsRead(driver),
    [Tools.MarkThreadsUnread]: markAsUnread(driver),
    [Tools.ModifyLabels]: modifyLabels(driver),
    [Tools.GetUserLabels]: getUserLabels(driver),
    [Tools.SendEmail]: sendEmail(driver),
    [Tools.CreateLabel]: createLabel(driver),
    [Tools.BulkDelete]: bulkDelete(driver),
    [Tools.BulkArchive]: bulkArchive(driver),
    [Tools.DeleteLabel]: deleteLabel(driver),
    [Tools.AskZeroMailbox]: askZeroMailbox(connectionId),
    [Tools.AskZeroThread]: askZeroThread(connectionId),
    [Tools.WebSearch]: webSearch,
  };
};
