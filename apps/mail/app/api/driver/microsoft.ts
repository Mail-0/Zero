import { IOutgoingMessage, Sender, type ParsedMessage, type InitialThread } from '@/types';
import { parseAddressList, parseFrom, wasSentWithTLS } from '@/lib/email-utils';
import { fromBinary, fromBase64Url, findHtmlBody } from '@/actions/utils';
import { Conversation } from '@microsoft/microsoft-graph-types';
import type { Message } from '@microsoft/microsoft-graph-types';
import { Client } from '@microsoft/microsoft-graph-client';
import { delay, withExponentialBackoff } from '../utils';
import { filterSuggestions } from '@/lib/filter';
import { cleanSearchValue } from '@/lib/utils';
import { IConfig, MailManager } from './types';
import { createMimeMessage } from 'mimetext';
import * as he from 'he';

export const driver = async (config: IConfig): Promise<MailManager> => {
  const getClient = (accessToken: string) => {
    return Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => accessToken,
      },
    });
  };

  const getScope = () =>
    'https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send offline_access';

  const parseMessage = (message: Message): ParsedMessage => {
    const headers = message.internetMessageHeaders || [];
    const dateHeader = headers.find((h) => h.name?.toLowerCase() === 'date');
    const receivedOn = (dateHeader?.value ||
      message.receivedDateTime ||
      new Date().toISOString()) as string;
    const sender = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || 'Failed';
    const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || '';
    const references = headers.find((h) => h.name?.toLowerCase() === 'references')?.value || '';
    const inReplyTo = headers.find((h) => h.name?.toLowerCase() === 'in-reply-to')?.value || '';
    const messageId = headers.find((h) => h.name?.toLowerCase() === 'message-id')?.value || '';
    const listUnsubscribe = headers.find(
      (h) => h.name?.toLowerCase() === 'list-unsubscribe',
    )?.value;
    const listUnsubscribePost = headers.find(
      (h) => h.name?.toLowerCase() === 'list-unsubscribe-post',
    )?.value;
    const replyTo = headers.find((h) => h.name?.toLowerCase() === 'reply-to')?.value;
    const to = headers.find((h) => h.name?.toLowerCase() === 'to')?.value || '';
    const cc = headers.find((h) => h.name?.toLowerCase() === 'cc')?.value || '';
    const receivedHeaders = headers
      .filter((h) => h.name?.toLowerCase() === 'received')
      .map((h) => h.value || '');
    const hasTLSReport = headers.some((h) => h.name?.toLowerCase() === 'tls-report');

    return {
      id: message.id || 'ERROR',
      bcc: [],
      threadId: message.conversationId || '',
      title: message.subject || 'ERROR',
      tls: wasSentWithTLS(receivedHeaders) || !!hasTLSReport,
      tags: message.categories?.map((c) => ({ id: c, name: c })) || [],
      //   listUnsubscribe,
      //   listUnsubscribePost,
      //   replyTo,
      references,
      inReplyTo,
      sender: {
        email: sender,
        name: sender,
      },
      unread: !message.isRead,
      to: parseAddressList(to),
      cc: cc ? parseAddressList(cc) : null,
      receivedOn,
      subject: subject ? subject.replace(/"/g, '').trim() : '(no subject)',
      messageId,
      body: message.body?.content || '',
      processedHtml: message.body?.content || '',
      blobUrl: '',
    };
  };

  const parseOutgoing = async ({
    to,
    subject,
    message,
    attachments,
    headers,
    cc,
    bcc,
  }: IOutgoingMessage) => {
    const msg = createMimeMessage();
    const fromEmail = config.auth?.email || 'nobody@example.com';
    msg.setSender({ name: '', addr: fromEmail });

    const uniqueRecipients = new Set<string>();

    if (!Array.isArray(to) || to.length === 0) {
      throw new Error('Recipient address required');
    }

    const toRecipients = to
      .filter((recipient) => {
        if (!recipient || !recipient.email) return false;
        const email = recipient.email.toLowerCase();
        if (!uniqueRecipients.has(email)) {
          uniqueRecipients.add(email);
          return true;
        }
        return false;
      })
      .map((recipient) => ({
        name: recipient.name || '',
        addr: recipient.email,
      }));

    if (toRecipients.length === 0) {
      throw new Error('No valid recipients found in To field');
    }

    msg.setTo(toRecipients);

    if (Array.isArray(cc) && cc.length > 0) {
      const ccRecipients = cc
        .filter((recipient) => {
          const email = recipient.email.toLowerCase();
          if (!uniqueRecipients.has(email)) {
            uniqueRecipients.add(email);
            return true;
          }
          return false;
        })
        .map((recipient) => ({
          name: recipient.name || '',
          addr: recipient.email,
        }));
      msg.setCc(ccRecipients);
    }

    if (Array.isArray(bcc) && bcc.length > 0) {
      const bccRecipients = bcc
        .filter((recipient) => {
          const email = recipient.email.toLowerCase();
          if (!uniqueRecipients.has(email)) {
            uniqueRecipients.add(email);
            return true;
          }
          return false;
        })
        .map((recipient) => ({
          name: recipient.name || '',
          addr: recipient.email,
        }));
      msg.setBcc(bccRecipients);
    }

    msg.setSubject(subject || '');
    msg.addMessage({
      contentType: 'text/html',
      data: message.trim(),
    });

    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        msg.addAttachment({
          filename: attachment.filename,
          contentType: attachment.contentType,
          data: attachment.content,
        });
      }
    }

    return msg.asRaw();
  };

  const normalizeSearch = (folder: string, q: string) => {
    if (!q) return '';
    const searchValue = cleanSearchValue(q);
    return `contains(subject,'${searchValue}') or contains(body,'${searchValue}')`;
  };

  return {
    get: async (id: string) => {
      const client = getClient(config.auth?.access_token || '');
      console.log('get', id);
      const message: Message = await client.api(`/me/messages/${id}`).get();
      console.log('message', message);

      // Get all messages in the conversation using the conversationId
      //   const conversationMessages = await client
      //     .api('/me/messages')
      //     .filter(`conversationId eq '${message.conversationId}'`)
      //     .get();

      //   console.log('conversationMessages', conversationMessages);

      //   const messages = [null]
      return {
        messages: [
          {
            decodedBody: message.body?.content,
            processedHtml: message.body?.content,
            title: message.subject,
            blobUrl: message.body?.content,
            to: [],
            receivedOn: message.receivedDateTime
              ? new Date(message.receivedDateTime).toISOString()
              : new Date().toISOString(),
            threadId: message.id,
            id: message.id,
            messageId: message.id,
            subject: message.subject,
            sender: {
              email: message.sender?.emailAddress?.address,
              name: message.sender?.emailAddress?.name || message.sender?.emailAddress?.address,
            },
          },
        ],
        latest: {
          to: [],
          receivedOn: message.receivedDateTime
            ? new Date(message.receivedDateTime).toISOString()
            : new Date().toISOString(),
          threadId: message.id,
          id: message.id,
          messageId: message.id,
          subject: message.subject,
          sender: {
            email: message.sender?.emailAddress?.address,
            name: message.sender?.emailAddress?.name || message.sender?.emailAddress?.address,
          },
        },
        hasUnread: false,
        totalReplies: 4,
      };
    },

    create: async (data: IOutgoingMessage) => {
      const client = getClient(config.auth?.access_token || '');
      const rawMessage = await parseOutgoing(data);
      return client.api('/me/sendMail').post({
        message: {
          subject: data.subject,
          body: {
            contentType: 'HTML',
            content: data.message,
          },
          toRecipients: data.to.map((r) => ({ emailAddress: { address: r.email } })),
          ccRecipients: data.cc?.map((r) => ({ emailAddress: { address: r.email } })),
          bccRecipients: data.bcc?.map((r) => ({ emailAddress: { address: r.email } })),
        },
      });
    },

    createDraft: async (data: any) => {
      const client = getClient(config.auth?.access_token || '');
      return client.api('/me/messages').post({
        subject: data.subject,
        body: {
          contentType: 'HTML',
          content: data.message,
        },
        toRecipients: data.to.map((r: any) => ({ emailAddress: { address: r.email } })),
        ccRecipients: data.cc?.map((r: any) => ({ emailAddress: { address: r.email } })),
        bccRecipients: data.bcc?.map((r: any) => ({ emailAddress: { address: r.email } })),
      });
    },
    getUserLabels() {
      return new Promise((resolve) => resolve([]));
    },

    getDraft: async (id: string) => {
      const client = getClient(config.auth?.access_token || '');
      const draft = await client.api(`/me/messages/${id}`).get();
      //   return parseMessage(draft);
      return { id: id };
    },

    listDrafts: async (q?: string, maxResults = 20, pageToken?: string) => {
      const client = getClient(config.auth?.access_token || '');
      const response = await client
        .api('/me/messages')
        .filter('isDraft eq true')
        .top(1)
        .skip(pageToken ? parseInt(pageToken) : 0)
        .get();
      return {
        drafts: response.value.map(parseMessage),
        nextPageToken: response['@odata.nextLink']
          ? (parseInt(pageToken || '0') + maxResults).toString()
          : undefined,
      };
    },

    delete: async (id: string) => {
      const client = getClient(config.auth?.access_token || '');
      return client.api(`/me/messages/${id}`).delete();
    },

    list: async <T>(
      folder: string,
      query?: string,
      maxResults = 20,
      labelIds?: string[],
      pageToken?: string | number,
    ): Promise<(T & { threads: InitialThread[] }) | undefined> => {
      const client = getClient(config.auth?.access_token || '');
      //   const searchQuery = query ? normalizeSearch(folder, query) : '';
      const response = await client
        .api('/me/messages')
        // .filter(searchQuery)
        .top(3)
        // .skip(pageToken ? parseInt(pageToken.toString()) : 0)
        .get();

      //   console.log(response);

      const threads: InitialThread[] = (response.value as Message[]).map((message) => ({
        id: message.id ?? '',
        subject: message.subject,
        snippet: message.bodyPreview,
        unread: !message.isRead,
        date: message.receivedDateTime,
      }));

      const result = {
        threads,
        nextPageToken: response['@odata.nextLink']
          ? (parseInt(pageToken?.toString() || '0') + maxResults).toString()
          : undefined,
      };

      return result as unknown as T & { threads: InitialThread[] };
    },

    count: async () => {
      //   const client = getClient(config.auth?.access_token || '');
      //   const response = await client.api('/me/messages').get();
      return [];
    },

    generateConnectionAuthUrl: (userId: string) => {
      const params = new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID as string,
        redirect_uri: process.env.MICROSOFT_REDIRECT_URI as string,
        response_type: 'code',
        scope: getScope(),
        state: userId,
      });
      return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
    },

    getTokens: async (code: string) => {
      const params = new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID as string,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET as string,
        code,
        redirect_uri: process.env.MICROSOFT_REDIRECT_URI as string,
        grant_type: 'authorization_code',
      });

      const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error('Failed to get tokens');
      }

      const data = await response.json();
      return {
        tokens: {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expiry_date: Date.now() + data.expires_in * 1000,
        },
      };
    },

    getUserInfo: async (tokens: IConfig['auth']) => {
      if (!tokens?.access_token) throw new Error('No access token provided');
      const client = getClient(tokens.access_token);
      const user = await client.api('/me').get();
      return {
        address: user.mail || user.userPrincipalName,
        name: user.displayName,
        photo: null,
      };
    },

    getScope,

    markAsRead: async (ids: string[]) => {
      const client = getClient(config.auth?.access_token || '');
      await Promise.all(
        ids.map((id) =>
          client.api(`/me/messages/${id}`).patch({
            isRead: true,
          }),
        ),
      );
    },

    markAsUnread: async (ids: string[]) => {
      const client = getClient(config.auth?.access_token || '');
      await Promise.all(
        ids.map((id) =>
          client.api(`/me/messages/${id}`).patch({
            isRead: false,
          }),
        ),
      );
    },

    normalizeIds: (ids: string[]) => ({
      threadIds: ids,
    }),

    modifyLabels: async (
      ids: string[],
      options: { addLabels: string[]; removeLabels: string[] },
    ) => {
      const client = getClient(config.auth?.access_token || '');
      await Promise.all(
        ids.map((id) =>
          client.api(`/me/messages/${id}`).patch({
            categories: options.addLabels,
          }),
        ),
      );
    },

    getAttachment: async (messageId: string, attachmentId: string) => {
      const client = getClient(config.auth?.access_token || '');
      const attachment = await client
        .api(`/me/messages/${messageId}/attachments/${attachmentId}`)
        .get();
      return attachment.contentBytes;
    },
  };
};
