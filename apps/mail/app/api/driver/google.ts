import { parseAddressList, parseFrom, wasSentWithTLS } from '@/lib/email-utils';
import { type IConfig, type MailManager } from './types';
import { type gmail_v1, google } from 'googleapis';
import { EnableBrain } from '@/actions/brain';
import { IOutgoingMessage, Sender, type ParsedMessage } from '@/types';
import * as he from 'he';
import { createMimeMessage } from 'mimetext';

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

// Helper function for delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
    const replyTo =
      payload?.headers?.find((h) => h.name?.toLowerCase() === 'reply-to')?.value || undefined;
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

    const cc = ccHeaders.length > 0
      ? ccHeaders
        .filter(header => header.trim().length > 0)
        .flatMap(header => parseAddressList(header))
      : null;

    const receivedHeaders =
      payload?.headers
        ?.filter((header) => header.name?.toLowerCase() === 'received')
        .map((header) => header.value || '') || [];
    const hasTLSReport = payload?.headers?.some(
      (header) => header.name?.toLowerCase() === 'tls-report',
    );

    return {
      id: id || 'ERROR',
      bcc: [],
      threadId: threadId || '',
      title: snippet ? he.decode(snippet).trim() : 'ERROR',
      tls: wasSentWithTLS(receivedHeaders) || !!hasTLSReport,
      tags: labelIds || [],
      listUnsubscribe,
      listUnsubscribePost,
      replyTo,
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
  const parseOutgoing = async ({ to, subject, message, attachments, headers, cc, bcc }: IOutgoingMessage) => {
    const msg = createMimeMessage();

    const fromEmail = config.auth?.email || 'nobody@example.com';
    console.log('Debug - From email:', fromEmail);
    console.log('Debug - Original to recipients:', JSON.stringify(to, null, 2));
    
    msg.setSender({ name: '', addr: fromEmail });

    // Track unique recipients to avoid duplicates
    const uniqueRecipients = new Set<string>();

    if (!Array.isArray(to)) {
      console.error('Debug - To field is not an array:', to);
      throw new Error('Recipient address required');
    }

    if (to.length === 0) {
      console.error('Debug - To array is empty');
      throw new Error('Recipient address required');
    }

    // Handle all To recipients
    const toRecipients = to
      .filter(recipient => {
        if (!recipient || !recipient.email) {
          console.log('Debug - Skipping invalid recipient:', recipient);
          return false;
        }

        const email = recipient.email.toLowerCase();
        console.log('Debug - Processing recipient:', {
          originalEmail: recipient.email,
          normalizedEmail: email,
          fromEmail,
          isDuplicate: uniqueRecipients.has(email),
          isSelf: email === fromEmail
        });
        
        // Only check for duplicates, allow sending to yourself
        if (!uniqueRecipients.has(email)) {
          uniqueRecipients.add(email);
          return true;
        }
        return false;
      })
      .map(recipient => ({
        name: recipient.name || '',
        addr: recipient.email
      }));

    console.log('Debug - Filtered to recipients:', JSON.stringify(toRecipients, null, 2));

    if (toRecipients.length > 0) {
      msg.setRecipients(toRecipients);
    } else {
      console.error('Debug - No valid recipients after filtering:', {
        originalTo: to,
        filteredTo: toRecipients,
        fromEmail
      });
      throw new Error('No valid recipients found in To field');
    }

    // Handle CC recipients
    if (Array.isArray(cc) && cc.length > 0) {
      const ccRecipients = cc
        .filter(recipient => {
          const email = recipient.email.toLowerCase();
          if (!uniqueRecipients.has(email) && email !== fromEmail) {
            uniqueRecipients.add(email);
            return true;
          }
          return false;
        })
        .map(recipient => ({
          name: recipient.name || '',
          addr: recipient.email
        }));

      if (ccRecipients.length > 0) {
        msg.setCc(ccRecipients);
      }
    }

    // Handle BCC recipients
    if (Array.isArray(bcc) && bcc.length > 0) {
      const bccRecipients = bcc
        .filter(recipient => {
          const email = recipient.email.toLowerCase();
          if (!uniqueRecipients.has(email) && email !== fromEmail) {
            uniqueRecipients.add(email);
            return true;
          }
          return false;
        })
        .map(recipient => ({
          name: recipient.name || '',
          addr: recipient.email
        }));
      
      if (bccRecipients.length > 0) {
        msg.setBcc(bccRecipients);
      }
    }

    msg.setSubject(subject);

    msg.addMessage({
      contentType: 'text/html',
      data: message.trim()
    });

    // Set headers for reply/reply-all/forward
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        if (value) {
          // Ensure References header includes all previous message IDs
          if (key.toLowerCase() === 'references' && value) {
            const refs = value.split(' ').filter(Boolean).map(ref => {
              // Add angle brackets if not present
              if (!ref.startsWith('<')) ref = `<${ref}`;
              if (!ref.endsWith('>')) ref = `${ref}>`;
              return ref;
            });
            msg.setHeader(key, refs.join(' '));
          } else {
            msg.setHeader(key, value);
          }
        }
      });
    }

    // Handle attachments
    if (attachments?.length > 0) {
      for (const file of attachments) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Content = buffer.toString("base64");

        msg.addAttachment({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          data: base64Content
        });
      }
    }

    const emailContent = msg.asRaw();
    const encodedMessage = Buffer.from(emailContent).toString("base64");

    return {
      raw: encodedMessage,
    }
  }
  const normalizeSearch = (folder: string, q: string) => {
    // Handle special folders
    if (folder === 'bin') {
      return { folder: undefined, q: `in:trash` };
    }
    if (folder === 'archive') {
      return { folder: undefined, q: `in:archive` };
    }
    if (folder !== 'inbox') {
      return { folder, q: `in:${folder}` };
    }
    // Return the query as-is to preserve Gmail's native search syntax
    return { folder, q };
  };
  const gmail = google.gmail({ version: 'v1', auth });

  const modifyThreadLabels = async (
    threadIds: string[], 
    requestBody: gmail_v1.Schema$ModifyThreadRequest
  ) => {
    if (threadIds.length === 0) { 
      return; 
    }

    const chunkSize = 15; 
    const delayBetweenChunks = 100;
    const allResults = [];

    for (let i = 0; i < threadIds.length; i += chunkSize) {
      const chunk = threadIds.slice(i, i + chunkSize);
      
      const promises = chunk.map(async (threadId) => {
        try {
          const response = await gmail.users.threads.modify({
            userId: 'me',
            id: threadId,
            requestBody: requestBody,
          });
          return { threadId, status: 'fulfilled' as const, value: response.data };
        } catch (error: any) { 
          const errorMessage = error?.errors?.[0]?.message || error.message || error;
          console.error(`Failed bulk modify operation for thread ${threadId}:`, errorMessage);
          return { threadId, status: 'rejected' as const, reason: { error: errorMessage } };
        }
      });

      const chunkResults = await Promise.all(promises);
      allResults.push(...chunkResults);

      if (i + chunkSize < threadIds.length) {
        await delay(delayBetweenChunks);
      }
    }

    const failures = allResults.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      const failureReasons = failures.map(f => ({ threadId: f.threadId, reason: f.reason }));
      console.error(`Failed bulk modify operation for ${failures.length}/${threadIds.length} threads:`, failureReasons);
    }
  };

  const manager: MailManager = {
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
    markAsRead: async (threadIds: string[]) => {
      await modifyThreadLabels(threadIds, { removeLabelIds: ['UNREAD'] });
    },
    markAsUnread: async (threadIds: string[]) => {
      await modifyThreadLabels(threadIds, { addLabelIds: ['UNREAD'] });
    },
    getScope,
    getUserInfo: (tokens: IConfig['auth']) => {
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
        labelIds: folder === 'inbox' ? labelIds : [],
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
                    body: attachmentData ?? '',
                  };
                } catch (error) {
                  console.error('Failed to fetch attachment:', part.filename, error);
                  return null;
                }
              }) || [],
          ).then((attachments) =>
            attachments.filter((a): a is NonNullable<typeof a> => a !== null),
          );

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
            labels: fullEmailData.tags,
          });

          return fullEmailData;
        }),
      );
      return messages;
    },
    create: async (data) => {
      const { raw } = await parseOutgoing(data)
      console.log('Debug - Sending message with threading info:', {
        threadId: data.threadId,
        headers: data.headers
      });
      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw,
          threadId: data.threadId
        }
      });
      console.log('Debug - Message sent successfully:', {
        messageId: res.data.id,
        threadId: res.data.threadId
      });
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
    modifyLabels: async (threadIds: string[], options: { addLabels: string[]; removeLabels: string[] }) => {
      await modifyThreadLabels(threadIds, {
        addLabelIds: options.addLabels,
        removeLabelIds: options.removeLabels,
      });
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
      console.log('Fetching drafts with params:', { q, maxResults, pageToken });
      const { q: normalizedQ } = normalizeSearch('', q ?? '');
      try {
        const res = await gmail.users.drafts.list({
          userId: 'me',
          q: normalizedQ ? normalizedQ : undefined,
          maxResults,
          pageToken: pageToken ? pageToken : undefined,
        });

        console.log('Draft list response:', res.data);

        const drafts = await Promise.all(
          (res.data.drafts || [])
            .map(async (draft) => {
              if (!draft.id) return null;
              try {
                const msg = await gmail.users.drafts.get({
                  userId: 'me',
                  id: draft.id,
                  format: 'full',
                });
                console.log(`Fetched draft ${draft.id}:`, msg.data);
                const message = msg.data.message;
                if (!message) return null;
                
                const parsed = parse(message as any);
                const headers = message.payload?.headers || [];
                const date = headers.find(h => h.name?.toLowerCase() === 'date')?.value;
                
                return {
                  ...parsed,
                  id: draft.id,
                  threadId: draft.message?.id,
                  receivedOn: date || new Date().toISOString(),
                };
              } catch (error) {
                console.error(`Error fetching draft ${draft.id}:`, error);
                return null;
              }
            })
            .filter((msg): msg is NonNullable<typeof msg> => msg !== null),
        );

        // Sort drafts by date, newest first
        const sortedDrafts = [...drafts].sort((a, b) => {
          const dateA = new Date(a?.receivedOn || new Date()).getTime();
          const dateB = new Date(b?.receivedOn || new Date()).getTime();
          return dateB - dateA;
        });

        return { ...res.data, drafts: sortedDrafts } as any;
      } catch (error) {
        console.error('Error listing drafts:', error);
        throw error;
      }
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
