import { trpcClient } from '@/providers/query-provider';
import { perplexity } from '@ai-sdk/perplexity';
import { generateText, tool } from 'ai';

const getCurrentThreadId = () => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    return params.get('threadId');
  }
  return null;
};

const cleanNameDisplay = (name?: string) => {
  if (!name) return '';
  return name.replace(/["<>]/g, '');
};

export const toolExecutors = {
  listEmails: async (params: { folder: string; query: string; maxResults: number }) => {
    try {
      const result = await trpcClient.mail.listThreads.query({
        folder: params.folder || 'INBOX',
        q: params.query,
      });

      const threads = result.threads.slice(0, params.maxResults || 10);

      return {
        success: true,
        threads: threads.map((thread: any) => ({
          id: thread.id,
          subject: thread.subject,
          from: thread.sender,
          date: thread.receivedOn,
          preview: thread.snippet,
          hasUnread: thread.hasUnread,
        })),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  getEmail: async (params: any) => {
    try {
      // Handle various ways the AI might pass the threadId
      let threadId = null;

      // Check for threadId in various formats
      if (params.threadId && typeof params.threadId === 'string' && params.threadId.trim()) {
        threadId = params.threadId.trim();
      } else if (
        params.thread_id &&
        typeof params.thread_id === 'string' &&
        params.thread_id.trim()
      ) {
        threadId = params.thread_id.trim();
      } else if (params.id && typeof params.id === 'string' && params.id.trim()) {
        threadId = params.id.trim();
      } else {
        // Fall back to current thread from URL
        threadId = getCurrentThreadId();
      }

      if (!threadId) {
        return {
          success: false,
          error: 'No email is currently open. Please open an email first or provide a thread ID.',
          hint: 'You can refer to "this email" or "the current email" when an email is open.',
        };
      }

      const result = await trpcClient.mail.get.query({ id: threadId });
      return {
        success: true,
        thread: result,
        currentThreadId: threadId,
        message: `Retrieved email with thread ID: ${threadId}`,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  sendEmail: async (params: {
    to: string[];
    subject: string;
    message: string;
    threadId: string;
  }) => {
    try {
      await trpcClient.mail.send.mutate({
        to: params.to.map((email: string) => ({ email })),
        subject: params.subject,
        message: params.message,
        threadId: params.threadId,
      });
      return { success: true, message: 'Email sent successfully' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  markAsRead: async (params: any) => {
    try {
      await trpcClient.mail.markAsRead.mutate({ ids: params.threadIds });
      return { success: true, message: 'Emails marked as read' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  markAsUnread: async (params: any) => {
    try {
      await trpcClient.mail.markAsUnread.mutate({ ids: params.threadIds });
      return { success: true, message: 'Emails marked as unread' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  archiveEmails: async (params: any) => {
    try {
      await trpcClient.mail.bulkArchive.mutate({ ids: params.threadIds });
      return { success: true, message: 'Emails archived' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  deleteEmails: async (params: any) => {
    try {
      await trpcClient.mail.bulkDelete.mutate({ ids: params.threadIds });
      return { success: true, message: 'Emails moved to trash' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  deleteEmail: async (params: any) => {
    const threadId = getCurrentThreadId();
    if (!threadId) {
      return {
        success: false,
        error: 'No email is currently open. Please open an email first.',
        hint: 'When an email is open, you can ask me to "delete this email" without specifying an ID.',
      };
    }
    try {
      await trpcClient.mail.bulkDelete.mutate({ ids: [threadId] });
      return { success: true, message: 'Email deleted' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  createLabel: async (params: { name: string; backgroundColor: string; textColor: string }) => {
    console.log('params:', params);

    try {
      await trpcClient.labels.create.mutate({
        name: params.name,
        color: {
          backgroundColor: params.backgroundColor || '#1C2A41',
          textColor: params.textColor || '#D8E6FD',
        },
      });

      return { success: true, message: 'Label created' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  applyLabel: async (params: any) => {
    try {
      const labels = await trpcClient.labels.list.query();
      const label = labels.find((label: any) => label.name === params.label);
      if (!label) {
        return { success: false, error: 'Label not found' };
      }

      await trpcClient.mail.modifyLabels.mutate({
        threadId: params.threadIds,
        addLabels: [label.id],
        removeLabels: [],
      });
      return { success: true, message: 'Label applied' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  removeLabel: async (params: any) => {
    try {
      const threadId = getCurrentThreadId();
      if (!threadId) {
        return {
          success: false,
          error: 'No email is currently open. Please open an email first.',
          hint: 'When an email is open, you can ask me to "apply a label" without specifying an ID.',
        };
      }

      const thread = await trpcClient.mail.get.query({ id: threadId });
      const labels = thread.labels;
      const label = labels.find((label: any) => label.name === params.label);
      if (!label) {
        return { success: false, error: 'Label not found' };
      }

      await trpcClient.mail.modifyLabels.mutate({
        threadId: params.threadIds,
        addLabels: [],
        removeLabels: [label.id],
      });
      return { success: true, message: 'Label removed' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  searchEmails: async (params: any) => {
    try {
      // just a simple search for now
      const result = await trpcClient.mail.listThreads.query({
        q: params.question,
        folder: 'INBOX',
      });

      const threads = result.threads.slice(0, params.maxResults || 5);

      return {
        success: true,
        results: threads.map((thread: any) => ({
          id: thread.id,
          subject: thread.subject,
          from: thread.sender,
          date: thread.receivedOn,
          preview: thread.snippet,
        })),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  webSearch: async (params: any) => {
    console.log(params);
    const threadId = getCurrentThreadId();
    if (!threadId) {
      return {
        success: false,
        error: 'No email is currently open. Please open an email first.',
        hint: 'When an email is open, you can ask me to "summarize this email" without specifying an ID.',
      };
    }
    try {
      const thread = await trpcClient.mail.get.query({ id: threadId });

      const emailContent = thread.messages?.map((m: any) => m.body).join('\n\n') || '';
      const subject = thread.latest?.subject || 'No subject';
      const from = thread.latest?.sender?.email || 'Unknown sender';
      const senderName = cleanNameDisplay(thread.latest?.sender?.name);
      const receivedDate = thread.latest?.receivedOn
        ? new Date(thread.latest.receivedOn).toLocaleString()
        : 'Unknown date';
      const messageCount = thread.messages?.length || 0;

      const emailContextPrompt = `You are analyzing an email thread to answer a specific question.

      EMAIL THREAD CONTEXT:
      - Subject: ${subject}
      - From: ${senderName} (${from})
      - Date: ${receivedDate}
      - Number of messages: ${messageCount}
      - Has unread messages: ${thread.hasUnread ? 'Yes' : 'No'}

      EMAIL CONTENT:
      ${emailContent}

      USER'S QUESTION:
      ${params.query}

      Please provide a focused answer to the user's question based on the email content above. If the question asks for a summary, provide a concise summary. If it asks for specific information, extract and provide just that information. Always base your response on the actual email content provided you can also do web search if needed.`;

      const { text } = await trpcClient.ai.webSearch.mutate({
        query: emailContextPrompt,
      });

      return {
        success: true,
        result: text,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  summarizeEmail: async () => {
    try {
      const threadId = getCurrentThreadId();

      if (!threadId) {
        return {
          success: false,
          error: 'No email is currently open. Please open an email first.',
          hint: 'When an email is open, you can ask me to "summarize this email" without specifying an ID.',
        };
      }

      try {
        const thread = await trpcClient.mail.get.query({ id: threadId });

        const emailContent = thread.messages?.map((m: any) => m.body).join('\n\n') || '';
        const subject = thread.latest?.subject || 'No subject';
        const from = thread.latest?.sender?.email || 'Unknown sender';
        const senderName = cleanNameDisplay(thread.latest?.sender?.name);
        const receivedDate = thread.latest?.receivedOn
          ? new Date(thread.latest.receivedOn).toLocaleString()
          : 'Unknown date';
        const messageCount = thread.messages?.length || 0;

        const emailSummaryPrompt = `Please provide a concise summary of the following email thread:

        THREAD INFORMATION:
        - Subject: ${subject}
        - From: ${senderName} (${from})
        - Date: ${receivedDate}
        - Number of messages: ${messageCount}
        - Has unread messages: ${thread.hasUnread ? 'Yes' : 'No'}

        EMAIL CONTENT:
        ${emailContent}

        Please provide a brief 2-3 sentence summary covering:
        1. The main topic and purpose
        2. Any key action items or decisions needed
        3. The urgency level`;

        const { text } = await trpcClient.ai.webSearch.mutate({
          query: emailSummaryPrompt,
        });

        return {
          success: true,
          result: {
            threadId: threadId,
            subject: subject,
            from: from,
            senderName: senderName,
            messageCount: messageCount,
            hasUnread: thread.hasUnread,
            summary: 'this is a fake summary',
            message: `Successfully summarized email thread: ${threadId}`,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: 'Failed to fetch email for summarization',
        };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};
