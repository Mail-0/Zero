import { trpcClient } from '@/providers/query-provider';

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
      const result = await trpcClient.mail.get.query({ id: params.threadId });
      return {
        success: true,
        thread: result,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  sendEmail: async (params: any) => {
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
  composeEmail: async (params: any) => {
    try {
      const result = await trpcClient.ai.compose.mutate({
        prompt: params.prompt,
        emailSubject: params.emailSubject,
        to: params.to,
      });
      return { success: true, draft: result.newBody };
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
      await trpcClient.mail.modifyLabels.mutate({
        threadId: params.threadIds,
        addLabels: [params.labelId],
        removeLabels: [],
      });
      return { success: true, message: 'Label applied' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  removeLabel: async (params: any) => {
    try {
      await trpcClient.mail.modifyLabels.mutate({
        threadId: params.threadIds,
        addLabels: [],
        removeLabels: [params.labelId],
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
    try {
      // fake api call, need to call perplexity api here
      return {
        success: true,
        result:
          "I'm currently focused on helping you with your emails. Web search functionality is not available in this context.",
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};
