import { parseAddressList, parseFrom, wasSentWithTLS } from '@/lib/email-utils';
import { type IConfig, type MailManager } from './types';
import { type gmail_v1, google } from 'googleapis';
import { EnableBrain } from '@/actions/brain';
import { type ParsedMessage } from '@/types';
import * as he from 'he';

function fromBase64Url(str: string) {
  return str.replace(/-/g, '+').replace(/_/g, '/');
}

function fromBinary(str: string) {
  return decodeURIComponent(
    atob(str.replace(/-/g, '+').replace(/_/g, '/'))
      .split('')
      .map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join(''),
  );
}

const findHtmlBody = (parts: any[]): string => {
  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      console.log('✓ Driver: Found HTML content in message part');
      return part.body.data;
    }
    if (part.parts) {
      const found = findHtmlBody(part.parts);
      if (found) return found;
    }
  }
  console.log('⚠️ Driver: No HTML content found in message parts');
  return '';
};

interface ParsedDraft {
  id: string;
  to?: string[];
  subject?: string;
  content?: string;
  rawMessage?: gmail_v1.Schema$Message;
}

const parseDraft = (draft: gmail_v1.Schema$Draft): ParsedDraft | null => {
  if (!draft.message) return null;

  const headers = draft.message.payload?.headers || [];
  const to =
    headers
      .find((h) => h.name === 'To')
      ?.value?.split(',')
      .map((e) => e.trim())
      .filter(Boolean) || [];
  const subject = headers.find((h) => h.name === 'Subject')?.value;

  let content = '';
  const payload = draft.message.payload;

  if (payload) {
    if (payload.parts) {
      const textPart = payload.parts.find((part) => part.mimeType === 'text/plain');
      if (textPart?.body?.data) {
        content = fromBinary(textPart.body.data);
      }
    } else if (payload.body?.data) {
      content = fromBinary(payload.body.data);
    }
  }

  return {
    id: draft.id || '',
    to,
    subject: subject ? he.decode(subject).trim() : '',
    content,
    rawMessage: draft.message,
  };
};

export const driver = async (config: IConfig): Promise<MailManager> => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID as string,
    process.env.GOOGLE_CLIENT_SECRET as string,
    process.env.GOOGLE_REDIRECT_URI as string,
  );

  const getScope = () =>
    [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' ');
  if (config.auth) {
    auth.setCredentials({
      refresh_token: config.auth.refresh_token,
      scope: getScope(),
    });
    if (process.env.NODE_ENV === 'production') {
      EnableBrain()
        .then(() => console.log('✅ Driver: Enabled'))
        .catch(() => console.log('✅ Driver: Enabled'));
    }
  }
  const parse = ({
    id,
    threadId,
    snippet,
    labelIds,
    payload,
  }: gmail_v1.Schema$Message): Omit<
    ParsedMessage,
    'body' | 'processedHtml' | 'blobUrl' | 'totalReplies'
  > => {
    const receivedOn =
      payload?.headers?.find((h) => h.name?.toLowerCase() === 'date')?.value || 'Failed';
    const sender =
      payload?.headers?.find((h) => h.name?.toLowerCase() === 'from')?.value || 'Failed';
    const subject = payload?.headers?.find((h) => h.name?.toLowerCase() === 'subject')?.value || '';
    const references =
      payload?.headers?.find((h) => h.name?.toLowerCase() === 'references')?.value || '';
    const inReplyTo =
      payload?.headers?.find((h) => h.name?.toLowerCase() === 'in-reply-to')?.value || '';
    const messageId =
      payload?.headers?.find((h) => h.name?.toLowerCase() === 'message-id')?.value || '';
    const listUnsubscribe =
      payload?.headers?.find((h) => h.name?.toLowerCase() === 'list-unsubscribe')?.value ||
      undefined;
    const listUnsubscribePost =
      payload?.headers?.find((h) => h.name?.toLowerCase() === 'list-unsubscribe-post')?.value ||
      undefined;
    const toHeaders =
      payload?.headers
        ?.filter((h) => h.name?.toLowerCase() === 'to')
        .map((h) => h.value)
        .filter((v) => typeof v === 'string') || [];
    const to = toHeaders.flatMap((to) => parseAddressList(to));

    const ccHeaders =
      payload?.headers
        ?.filter((h) => h.name?.toLowerCase() === 'cc')
        .map((h) => h.value)
        .filter((v) => typeof v === 'string') || [];
    const cc = ccHeaders.flatMap((to) => parseAddressList(to));

    const receivedHeaders =
      payload?.headers
        ?.filter((header) => header.name?.toLowerCase() === 'received')
        .map((header) => header.value || '') || [];
    const hasTLSReport = payload?.headers?.some(
      (header) => header.name?.toLowerCase() === 'tls-report',
    );

    return {
      id: id || 'ERROR',
      threadId: threadId || '',
      title: snippet ? he.decode(snippet).trim() : 'ERROR',
      tls: wasSentWithTLS(receivedHeaders) || !!hasTLSReport,
      tags: labelIds || [],
      listUnsubscribe,
      listUnsubscribePost,
      references,
      inReplyTo,
      sender: parseFrom(sender),
      unread: labelIds ? labelIds.includes('UNREAD') : false,
      to,
      cc,
      receivedOn,
      subject: subject ? subject.replace(/"/g, '').trim() : '(no subject)',
      messageId,
    };
  };
  const normalizeSearch = (folder: string, q: string) => {
    // Handle special folders
    if (folder === 'trash') {
      return { folder: undefined, q: `in:trash ${q}` };
    }
    if (folder === 'archive') {
      return { folder: undefined, q: `in:archive ${q}` };
    }
    // Return the query as-is to preserve Gmail's native search syntax
    return { folder, q };
  };
  const gmail = google.gmail({ version: 'v1', auth });
  const manager = {
    getAttachment: async (messageId: string, attachmentId: string) => {
      try {
        const response = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId,
          id: attachmentId,
        });

        const attachmentData = response.data.data || '';

        const base64 = fromBase64Url(attachmentData);

        return base64;
      } catch (error) {
        console.error('Error fetching attachment:', error);
        throw error;
      }
    },
    markAsRead: async (id: string[]) => {
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: id,
          removeLabelIds: ['UNREAD'],
        },
      });
    },
    markAsUnread: async (id: string[]) => {
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: id,
          addLabelIds: ['UNREAD'],
        },
      });
    },
    getScope,
    getUserInfo: (tokens: { access_token: string; refresh_token: string }) => {
      auth.setCredentials({ ...tokens, scope: getScope() });
      return google
        .people({ version: 'v1', auth })
        .people.get({ resourceName: 'people/me', personFields: 'names,photos,emailAddresses' });
    },
    getTokens: async <T>(code: string) => {
      try {
        const { tokens } = await auth.getToken(code);
        return { tokens } as T;
      } catch (error) {
        console.error('Error getting tokens:', error);
        throw error;
      }
    },
    generateConnectionAuthUrl: (userId: string) => {
      return auth.generateAuthUrl({
        access_type: 'offline',
        scope: getScope(),
        include_granted_scopes: true,
        prompt: 'consent',
        state: userId,
      });
    },
    count: async () => {
      const userLabels = await gmail.users.labels.list({
        userId: 'me',
      });

      if (!userLabels.data.labels) {
        return { count: 0 };
      }
      return Promise.all(
        userLabels.data.labels.map(async (label) => {
          const res = await gmail.users.labels.get({
            userId: 'me',
            id: label.id ?? undefined,
          });
          return {
            label: res.data.name ?? res.data.id ?? '',
            count: res.data.threadsUnread,
          };
        }),
      );
    },
    list: async (
      folder: string,
      q: string,
      maxResults = 20,
      _labelIds: string[] = [],
      pageToken?: string,
    ) => {
      const { folder: normalizedFolder, q: normalizedQ } = normalizeSearch(folder, q ?? '');
      const labelIds = [..._labelIds];
      if (normalizedFolder) labelIds.push(normalizedFolder.toUpperCase());
      const res = await gmail.users.threads.list({
        userId: 'me',
        q: normalizedQ ? normalizedQ : undefined,
        labelIds,
        maxResults,
        pageToken: pageToken ? pageToken : undefined,
      });
      const threads = await Promise.all(
        (res.data.threads || [])
          .map(async (thread) => {
            if (!thread.id) return null;
            const msg = await gmail.users.threads.get({
              userId: 'me',
              id: thread.id,
              format: 'metadata',
              metadataHeaders: ['From', 'Subject', 'Date'],
            });
            const labelIds = [
              ...new Set(msg.data.messages?.flatMap((message) => message.labelIds || [])),
            ];
            const latestMessage = msg.data.messages?.reverse()?.find((msg) => {
              const parsedMessage = parse({ ...msg, labelIds });
              return parsedMessage.sender.email !== config.auth?.email
            })
            const message = latestMessage ? latestMessage : msg.data.messages?.[0]
            const parsed = parse({ ...message, labelIds });
            return {
              ...parsed,
              body: '',
              processedHtml: '',
              blobUrl: '',
              totalReplies: msg.data.messages?.length || 0,
              threadId: thread.id,
            };
          })
          .filter((msg): msg is NonNullable<typeof msg> => msg !== null),
      );

      return { ...res.data, threads } as any;
    },
    get: async (id: string): Promise<ParsedMessage[]> => {
      console.log('Fetching thread:', id);
      const res = await gmail.users.threads.get({ userId: 'me', id, format: 'full' });
      if (!res.data.messages) return [];

      const messages = await Promise.all(
        res.data.messages.map(async (message) => {
          const bodyData =
            message.payload?.body?.data ||
            (message.payload?.parts ? findHtmlBody(message.payload.parts) : '') ||
            message.payload?.parts?.[0]?.body?.data ||
            '';

          if (!bodyData) {
            console.log('⚠️ Driver: No email body data found');
          } else {
            console.log('✓ Driver: Found email body data');
          }

          console.log('🔄 Driver: Processing email body...');
          const decodedBody = bodyData ? fromBinary(bodyData) : '';

          // Process inline images if present
          let processedBody = decodedBody;
          if (message.payload?.parts) {
            const inlineImages = message.payload.parts
              .filter(part => {
                const contentDisposition = part.headers?.find(h => h.name?.toLowerCase() === 'content-disposition')?.value || '';
                const isInline = contentDisposition.toLowerCase().includes('inline');
                const hasContentId = part.headers?.some(h => h.name?.toLowerCase() === 'content-id');
                return isInline && hasContentId;
              });

            for (const part of inlineImages) {
              const contentId = part.headers?.find(h => h.name?.toLowerCase() === 'content-id')?.value;
              if (contentId && part.body?.attachmentId) {
                try {
                  const imageData = await manager.getAttachment(message.id!, part.body.attachmentId);
                  if (imageData) {
                    // Remove < and > from Content-ID if present
                    const cleanContentId = contentId.replace(/[<>]/g, '');

                    const escapedContentId = cleanContentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    // Replace cid: URL with data URL
                    processedBody = processedBody.replace(
                      new RegExp(`cid:${escapedContentId}`, 'g'),
                      `data:${part.mimeType};base64,${imageData}`
                    );
                  }
                } catch (error) {
                  console.error('Failed to process inline image:', error);
                }
              }
            }
          }

          console.log('✅ Driver: Email processing complete', {
            hasBody: !!bodyData,
            decodedBodyLength: processedBody.length,
          });

          const parsedData = parse(message);

          const attachments = await Promise.all(
            message.payload?.parts
              ?.filter((part) => {
                if (!part.filename || part.filename.length === 0) return false;
                
                const contentDisposition = part.headers?.find(h => h.name?.toLowerCase() === 'content-disposition')?.value || '';
                const isInline = contentDisposition.toLowerCase().includes('inline');
                
                const hasContentId = part.headers?.some(h => h.name?.toLowerCase() === 'content-id');
                
                return !isInline || (isInline && !hasContentId);
              })
              ?.map(async (part) => {
                console.log('Processing attachment:', part.filename);
                const attachmentId = part.body?.attachmentId;
                if (!attachmentId) {
                  console.log('No attachment ID found for', part.filename);
                  return null;
                }

                try {
                  if (!message.id) {
                    console.error('No message ID found for attachment');
                    return null;
                  }
                  const attachmentData = await manager.getAttachment(message.id, attachmentId);
                  console.log('Fetched attachment data:', {
                    filename: part.filename,
                    mimeType: part.mimeType,
                    size: part.body?.size,
                    dataLength: attachmentData?.length || 0,
                    hasData: !!attachmentData,
                  });
                  return {
                    filename: part.filename || '',
                    mimeType: part.mimeType || '',
                    size: Number(part.body?.size || 0),
                    attachmentId: attachmentId,
                    headers: part.headers || [],
                    body: attachmentData,
                  };
                } catch (error) {
                  console.error('Failed to fetch attachment:', part.filename, error);
                  return null;
                }
              }) || [],
          ).then((attachments) =>
            attachments.filter((a): a is NonNullable<typeof a> => a !== null),
          );

          console.log('ATTACHMENTS:', attachments);

          const fullEmailData = {
            ...parsedData,
            body: '',
            processedHtml: '',
            blobUrl: '',
            decodedBody: processedBody,
            attachments,
          };

          console.log('📧 Driver: Returning email data', {
            id: fullEmailData.id,
            hasBody: !!fullEmailData.body,
            hasBlobUrl: !!fullEmailData.blobUrl,
            blobUrlLength: fullEmailData.blobUrl.length,
          });

          return fullEmailData;
        }),
      );
      return messages;
    },
    create: async (data: any) => {
      const res = await gmail.users.messages.send({ userId: 'me', requestBody: data });
      return res.data;
    },
    delete: async (id: string) => {
      const res = await gmail.users.messages.delete({ userId: 'me', id });
      return res.data;
    },
    normalizeIds: (ids: string[]) => {
      const threadIds: string[] = ids.map((id) =>
        id.startsWith('thread:') ? id.substring(7) : id,
      );
      return { threadIds };
    },
    async modifyLabels(threadIds: string[], options: { addLabels: string[]; removeLabels: string[] }) {
      const threadResults = await Promise.allSettled(
        threadIds.map(threadId =>
          gmail.users.threads.get({
            userId: 'me',
            id: threadId,
            format: 'minimal'
          })
        )
      );

      const messageIds = threadResults
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .flatMap(result => result.value.data.messages || [])
        .map(msg => msg.id)
        .filter((id): id is string => !!id);

      if (messageIds.length > 0) {
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: messageIds,
            addLabelIds: options.addLabels,
            removeLabelIds: options.removeLabels,
          },
        });
      }
    },
    getDraft: async (draftId: string) => {
      try {
        const res = await gmail.users.drafts.get({
          userId: 'me',
          id: draftId,
          format: 'full',
        });

        if (!res.data) {
          throw new Error('Draft not found');
        }

        const parsedDraft = parseDraft(res.data);
        if (!parsedDraft) {
          throw new Error('Failed to parse draft');
        }

        return parsedDraft;
      } catch (error) {
        console.error('Error loading draft:', error);
        throw error;
      }
    },
    listDrafts: async (q?: string, maxResults = 20, pageToken?: string) => {
      const { q: normalizedQ } = normalizeSearch('', q ?? '');
      const res = await gmail.users.drafts.list({
        userId: 'me',
        q: normalizedQ ? normalizedQ : undefined,
        maxResults,
        pageToken: pageToken ? pageToken : undefined,
      });

      const drafts = await Promise.all(
        (res.data.drafts || [])
          .map(async (draft) => {
            if (!draft.id) return null;
            const msg = await gmail.users.drafts.get({
              userId: 'me',
              id: draft.id,
            });
            const message = msg.data.message;
            const parsed = parse(message as any);
            return {
              ...parsed,
              id: draft.id,
              threadId: draft.message?.id,
            };
          })
          .filter((msg): msg is NonNullable<typeof msg> => msg !== null),
      );

      return { ...res.data, drafts } as any;
    },
    createDraft: async (data: any) => {
      const mimeMessage = [
        `From: me`,
        `To: ${data.to}`,
        `Subject: ${data.subject}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        data.message,
      ].join('\n');

      const encodedMessage = Buffer.from(mimeMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const requestBody = {
        message: {
          raw: encodedMessage,
        },
      };

      let res;

      if (data.id) {
        res = await gmail.users.drafts.update({
          userId: 'me',
          id: data.id,
          requestBody,
        });
      } else {
        res = await gmail.users.drafts.create({
          userId: 'me',
          requestBody,
        });
      }

      return res.data;
    },
  };

  return manager;
};
