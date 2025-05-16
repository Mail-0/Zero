import { connectionToDriver, getActiveConnection } from '../../lib/server-utils';
import { composeEmail } from '../../trpc/routes/ai/compose';
import type { MailManager } from '../../lib/driver/types';
import { colors } from '../../lib/prompts';
import { Tools } from '../../types';
import { tool } from 'ai';
import { z } from 'zod';

// export class Chat extends AIChatAgent<Env> {
//   mailManager: MailManager | undefined;
//   constructor(ctx: DurableObjectState, env: Env) {
//     super(ctx, env);
//     this.initialize();
//   }

//   async initialize() {
//     if (!this.mailManager) {
//       const activeConnection = await getActiveConnection();
//       this.mailManager = connectionToDriver(activeConnection);
//     }
//   }

//   async onChatMessage(
//     onFinish: StreamTextOnFinishCallback<ToolSet>,
//     options?: { abortSignal?: AbortSignal },
//   ) {
//     // const mcpConnection = await this.mcp.connect(
//     //   "https://path-to-mcp-server/sse"
//     // );

//     // Collect all tools, including MCP tools
//     const allTools = {
//       ...tools,
//       ...this.mcp.unstable_getAITools(),
//     };

//     // Create a streaming response that handles both text and tool outputs
//     const dataStreamResponse = createDataStreamResponse({
//       execute: async (dataStream) => {
//         // Process any pending tool calls from previous messages
//         // This handles human-in-the-loop confirmations for tools
//         const processedMessages = await processToolCalls({
//           messages: this.messages,
//           dataStream,
//           tools: allTools,
//           executions: [],
//         });

//         // Stream the AI response using GPT-4
//         const result = streamText({
//           model: openai('gpt-4o'),
//           system: AiChatPrompt('', '', ''),
//           messages: processedMessages,
//           tools: allTools,
//           onFinish: async (args) => {
//             onFinish(args as Parameters<StreamTextOnFinishCallback<ToolSet>>[0]);
//             // await this.mcp.closeConnection(mcpConnection.id);
//           },
//           onError: (error) => {
//             console.error('Error while streaming:', error);
//           },
//           maxSteps: 10,
//         });

//         // Merge the AI response stream with tool execution outputs
//         result.mergeIntoDataStream(dataStream);
//       },
//     });

//     return dataStreamResponse;
//   }
// }

const getMailManager: () => Promise<MailManager> = async () => {
  const activeConnection = await getActiveConnection();
  return connectionToDriver(activeConnection);
};

const getEmail = tool({
  description: 'Get a specific email thread by ID',
  parameters: z.object({
    id: z.string().describe('The ID of the email thread to retrieve'),
  }),
  execute: async ({ id }) => {
    const mailManager = await getMailManager();
    return await mailManager.get(id);
  },
});

const composeEmailTool = tool({
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
    const activeConnection = await getActiveConnection();
    const newBody = await composeEmail({
      ...data,
      username: 'AI Assistant',
      connectionId: activeConnection.id,
    });
    return { newBody };
  },
});

const createEmail = tool({
  description: 'Create and send a new email',
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
    attachments: z.array(z.any()).optional(),
    headers: z.record(z.string()).optional(),
  }),
});

const listEmails = tool({
  description: 'List emails in a specific folder',
  parameters: z.object({
    folder: z.string(),
    query: z.string().optional(),
    maxResults: z.number().optional(),
    labelIds: z.array(z.string()).optional(),
    pageToken: z.string().optional(),
  }),
  execute: async (params) => {
    const mailManager = await getMailManager();
    return await mailManager.list(params);
  },
});

const createDraft = tool({
  description: 'Create a new email draft',
  parameters: z.object({
    to: z.string(),
    subject: z.string(),
    message: z.string(),
    cc: z.string().optional(),
    bcc: z.string().optional(),
    id: z.string().nullable(),
    attachments: z.array(z.any()).optional(),
  }),
  execute: async (data) => {
    const mailManager = await getMailManager();
    return await mailManager.createDraft(data);
  },
});

const writeEmail = tool({
  description: 'Write a new email',
  parameters: z.object({
    to: z.string().optional(),
    subject: z.string().optional(),
    message: z.string().optional(),
  }),
  execute: async (data) => {},
});

const sendDraft = tool({
  description: 'Send an existing draft',
  parameters: z.object({
    id: z.string(),
    data: z.object({
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
      attachments: z.array(z.any()).optional(),
      headers: z.record(z.string()).optional(),
    }),
  }),
});

const deleteEmail = tool({
  description: 'Delete an email',
  parameters: z.object({
    id: z.string(),
  }),
  execute: async ({ id }) => {
    const mailManager = await getMailManager();
    await mailManager.delete(id);
    return { id, success: true };
  },
});

const markAsRead = tool({
  description: 'Mark emails as read',
  parameters: z.object({
    threadIds: z.array(z.string()),
  }),
  execute: async ({ threadIds }) => {
    const mailManager = await getMailManager();
    await mailManager.markAsRead(threadIds);
    return { threadIds, success: true };
  },
});

const markAsUnread = tool({
  description: 'Mark emails as unread',
  parameters: z.object({
    threadIds: z.array(z.string()),
  }),
  execute: async ({ threadIds }) => {
    const mailManager = await getMailManager();
    await mailManager.markAsUnread(threadIds);
    return { threadIds, success: true };
  },
});

const modifyLabels = tool({
  description: 'Modify labels on emails',
  parameters: z.object({
    threadIds: z.array(z.string()),
    options: z.object({
      addLabels: z.array(z.string()).default([]),
      removeLabels: z.array(z.string()).default([]),
    }),
  }),
  execute: async ({ threadIds, options }) => {
    const mailManager = await getMailManager();
    await mailManager.modifyLabels(threadIds, options);
    return { threadIds, options, success: true };
  },
});

const getUserLabels = tool({
  description: 'Get all user labels',
  parameters: z.object({}),
  execute: async () => {
    const mailManager = await getMailManager();
    return await mailManager.getUserLabels();
  },
});

const sendEmail = tool({
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
      const mailManager = await getMailManager();
      const { draftId, ...mail } = data;

      if (draftId) {
        await mailManager.sendDraft(draftId, {
          ...mail,
          attachments: [],
          headers: {},
        });
      } else {
        await mailManager.create({
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

const createLabel = tool({
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
    const mailManager = await getMailManager();
    await mailManager.createLabel({ name, color: { backgroundColor, textColor } });
    return { name, backgroundColor, textColor, success: true };
  },
});

const bulkDelete = tool({
  description: 'Move multiple emails to trash by adding the TRASH label',
  parameters: z.object({
    threadIds: z.array(z.string()).describe('Array of email IDs to move to trash'),
  }),
  execute: async ({ threadIds }) => {
    const mailManager = await getMailManager();
    await mailManager.modifyLabels(threadIds, { addLabels: ['TRASH'], removeLabels: [] });
    return { threadIds, success: true };
  },
});

const bulkArchive = tool({
  description: 'Move multiple emails to the archive by removing the INBOX label',
  parameters: z.object({
    threadIds: z.array(z.string()).describe('Array of email IDs to move to archive'),
  }),
  execute: async ({ threadIds }) => {
    const mailManager = await getMailManager();
    await mailManager.modifyLabels(threadIds, { addLabels: [], removeLabels: ['INBOX'] });
    return { threadIds, success: true };
  },
});

const deleteLabel = tool({
  description: "Delete a label from the user's account",
  parameters: z.object({
    id: z.string().describe('The ID of the label to delete'),
  }),
  execute: async ({ id }) => {
    const mailManager = await getMailManager();
    await mailManager.deleteLabel(id);
    return { id, success: true };
  },
});

export const tools = {
  [Tools.GetThread]: getEmail,
  [Tools.ComposeEmail]: composeEmailTool,
  [Tools.ListThreads]: listEmails,
  [Tools.MarkThreadsRead]: markAsRead,
  [Tools.MarkThreadsUnread]: markAsUnread,
  [Tools.ModifyLabels]: modifyLabels,
  [Tools.GetUserLabels]: getUserLabels,
  [Tools.SendEmail]: sendEmail,
  [Tools.CreateLabel]: createLabel,
  [Tools.BulkDelete]: bulkDelete,
  [Tools.BulkArchive]: bulkArchive,
  [Tools.DeleteLabel]: deleteLabel,
};

// export const executions = {
//   sendEmail: async (data: IOutgoingMessage) => {
//     const mailManager = await getMailManager();
//     return await mailManager.create(data);
//   },
//   sendDraft: async (id: string, data: IOutgoingMessage) => {
//     const mailManager = await getMailManager();
//     return await mailManager.sendDraft(id, data);
//   },
// };
