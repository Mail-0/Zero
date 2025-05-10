import {
  deleteActiveConnection,
  FatalErrors,
  findHtmlBody,
  fromBase64Url,
  fromBinary,
  sanitizeContext,
  StandardizedError,
} from './utils';
import { parseAddressList, parseFrom, wasSentWithTLS } from '../email-utils';
import type { IOutgoingMessage, Label, ParsedMessage } from '../../types';
import { sanitizeTipTapHtml } from '../sanitize-tip-tap-html';
import type { MailManager, ManagerConfig } from './types';
import { type gmail_v1, google } from 'googleapis';
import type { CreateDraftData } from '../schemas';
import { setTimeout } from 'timers/promises';
import type { HonoContext } from '../../ctx';
import { createMimeMessage } from 'mimetext';
import { cleanSearchValue } from '../utils';
import * as he from 'he';

export class GoogleMailManager implements MailManager {
  private auth;
  private gmail;

  constructor(
    public config: ManagerConfig,
    c: HonoContext,
  ) {
    this.auth = new google.auth.OAuth2(c.env.GOOGLE_CLIENT_ID, c.env.GOOGLE_CLIENT_SECRET);

    if (config.auth)
      this.auth.setCredentials({
        refresh_token: config.auth.refreshToken,
        scope: this.getScope(),
      });

    this.gmail = google.gmail({ version: 'v1', auth: this.auth });
  }
  public getScope(): string {
    return [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' ');
  }
  public getAttachment(messageId: string, attachmentId: string) {
    return this.withErrorHandler(
      'getAttachment',
      async () => {
        const response = await this.gmail.users.messages.attachments.get({
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
  }
  public getEmailAliases() {
    return this.withErrorHandler('getEmailAliases', async () => {
      const profile = await this.gmail.users.getProfile({
        userId: 'me',
      });

      const primaryEmail = profile.data.emailAddress || '';
      const aliases: { email: string; name?: string; primary?: boolean }[] = [
        { email: primaryEmail, primary: true },
      ];

      const settings = await this.gmail.users.settings.sendAs.list({
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
  }
  public markAsRead(threadIds: string[]) {
    return this.withErrorHandler(
      'markAsRead',
      async () => {
        await this.modifyThreadLabels(threadIds, { removeLabelIds: ['UNREAD'] });
      },
      { threadIds },
    );
  }
  public markAsUnread(threadIds: string[]) {
    return this.withErrorHandler(
      'markAsUnread',
      async () => {
        await this.modifyThreadLabels(threadIds, { addLabelIds: ['UNREAD'] });
      },
      { threadIds },
    );
  }
  public getUserInfo() {
    return this.withErrorHandler(
      'getUserInfo',
      async () => {
        const res = await google
          .people({ version: 'v1', auth: this.auth })
          .people.get({ resourceName: 'people/me', personFields: 'names,photos,emailAddresses' });
        return {
          address: res.data.emailAddresses?.[0]?.value ?? '',
          name: res.data.names?.[0]?.displayName ?? '',
          photo: res.data.photos?.[0]?.url ?? '',
        };
      },
      {},
    );
  }
  public getTokens<T>(code: string) {
    return this.withErrorHandler(
      'getTokens',
      async () => {
        const { tokens } = await this.auth.getToken(code);
        return { tokens } as T;
      },
      { code },
    );
  }
  public count() {
    return this.withErrorHandler(
      'count',
      async () => {
        const userLabels = await this.gmail.users.labels.list({
          userId: 'me',
        });

        if (!userLabels.data.labels) {
          return [];
        }
        return Promise.all(
          userLabels.data.labels.map(async (label) => {
            const res = await this.gmail.users.labels.get({
              userId: 'me',
              id: label.id ?? undefined,
            });
            return {
              label: res.data.name ?? res.data.id ?? '',
              count: Number(res.data.threadsUnread) ?? undefined,
            };
          }),
        );
      },
      { email: this.config.auth?.email },
    );
  }
  public list(params: {
    folder: string;
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string;
  }) {
    const { folder, query: q, maxResults = 100, labelIds: _labelIds = [], pageToken } = params;
    return this.withErrorHandler(
      'list',
      async () => {
        const { folder: normalizedFolder, q: normalizedQ } = this.normalizeSearch(folder, q ?? '');
        const labelIds = [..._labelIds];
        if (normalizedFolder) labelIds.push(normalizedFolder.toUpperCase());

        const res = await this.gmail.users.threads.list({
          userId: 'me',
          q: normalizedQ ? normalizedQ : undefined,
          labelIds: folder === 'inbox' ? labelIds : [],
          maxResults,
          pageToken: pageToken ? pageToken : undefined,
          quotaUser: this.config.auth?.email,
        });
        return {
          threads: (res.data.threads ?? [])
            .filter((thread) => typeof thread.id === 'string')
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            .map((thread) => ({ id: thread.id!, $raw: thread })),
          nextPageToken: res.data.nextPageToken ?? null,
        };
      },
      { folder, q, maxResults, _labelIds, pageToken, email: this.config.auth?.email },
    );
  }
  public get(id: string) {
    return this.withErrorHandler(
      'get',
      async () => {
        const res = await this.gmail.users.threads.get({
          userId: 'me',
          id,
          format: 'full',
          quotaUser: this.config.auth?.email,
        });

        if (!res.data.messages)
          return {
            messages: [],
            latest: undefined,
            hasUnread: false,
            totalReplies: 0,
            labels: [],
          };
        let hasUnread = false;
        const labels = new Set<string>();
        const messages: ParsedMessage[] = await Promise.all(
          res.data.messages.map(async (message) => {
            const bodyData =
              message.payload?.body?.data ||
              (message.payload?.parts ? findHtmlBody(message.payload.parts) : '') ||
              message.payload?.parts?.[0]?.body?.data ||
              '';

            const decodedBody = bodyData
              ? he
                  .decode(fromBinary(bodyData))
                  .replace(/<[^>]*>/g, '')
                  .trim() === fromBinary(bodyData).trim()
                ? he.decode(fromBinary(bodyData).replace(/\n/g, '<br>'))
                : he.decode(fromBinary(bodyData))
              : '';

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
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    const imageData = await this.getAttachment(message.id!, part.body.attachmentId);
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
                  } catch {}
                }
              }
            }

            const parsedData = this.parse(message);
            if (parsedData.tags) {
              parsedData.tags.forEach((tag) => {
                if (tag.id) {
                  if (labels.has(tag.id)) return;
                  labels.add(tag.id);
                }
              });
            }

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
                    const attachmentData = await this.getAttachment(message.id, attachmentId);
                    return {
                      filename: part.filename || '',
                      mimeType: part.mimeType || '',
                      size: Number(part.body?.size || 0),
                      attachmentId: attachmentId,
                      headers: part.headers || [],
                      body: attachmentData ?? '',
                    };
                  } catch {
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
        return {
          labels: Array.from(labels).map((id) => ({ id, name: id })),
          messages,
          latest: messages[messages.length - 1],
          hasUnread,
          totalReplies: messages.length,
        };
      },
      { id, email: this.config.auth?.email },
    );
  }
  public create(data: IOutgoingMessage) {
    return this.withErrorHandler(
      'create',
      async () => {
        const { raw } = await this.parseOutgoing(data);
        const res = await this.gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw,
            threadId: data.threadId,
          },
        });
        return res.data;
      },
      { data, email: this.config.auth?.email },
    );
  }
  public delete(id: string) {
    return this.withErrorHandler(
      'delete',
      async () => {
        const res = await this.gmail.users.messages.delete({ userId: 'me', id });
        return res.data;
      },
      { id },
    );
  }
  public normalizeIds(ids: string[]) {
    return this.withSyncErrorHandler(
      'normalizeIds',
      () => {
        const threadIds: string[] = ids.map((id) =>
          id.startsWith('thread:') ? id.substring(7) : id,
        );
        return { threadIds };
      },
      { ids },
    );
  }
  public modifyLabels(
    threadIds: string[],
    options: { addLabels: string[]; removeLabels: string[] },
  ) {
    return this.withErrorHandler(
      'modifyLabels',
      async () => {
        await this.modifyThreadLabels(threadIds, {
          addLabelIds: options.addLabels,
          removeLabelIds: options.removeLabels,
        });
      },
      { threadIds, options },
    );
  }
  public sendDraft(draftId: string, data: IOutgoingMessage) {
    return this.withErrorHandler(
      'sendDraft',
      async () => {
        const { raw } = await this.parseOutgoing(data);
        await this.gmail.users.drafts.send({
          userId: 'me',
          requestBody: {
            id: draftId,
            message: {
              raw,
              id: draftId,
            },
          },
        });
      },
      { draftId, data },
    );
  }
  public getDraft(draftId: string) {
    return this.withErrorHandler(
      'getDraft',
      async () => {
        const res = await this.gmail.users.drafts.get({
          userId: 'me',
          id: draftId,
          format: 'full',
        });

        if (!res.data) {
          throw new Error('Draft not found');
        }

        const parsedDraft = this.parseDraft(res.data);
        if (!parsedDraft) {
          throw new Error('Failed to parse draft');
        }

        return parsedDraft;
      },
      { draftId },
    );
  }
  public listDrafts(params: { q?: string; maxResults?: number; pageToken?: string }) {
    const { q, maxResults = 20, pageToken } = params;
    return this.withErrorHandler(
      'listDrafts',
      async () => {
        const { q: normalizedQ } = this.normalizeSearch('', q ?? '');
        const res = await this.gmail.users.drafts.list({
          userId: 'me',
          q: normalizedQ ? normalizedQ : undefined,
          maxResults,
          pageToken: pageToken ? pageToken : undefined,
        });

        const drafts = await Promise.all(
          (res.data.drafts || []).map(async (draft) => {
            if (!draft.id) return null;
            try {
              const msg = await this.gmail.users.drafts.get({
                userId: 'me',
                id: draft.id,
                format: 'full',
              });
              const message = msg.data.message;
              if (!message) return null;

              const parsed = this.parse(message);
              const headers = message.payload?.headers || [];
              const date = headers.find((h) => h.name?.toLowerCase() === 'date')?.value;

              return {
                ...parsed,
                id: draft.id,
                threadId: draft.message?.id,
                receivedOn: date || new Date().toISOString(),
              };
            } catch {
              return null;
            }
          }),
        );

        const sortedDrafts = [...drafts]
          .filter((draft) => draft !== null)
          .sort((a, b) => {
            const dateA = new Date(a?.receivedOn || new Date()).getTime();
            const dateB = new Date(b?.receivedOn || new Date()).getTime();
            return dateB - dateA;
          });

        return {
          threads: sortedDrafts.map((draft) => ({
            id: draft.id,
            $raw: draft,
          })),
          nextPageToken: res.data.nextPageToken ?? null,
        };
      },
      { q, maxResults, pageToken },
    );
  }
  public createDraft(data: CreateDraftData) {
    return this.withErrorHandler(
      'createDraft',
      async () => {
        const message = await sanitizeTipTapHtml(data.message);
        const msg = createMimeMessage();
        msg.setSender('me');
        msg.setTo(data.to.split(', ').map((recipient: string) => ({ addr: recipient })));
        if (data.cc)
          msg.setCc(data.cc?.split(', ').map((recipient: string) => ({ addr: recipient })));
        if (data.bcc)
          msg.setBcc(data.bcc?.split(', ').map((recipient: string) => ({ addr: recipient })));

        msg.setSubject(data.subject);
        msg.addMessage({
          contentType: 'text/html',
          data: message || '',
        });

        if (data.attachments && data.attachments?.length > 0) {
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
          res = await this.gmail.users.drafts.update({
            userId: 'me',
            id: data.id,
            requestBody,
          });
        } else {
          res = await this.gmail.users.drafts.create({
            userId: 'me',
            requestBody,
          });
        }

        return res.data;
      },
      { data },
    );
  }
  public async getUserLabels() {
    const res = await this.gmail.users.labels.list({
      userId: 'me',
    });
    // wtf google, null values for EVERYTHING?
    return (
      res.data.labels?.map((label) => ({
        id: label.id ?? '',
        name: label.name ?? '',
        type: label.type ?? '',
        color: {
          backgroundColor: label.color?.backgroundColor ?? '',
          textColor: label.color?.textColor ?? '',
        },
      })) ?? []
    );
  }
  public async getLabel(labelId: string): Promise<Label> {
    const res = await this.gmail.users.labels.get({
      userId: 'me',
      id: labelId,
    });
    return {
      id: labelId,
      name: res.data.name ?? '',
      color: {
        backgroundColor: res.data.color?.backgroundColor ?? '',
        textColor: res.data.color?.textColor ?? '',
      },
      type: res.data.type ?? 'user',
    };
  }
  public async createLabel(label: {
    name: string;
    color?: { backgroundColor: string; textColor: string };
  }) {
    await this.gmail.users.labels.create({
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
  }
  public async updateLabel(id: string, label: Label) {
    await this.gmail.users.labels.update({
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
  }
  public async deleteLabel(id: string) {
    await this.gmail.users.labels.delete({
      userId: 'me',
      id: id,
    });
  }
  public async revokeRefreshToken(refreshToken: string) {
    if (!refreshToken) {
      return false;
    }
    try {
      await this.auth.revokeToken(refreshToken);
      return true;
    } catch (error: unknown) {
      console.error('Failed to revoke Google token:', (error as Error).message);
      return false;
    }
  }
  private async modifyThreadLabels(
    threadIds: string[],
    requestBody: gmail_v1.Schema$ModifyThreadRequest,
  ) {
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
          const response = await this.gmail.users.threads.modify({
            userId: 'me',
            id: threadId,
            requestBody: requestBody,
          });
          return { threadId, status: 'fulfilled' as const, value: response.data };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          const errorMessage = error?.errors?.[0]?.message || error.message || error;
          return { threadId, status: 'rejected' as const, reason: { error: errorMessage } };
        }
      });

      const chunkResults = await Promise.all(promises);
      allResults.push(...chunkResults);

      if (i + chunkSize < threadIds.length) {
        await setTimeout(delayBetweenChunks);
      }
    }

    const failures = allResults.filter((result) => result.status === 'rejected');
    if (failures.length > 0) {
      const failureReasons = failures.map((f) => ({ threadId: f.threadId, reason: f.reason }));
      failureReasons;
    }
  }
  private normalizeSearch(folder: string, q: string) {
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
  }
  private parse({
    id,
    threadId,
    snippet,
    labelIds,
    payload,
  }: gmail_v1.Schema$Message): Omit<
    ParsedMessage,
    'body' | 'processedHtml' | 'blobUrl' | 'totalReplies'
  > {
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
      tags: labelIds?.map((l) => ({ id: l, name: l, type: 'user' })) || [],
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
  }
  private async parseOutgoing({
    to,
    subject,
    message,
    attachments,
    headers,
    cc,
    bcc,
    fromEmail,
  }: IOutgoingMessage) {
    const msg = createMimeMessage();

    const defaultFromEmail = this.config.auth?.email || 'nobody@example.com';
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
      data: await sanitizeTipTapHtml(message.trim()),
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
  }
  private parseDraft(draft: gmail_v1.Schema$Draft) {
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
        const textPart = payload.parts.find((part) => part.mimeType === 'text/html');
        if (textPart?.body?.data) {
          content = fromBinary(textPart.body.data);
        }
      } else if (payload.body?.data) {
        content = fromBinary(payload.body.data);
      }
    }

    // TODO: Hook up CC and BCC from the draft so it can populate the composer on open.

    return {
      id: draft.id || '',
      to,
      subject: subject ? he.decode(subject).trim() : '',
      content,
      rawMessage: draft.message,
    };
  }
  private async withErrorHandler<T>(
    operation: string,
    fn: () => Promise<T> | T,
    context?: Record<string, unknown>,
  ): Promise<T> {
    try {
      return await Promise.resolve(fn());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const isFatal = FatalErrors.includes(error.message);
      console.error(
        `[${isFatal ? 'FATAL_ERROR' : 'ERROR'}] [Gmail Driver] Operation: ${operation}`,
        {
          error: error.message,
          code: error.code,
          context: sanitizeContext(context),
          stack: error.stack,
          isFatal,
        },
      );
      if (isFatal && this.config.c) await deleteActiveConnection(this.config.c);
      throw new StandardizedError(error, operation, context);
    }
  }
  private withSyncErrorHandler<T>(
    operation: string,
    fn: () => T,
    context?: Record<string, unknown>,
  ): T {
    try {
      return fn();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const isFatal = FatalErrors.includes(error.message);
      console.error(`[Gmail Driver Error] Operation: ${operation}`, {
        error: error.message,
        code: error.code,
        context: sanitizeContext(context),
        stack: error.stack,
        isFatal,
      });
      if (isFatal && this.config.c) void deleteActiveConnection(this.config.c);
      throw new StandardizedError(error, operation, context);
    }
  }
}
