import { parseAddressList, parseFrom, wasSentWithTLS } from '@/lib/email-utils';
import { deleteActiveConnection, FatalErrors } from '@/actions/utils';
import { IOutgoingMessage, type ParsedMessage } from '@/types';
import { type IConfig, type MailManager } from './types';
import { type gmail_v1, google } from 'googleapis';
import { filterSuggestions } from '@/lib/filter';
import { GMAIL_COLORS } from '@/lib/constants';
import { cleanSearchValue } from '@/lib/utils';
import { createMimeMessage } from 'mimetext';
import * as he from 'he';

class StandardizedError extends Error {
  code: string;
  operation: string;
  context?: Record<string, any>;
  originalError: unknown;
  constructor(error: Error & { code: string }, operation: string, context?: Record<string, any>) {
    super(error?.message || 'An unknown error occurred');
    this.name = 'StandardizedError';
    this.code = error?.code || 'UNKNOWN_ERROR';
    this.operation = operation;
    this.context = context;
    this.originalError = error;
  }
}

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
      return part.body.data;
    }
    if (part.parts) {
      const found = findHtmlBody(part.parts);
      if (found) return found;
    }
  }
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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withExponentialBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000,
  maxDelay = 10000,
): Promise<T> => {
  let retries = 0;
  let delayMs = initialDelay;

  while (true) {
    try {
      return await operation();
    } catch (error: any) {
      if (retries >= maxRetries) {
        throw error;
      }

      const isRateLimit =
        error?.code === 429 ||
        error?.errors?.[0]?.reason === 'rateLimitExceeded' ||
        error?.errors?.[0]?.reason === 'userRateLimitExceeded';

      if (!isRateLimit) {
        throw error;
      }

      await delay(delayMs);

      delayMs = Math.min(delayMs * 2 + Math.random() * 1000, maxDelay);
      retries++;
    }
  }
};

function sanitizeContext(context?: Record<string, any>) {
  if (!context) return undefined;
  const sanitized = { ...context };
  const sensitive = ['tokens', 'refresh_token', 'code', 'message', 'raw', 'data'];
  for (const key of sensitive) {
    if (key in sanitized) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
}

const withErrorHandler = async <T>(
  operation: string,
  fn: () => Promise<T> | T,
  context?: Record<string, any>,
): Promise<T> => {
  try {
    return await Promise.resolve(fn());
  } catch (error: any) {
    const isFatal = FatalErrors.includes(error.message);
    console.error(`[${isFatal ? 'FATAL_ERROR' : 'ERROR'}] [Gmail Driver] Operation: ${operation}`, {
      error: error.message,
      code: error.code,
      context: sanitizeContext(context),
      stack: error.stack,
      isFatal,
    });
    if (isFatal) await deleteActiveConnection();
    throw new StandardizedError(error, operation, context);
  }
};

const withSyncErrorHandler = <T>(
  operation: string,
  fn: () => T,
  context?: Record<string, any>,
): T => {
  try {
    return fn();
  } catch (error: any) {
    const isFatal = FatalErrors.includes(error.message);
    console.error(`[Gmail Driver Error] Operation: ${operation}`, {
      error: error.message,
      code: error.code,
      context: sanitizeContext(context),
      stack: error.stack,
      isFatal,
    });
    if (isFatal) void deleteActiveConnection();
    throw new StandardizedError(error, operation, context);
  }
};

const getScope = () =>
  [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' ');

export const driver = async (config: IConfig): Promise<MailManager> => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID as string,
    process.env.GOOGLE_CLIENT_SECRET as string,
    process.env.GOOGLE_REDIRECT_URI as string,
  );

  if (config.auth) {
    auth.setCredentials({
      refresh_token: config.auth.refresh_token,
      scope: getScope(),
    });
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

    const cc =
      ccHeaders.length > 0
        ? ccHeaders
            .filter((header) => header.trim().length > 0)
            .flatMap((header) => parseAddressList(header))
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
  const parseOutgoing = async ({
    to,
    subject,
    message,
    attachments,
    headers,
    cc,
    bcc,
    fromEmail,
  }: IOutgoingMessage) => {
    const msg = createMimeMessage();

    const defaultFromEmail = config.auth?.email || 'nobody@example.com';
    const senderEmail = fromEmail || defaultFromEmail;

    msg.setSender({ name: '', addr: senderEmail });

    const uniqueRecipients = new Set<string>();

    if (!Array.isArray(to)) {
      throw new Error('Recipient address required');
    }

    if (to.length === 0) {
      throw new Error('Recipient address required');
    }

    const toRecipients = to
      .filter((recipient) => {
        if (!recipient || !recipient.email) {
          return false;
        }

        const email = recipient.email.toLowerCase();

        if (!uniqueRecipients.has(email)) {
          uniqueRecipients.add(email);
          return true;
        }
        return false;
      })
      .map((recipient) => {
        const emailMatch = recipient.email.match(/<([^>]+)>/);
        const email = emailMatch ? emailMatch[1] : recipient.email;
        if (!email) {
          throw new Error('Invalid email address');
        }
        return {
          name: recipient.name || '',
          addr: email,
        };
      });

    if (toRecipients.length > 0) {
      msg.setRecipients(toRecipients);
    } else {
      throw new Error('No valid recipients found in To field');
    }

    if (Array.isArray(cc) && cc.length > 0) {
      const ccRecipients = cc
        .filter((recipient) => {
          const email = recipient.email.toLowerCase();
          if (!uniqueRecipients.has(email) && email !== senderEmail) {
            uniqueRecipients.add(email);
            return true;
          }
          return false;
        })
        .map((recipient) => ({
          name: recipient.name || '',
          addr: recipient.email,
        }));

      if (ccRecipients.length > 0) {
        msg.setCc(ccRecipients);
      }
    }

    if (Array.isArray(bcc) && bcc.length > 0) {
      const bccRecipients = bcc
        .filter((recipient) => {
          const email = recipient.email.toLowerCase();
          if (!uniqueRecipients.has(email) && email !== senderEmail) {
            uniqueRecipients.add(email);
            return true;
          }
          return false;
        })
        .map((recipient) => ({
          name: recipient.name || '',
          addr: recipient.email,
        }));

      if (bccRecipients.length > 0) {
        msg.setBcc(bccRecipients);
      }
    }

    msg.setSubject(subject);

    msg.addMessage({
      contentType: 'text/html',
      data: message.trim(),
    });

    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        if (value) {
          if (key.toLowerCase() === 'references' && value) {
            const refs = value
              .split(' ')
              .filter(Boolean)
              .map((ref) => {
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

    if (attachments?.length > 0) {
      for (const file of attachments) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Content = buffer.toString('base64');

        msg.addAttachment({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          data: base64Content,
        });
      }
    }

    const emailContent = msg.asRaw();
    const encodedMessage = Buffer.from(emailContent).toString('base64');

    return {
      raw: encodedMessage,
    };
  };
  const normalizeSearch = (folder: string, q: string) => {
    if (folder !== 'inbox') {
      q = cleanSearchValue(q);
      if (folder === 'bin') {
        return { folder: undefined, q: `in:trash ${q}` };
      }
      if (folder === 'archive') {
        return { folder: undefined, q: `in:archive ${q}` };
      }
      return { folder, q: `in:${folder} ${q}` };
    }
    return { folder, q };
  };
  const gmail = google.gmail({ version: 'v1', auth });

  const modifyThreadLabels = async (
    threadIds: string[],
    requestBody: gmail_v1.Schema$ModifyThreadRequest,
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
          return { threadId, status: 'rejected' as const, reason: { error: errorMessage } };
        }
      });

      const chunkResults = await Promise.all(promises);
      allResults.push(...chunkResults);

      if (i + chunkSize < threadIds.length) {
        await delay(delayBetweenChunks);
      }
    }

    const failures = allResults.filter((result) => result.status === 'rejected');
    if (failures.length > 0) {
      const failureReasons = failures.map((f) => ({ threadId: f.threadId, reason: f.reason }));
    }
  };

  const manager: MailManager = {
    getAttachment: async (messageId: string, attachmentId: string) => {
      return withErrorHandler(
        'getAttachment',
        async () => {
          const response = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId,
            id: attachmentId,
          });

          const attachmentData = response.data.data || '';

          const base64 = fromBase64Url(attachmentData);

          return base64;
        },
        { messageId, attachmentId },
      );
    },
    getEmailAliases: async () => {
      return withErrorHandler('getEmailAliases', async () => {
        const profile = await gmail.users.getProfile({
          userId: 'me',
        });

        const primaryEmail = profile.data.emailAddress || '';
        const aliases: { email: string; name?: string; primary?: boolean }[] = [
          { email: primaryEmail, primary: true },
        ];

        const settings = await gmail.users.settings.sendAs.list({
          userId: 'me',
        });

        if (settings.data.sendAs) {
          settings.data.sendAs.forEach((alias) => {
            if (alias.isPrimary && alias.sendAsEmail === primaryEmail) {
              return;
            }

            aliases.push({
              email: alias.sendAsEmail || '',
              name: alias.displayName || undefined,
              primary: alias.isPrimary || false,
            });
          });
        }

        return aliases;
      });
    },
    markAsRead: async (threadIds: string[]) => {
      return withErrorHandler(
        'markAsRead',
        async () => {
          await modifyThreadLabels(threadIds, { removeLabelIds: ['UNREAD'] });
        },
        { threadIds },
      );
    },
    markAsUnread: async (threadIds: string[]) => {
      return withErrorHandler(
        'markAsUnread',
        async () => {
          await modifyThreadLabels(threadIds, { addLabelIds: ['UNREAD'] });
        },
        { threadIds },
      );
    },
    getScope,
    getUserInfo: (tokens: IConfig['auth']) => {
      return withErrorHandler(
        'getUserInfo',
        () => {
          auth.setCredentials({ ...tokens, scope: getScope() });
          return google
            .people({ version: 'v1', auth })
            .people.get({ resourceName: 'people/me', personFields: 'names,photos,emailAddresses' });
        },
        { tokens },
      );
    },
    getTokens: async <T>(code: string) => {
      return withErrorHandler(
        'getTokens',
        async () => {
          const { tokens } = await auth.getToken(code);
          return { tokens } as T;
        },
        { code },
      );
    },
    generateConnectionAuthUrl: (userId: string) => {
      return withSyncErrorHandler(
        'generateConnectionAuthUrl',
        () => {
          return auth.generateAuthUrl({
            access_type: 'offline',
            scope: getScope(),
            include_granted_scopes: true,
            prompt: 'consent',
            state: userId,
          });
        },
        { userId },
      );
    },
    count: async () => {
      return withErrorHandler('count', async () => {
        const userLabels = await gmail.users.labels.list({
          userId: 'me',
        });

        if (!userLabels.data.labels) {
          return [];
        }
        return Promise.all(
          userLabels.data.labels.map(async (label) => {
            const res = await gmail.users.labels.get({
              userId: 'me',
              id: label.id ?? undefined,
            });
            return {
              label: res.data.name ?? res.data.id ?? '',
              count: Number(res.data.threadsUnread) ?? undefined,
            };
          }),
        );
      });
    },
    list: async (
      folder: string,
      q: string,
      maxResults = 20,
      _labelIds: string[] = [],
      pageToken?: string,
    ) => {
      return withErrorHandler(
        'list',
        async () => {
          const { folder: normalizedFolder, q: normalizedQ } = normalizeSearch(folder, q ?? '');
          const labelIds = [..._labelIds];
          if (normalizedFolder) labelIds.push(normalizedFolder.toUpperCase());

          const res = await gmail.users.threads.list({
            userId: 'me',
            q: normalizedQ ? normalizedQ : undefined,
            labelIds: folder === 'inbox' ? labelIds : [],
            maxResults,
            pageToken: pageToken ? pageToken : undefined,
            quotaUser: config.auth?.email,
          });
          return { ...res.data, threads: res.data.threads } as any;
        },
        { folder, q, maxResults, _labelIds, pageToken },
      );
    },
    get: async (id: string) => {
      return withErrorHandler(
        'get',
        async () => {
          return withExponentialBackoff(async () => {
            const res = await gmail.users.threads.get({
              userId: 'me',
              id,
              format: 'full',
              quotaUser: config.auth?.email,
            });
            if (!res.data.messages)
              return { messages: [], latest: undefined, hasUnread: false, totalReplies: 0 };
            let hasUnread = false;
            const messages: ParsedMessage[] = await Promise.all(
              res.data.messages.map(async (message) => {
                const bodyData =
                  message.payload?.body?.data ||
                  (message.payload?.parts ? findHtmlBody(message.payload.parts) : '') ||
                  message.payload?.parts?.[0]?.body?.data ||
                  '';

                const decodedBody = bodyData ? fromBinary(bodyData) : '';

                let processedBody = decodedBody;
                if (message.payload?.parts) {
                  const inlineImages = message.payload.parts.filter((part) => {
                    const contentDisposition =
                      part.headers?.find((h) => h.name?.toLowerCase() === 'content-disposition')
                        ?.value || '';
                    const isInline = contentDisposition.toLowerCase().includes('inline');
                    const hasContentId = part.headers?.some(
                      (h) => h.name?.toLowerCase() === 'content-id',
                    );
                    return isInline && hasContentId;
                  });

                  for (const part of inlineImages) {
                    const contentId = part.headers?.find(
                      (h) => h.name?.toLowerCase() === 'content-id',
                    )?.value;
                    if (contentId && part.body?.attachmentId) {
                      try {
                        const imageData = await manager.getAttachment(
                          message.id!,
                          part.body.attachmentId,
                        );
                        if (imageData) {
                          const cleanContentId = contentId.replace(/[<>]/g, '');

                          const escapedContentId = cleanContentId.replace(
                            /[.*+?^${}()|[\]\\]/g,
                            '\\$&',
                          );
                          processedBody = processedBody.replace(
                            new RegExp(`cid:${escapedContentId}`, 'g'),
                            `data:${part.mimeType};base64,${imageData}`,
                          );
                        }
                      } catch (error) {}
                    }
                  }
                }

                const parsedData = parse(message);

                const attachments = await Promise.all(
                  message.payload?.parts
                    ?.filter((part) => {
                      if (!part.filename || part.filename.length === 0) return false;

                      const contentDisposition =
                        part.headers?.find((h) => h.name?.toLowerCase() === 'content-disposition')
                          ?.value || '';
                      const isInline = contentDisposition.toLowerCase().includes('inline');

                      const hasContentId = part.headers?.some(
                        (h) => h.name?.toLowerCase() === 'content-id',
                      );

                      return !isInline || (isInline && !hasContentId);
                    })
                    ?.map(async (part) => {
                      const attachmentId = part.body?.attachmentId;
                      if (!attachmentId) {
                        return null;
                      }

                      try {
                        if (!message.id) {
                          return null;
                        }
                        const attachmentData = await manager.getAttachment(
                          message.id,
                          attachmentId,
                        );
                        return {
                          filename: part.filename || '',
                          mimeType: part.mimeType || '',
                          size: Number(part.body?.size || 0),
                          attachmentId: attachmentId,
                          headers: part.headers || [],
                          body: attachmentData ?? '',
                        };
                      } catch (error) {
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

                if (fullEmailData.unread) hasUnread = true;

                return fullEmailData;
              }),
            );
            return { messages, latest: messages[0], hasUnread, totalReplies: messages.length };
          });
        },
        { id },
      );
    },
    create: async (data) => {
      return withErrorHandler(
        'create',
        async () => {
          const { raw } = await parseOutgoing(data);
          const res = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
              raw,
              threadId: data.threadId,
            },
          });
          return res.data;
        },
        { data },
      );
    },
    delete: async (id: string) => {
      return withErrorHandler(
        'delete',
        async () => {
          const res = await gmail.users.messages.delete({ userId: 'me', id });
          return res.data;
        },
        { id },
      );
    },
    normalizeIds: (ids: string[]) => {
      return withSyncErrorHandler(
        'normalizeIds',
        () => {
          const threadIds: string[] = ids.map((id) =>
            id.startsWith('thread:') ? id.substring(7) : id,
          );
          return { threadIds };
        },
        { ids },
      );
    },
    modifyLabels: async (
      threadIds: string[],
      options: { addLabels: string[]; removeLabels: string[] },
    ) => {
      return withErrorHandler(
        'modifyLabels',
        async () => {
          await modifyThreadLabels(threadIds, {
            addLabelIds: options.addLabels,
            removeLabelIds: options.removeLabels,
          });
        },
        { threadIds, options },
      );
    },
    getDraft: async (draftId: string) => {
      return withErrorHandler(
        'getDraft',
        async () => {
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
        },
        { draftId },
      );
    },
    listDrafts: async (q?: string, maxResults = 20, pageToken?: string) => {
      return withErrorHandler(
        'listDrafts',
        async () => {
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
                try {
                  const msg = await gmail.users.drafts.get({
                    userId: 'me',
                    id: draft.id,
                    format: 'full',
                  });
                  const message = msg.data.message;
                  if (!message) return null;

                  const parsed = parse(message as any);
                  const headers = message.payload?.headers || [];
                  const date = headers.find((h) => h.name?.toLowerCase() === 'date')?.value;

                  return {
                    ...parsed,
                    id: draft.id,
                    threadId: draft.message?.id,
                    receivedOn: date || new Date().toISOString(),
                  };
                } catch (error) {
                  return null;
                }
              })
              .filter((msg): msg is NonNullable<typeof msg> => msg !== null),
          );

          const sortedDrafts = [...drafts].sort((a, b) => {
            const dateA = new Date(a?.receivedOn || new Date()).getTime();
            const dateB = new Date(b?.receivedOn || new Date()).getTime();
            return dateB - dateA;
          });

          return { ...res.data, drafts: sortedDrafts } as any;
        },
        { q, maxResults, pageToken },
      );
    },
    createDraft: async (data: any) => {
      return withErrorHandler(
        'createDraft',
        async () => {
          const message = data.message.replace(/<br>/g, '</p><p>');
          const msg = createMimeMessage();
          msg.setSender('me');
          msg.setTo(data.to);

          if (data.cc) msg.setCc(data.cc);
          if (data.bcc) msg.setBcc(data.bcc);

          msg.setSubject(data.subject);
          msg.addMessage({
            contentType: 'text/html',
            data: message || '',
          });

          if (data.attachments?.length > 0) {
            for (const attachment of data.attachments) {
              const arrayBuffer = await attachment.arrayBuffer();
              const base64Data = Buffer.from(arrayBuffer).toString('base64');
              msg.addAttachment({
                filename: attachment.name,
                contentType: attachment.type,
                data: base64Data,
              });
            }
          }

          const mimeMessage = msg.asRaw();
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
        { data },
      );
    },
    getUserLabels: async () => {
      const res = await gmail.users.labels.list({
        userId: 'me',
      });
      return res.data.labels;
    },
    getLabel: async (labelId: string) => {
      const res = await gmail.users.labels.get({
        userId: 'me',
        id: labelId,
      });
      return res.data;
    },
    createLabel: async (label) => {
      const res = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: label.name,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
          color: label.color
            ? {
                backgroundColor: label.color.backgroundColor,
                textColor: label.color.textColor,
              }
            : undefined,
        },
      });
      return res.data;
    },
    updateLabel: async (id, label) => {
      const res = await gmail.users.labels.update({
        userId: 'me',
        id: id,
        requestBody: {
          name: label.name,
          color: label.color
            ? {
                backgroundColor: label.color.backgroundColor,
                textColor: label.color.textColor,
              }
            : undefined,
        },
      });
      return res.data;
    },
    deleteLabel: async (id) => {
      await gmail.users.labels.delete({
        userId: 'me',
        id: id,
      });
    },
  };

  return manager;
};
