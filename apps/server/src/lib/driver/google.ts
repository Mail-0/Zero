import {
  deleteActiveConnection,
  FatalErrors,
  findHtmlBody,
  fromBase64Url,
  fromBinary,
  getSimpleLoginSender,
  sanitizeContext,
  StandardizedError,
} from './utils';
import { buildOutgoingMime, toMessageIdList, ZERO_SUGGESTION_HEADER } from './outgoing-mime';
import { mapGoogleLabelColor, mapToGoogleLabelColor } from './google-label-color-map';
import { parseAddressList, parseFrom, wasSentWithTLS } from '../email-utils';
import type { IOutgoingMessage, Label, ParsedMessage } from '../../types';
import { GmailQuotaDeferredError } from '../gmail-quota-error';
import { sanitizeTipTapHtml } from '../sanitize-tip-tap-html';
import { loadGmailInlineAsset } from '../gmail-inline-asset';
import type { MailManager, ManagerConfig } from './types';
import { type gmail_v1, gmail } from '@googleapis/gmail';
import { MailAssetCache } from '../mail-asset-cache';
import { GmailQuotaAuth } from '../gmail-quota-auth';
import type { CreateDraftData } from '../schemas';
import { createMimeMessage } from 'mimetext';
import { people } from '@googleapis/people';
import { cleanSearchValue } from '../utils';
import { env } from '../../env';
import { Effect } from 'effect';
import * as he from 'he';

const ZERO_SUGGESTION_HEADER_LC = ZERO_SUGGESTION_HEADER.toLowerCase();

export class GoogleMailManager implements MailManager {
  private auth;
  private gmail;
  private assets: MailAssetCache;

  private labelIdCache: Record<string, string> = {};

  private readonly systemLabelIds = new Set<string>([
    'INBOX',
    'TRASH',
    'SPAM',
    'DRAFT',
    'SENT',
    'STARRED',
    'UNREAD',
    'IMPORTANT',
    'CATEGORY_PERSONAL',
    'CATEGORY_SOCIAL',
    'CATEGORY_UPDATES',
    'CATEGORY_FORUMS',
    'CATEGORY_PROMOTIONS',
    'MUTED',
  ]);

  constructor(public config: ManagerConfig) {
    this.assets = new MailAssetCache(
      env.THREADS_BUCKET,
      JSON.stringify([config.auth.userId, config.auth.email.trim().toLowerCase()]),
    );
    this.auth = new GmailQuotaAuth(
      config.auth.email,
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
    );

    if (config.auth)
      this.auth.setCredentials({
        refresh_token: config.auth.refreshToken,
        scope: this.getScope(),
      });

    this.gmail = gmail({ version: 'v1', auth: this.auth });
  }
  public getScope(): string {
    return [
      'https://mail.google.com/',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' ');
  }
  public async listHistory<T>(historyId: string): Promise<{ history: T[]; historyId: string }> {
    return this.withErrorHandler(
      'listHistory',
      async () => {
        const history: gmail_v1.Schema$History[] = [];
        let pageToken: string | undefined;
        let nextHistoryId = historyId;
        do {
          const response = await this.gmail.users.history.list(
            {
              userId: 'me',
              startHistoryId: historyId,
              pageToken,
            },
            { retry: false, timeout: 30000 },
          );
          history.push(...(response.data.history || []));
          nextHistoryId = response.data.historyId || nextHistoryId;
          pageToken = response.data.nextPageToken || undefined;
        } while (pageToken);

        return { history: history as T[], historyId: nextHistoryId };
      },
      { historyId },
    );
  }
  public async getAttachment(messageId: string, attachmentId: string) {
    return this.assets.read(['attachment', messageId, attachmentId], () =>
      this.downloadAttachment(messageId, attachmentId),
    );
  }

  private async downloadAttachment(messageId: string, attachmentId: string) {
    return this.withErrorHandler(
      'getAttachment',
      async () => {
        const response = await this.gmail.users.messages.attachments.get(
          { userId: 'me', messageId, id: attachmentId },
          { retry: false, timeout: 30000 },
        );

        const attachmentData = response.data.data || '';

        const base64 = fromBase64Url(attachmentData);

        return base64;
      },
      { messageId, attachmentId },
    );
  }

  public async batchModifyMessageLabels(
    messageIds: string[],
    addLabelIds: string[],
    removeLabelIds: string[],
  ) {
    if (!messageIds.length) return;
    if (messageIds.length > 1000)
      throw new Error('Gmail batchModify supports at most 1000 messages');
    await this.gmail.users.messages.batchModify(
      {
        userId: 'me',
        requestBody: { ids: messageIds, addLabelIds, removeLabelIds },
      },
      { retry: false, timeout: 30000 },
    );
  }

  public async getMailboxHistoryId() {
    const response = await this.gmail.users.getProfile(
      { userId: 'me' },
      { retry: false, timeout: 30000 },
    );
    if (!response.data.historyId) throw new Error('Gmail profile is missing historyId');
    return response.data.historyId;
  }

  public async listMailboxThreadIds(pageToken?: string) {
    const response = await this.gmail.users.threads.list(
      {
        userId: 'me',
        maxResults: 500,
        includeSpamTrash: true,
        pageToken,
      },
      { retry: false, timeout: 30000 },
    );
    return {
      ids: (response.data.threads ?? []).flatMap((thread) => (thread.id ? [thread.id] : [])),
      nextPageToken: response.data.nextPageToken ?? null,
    };
  }

  public async watchMailbox(topicName: string) {
    const response = await this.gmail.users.watch(
      { userId: 'me', requestBody: { topicName } },
      { retry: false, timeout: 30000 },
    );
    if (!response.data.expiration) throw new Error('Gmail watch response is missing expiration');
    return { expiration: Number(response.data.expiration) };
  }

  public async getMessageAttachments(messageId: string) {
    return this.withErrorHandler(
      'getMessageAttachments',
      async () => {
        const cachedParts = await this.assets.read(['attachment-parts', messageId], async () => {
          const res = await this.gmail.users.messages.get(
            { userId: 'me', id: messageId },
            { retry: false, timeout: 30000 },
          );
          const parts = res.data.payload?.parts ? this.findAttachments(res.data.payload.parts) : [];
          return JSON.stringify(
            parts.map((part) => ({
              filename: part.filename,
              mimeType: part.mimeType,
              headers: part.headers,
              body: { attachmentId: part.body?.attachmentId, size: part.body?.size },
            })),
          );
        });
        const attachmentParts = JSON.parse(cachedParts ?? '[]') as gmail_v1.Schema$MessagePart[];

        const attachments = await Promise.all(
          attachmentParts.map(async (part) => {
            const attachmentId = part.body?.attachmentId;
            if (!attachmentId) {
              return null;
            }

            try {
              const attachmentData = await this.getAttachment(messageId, attachmentId);
              return {
                filename: part.filename || '',
                mimeType: part.mimeType || '',
                size: Number(part.body?.size || 0),
                attachmentId: attachmentId,
                headers:
                  part.headers?.map((h) => ({
                    name: h.name ?? '',
                    value: h.value ?? '',
                  })) ?? [],
                body: attachmentData ?? '',
              };
            } catch {
              return null;
            }
          }),
        ).then((attachments) => attachments.filter((a): a is NonNullable<typeof a> => a !== null));

        return attachments;
      },
      { messageId },
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
        const finalIds = (
          await Promise.all(
            threadIds.map(async (id) => {
              const threadMetadata = await this.getThreadMetadata(id);
              return threadMetadata.messages
                .filter((msg) => msg.labelIds && msg.labelIds.includes('UNREAD'))
                .map((msg) => msg.id);
            }),
          ).then((idArrays) => [...new Set(idArrays.flat())])
        ).filter((id): id is string => id !== undefined);

        await this.modifyThreadLabels(finalIds, { removeLabelIds: ['UNREAD'] });
      },
      { threadIds },
    );
  }
  public markAsUnread(threadIds: string[]) {
    return this.withErrorHandler(
      'markAsUnread',
      async () => {
        const finalIds = (
          await Promise.all(
            threadIds.map(async (id) => {
              const threadMetadata = await this.getThreadMetadata(id);
              return threadMetadata.messages
                .filter((msg) => msg.labelIds && !msg.labelIds.includes('UNREAD'))
                .map((msg) => msg.id);
            }),
          ).then((idArrays) => [...new Set(idArrays.flat())])
        ).filter((id): id is string => id !== undefined);
        await this.modifyThreadLabels(finalIds, { addLabelIds: ['UNREAD'] });
      },
      { threadIds },
    );
  }
  public getUserInfo() {
    return this.withErrorHandler(
      'getUserInfo',
      async () => {
        const res = await people({ version: 'v1', auth: this.auth }).people.get({
          resourceName: 'people/me',
          personFields: 'names,photos,emailAddresses',
        });
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
        type LabelCount = { label: string; count: number; labelId?: string };

        const getUserLabelsEffect = Effect.tryPromise({
          try: () => this.gmail.users.labels.list({ userId: 'me' }),
          catch: (error) => ({ _tag: 'LabelListFailed' as const, error }),
        });

        const getArchiveCountEffect = Effect.tryPromise({
          try: () =>
            this.gmail.users.threads.list({
              userId: 'me',
              q: 'in:archive',
              maxResults: 1,
            }),
          catch: (error) => ({ _tag: 'ArchiveFetchFailed' as const, error }),
        });

        const processLabelEffect = (label: gmail_v1.Schema$Label) =>
          Effect.tryPromise({
            try: () =>
              this.gmail.users.labels.get({
                userId: 'me',
                id: label.id ?? undefined,
              }),
            catch: (error) => ({ _tag: 'LabelFetchFailed' as const, error, labelId: label.id }),
          }).pipe(
            Effect.map((res): LabelCount | null => {
              if ('_tag' in res) return null;

              let labelName = (res.data.name ?? res.data.id ?? '').toLowerCase();
              if (labelName === 'draft') {
                labelName = 'drafts';
              }
              const isTotalLabel = labelName === 'drafts' || labelName === 'sent';
              return {
                labelId: res.data.id ?? label.id ?? undefined,
                label: labelName,
                count: Number(isTotalLabel ? res.data.threadsTotal : res.data.threadsUnread),
              };
            }),
          );

        const mainEffect = Effect.gen(function* () {
          // Fetch user labels and archive count concurrently
          const [userLabelsResult, archiveResult] = yield* Effect.all(
            [getUserLabelsEffect, getArchiveCountEffect],
            { concurrency: 'unbounded' },
          );

          // Handle label list failure
          if ('_tag' in userLabelsResult && userLabelsResult._tag === 'LabelListFailed') {
            return [];
          }

          const labels = userLabelsResult.data.labels || [];
          if (labels.length === 0) {
            return [];
          }

          // Bound this fan-out; Gmail also enforces per-user concurrent-request limits.
          const labelEffects = labels.map(processLabelEffect);
          const labelResults = yield* Effect.all(labelEffects, { concurrency: 4 });

          // Filter and collect results
          const mapped: LabelCount[] = labelResults.filter(
            (item): item is LabelCount => item !== null,
          );

          // Add archive count if successful
          if (!('_tag' in archiveResult)) {
            mapped.push({
              label: 'archive',
              count: Number(archiveResult.data.resultSizeEstimate ?? 0),
            });
          }

          return mapped;
        });

        return await Effect.runPromise(mainEffect);
      },
      { email: this.config.auth?.email },
    );
  }

  private getQuotaUser() {
    return this.config.auth?.email ? `${this.config.auth.email}-${env.NODE_ENV}` : undefined;
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
          quotaUser: this.getQuotaUser(),
        });

        const threads = res.data.threads ?? [];

        return {
          threads: threads
            .filter((thread) => typeof thread.id === 'string')
            .map((thread) => ({
              id: thread.id!,
              historyId: thread.historyId ?? null,
              $raw: thread,
            })),
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
        const res = await this.gmail.users.threads.get(
          {
            userId: 'me',
            id,
            format: 'full',
            quotaUser: this.getQuotaUser(),
          },
          { retry: false, timeout: 30000 },
        );

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
                  const imageData = await loadGmailInlineAsset(() =>
                    this.getAttachment(message.id!, part.body!.attachmentId!),
                  );
                  if (imageData) {
                    const cleanContentId = contentId.replace(/[<>]/g, '');

                    const escapedContentId = cleanContentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    processedBody = processedBody.replace(
                      new RegExp(`cid:${escapedContentId}`, 'g'),
                      `data:${part.mimeType};base64,${imageData}`,
                    );
                  }
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

            // Only store attachment metadata, not the actual attachment data
            const attachmentParts = message.payload?.parts
              ? this.findAttachments(message.payload.parts)
              : [];

            const attachments = attachmentParts.map((part) => ({
              filename: part.filename || '',
              mimeType: part.mimeType || '',
              size: Number(part.body?.size || 0),
              attachmentId: part.body?.attachmentId || '',
              headers:
                part.headers?.map((h) => ({
                  name: h.name ?? '',
                  value: h.value ?? '',
                })) ?? [],
              body: '', // Empty body - fetch on demand with getMessageAttachments
            }));

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
          providerHistoryId: res.data.historyId ?? undefined,
          labels: Array.from(labels).map((id) => ({ id, name: id })),
          messages,
          latest: messages.findLast((e) => e.isDraft !== true),
          hasUnread,
          totalReplies: messages.filter((e) => !e.isDraft).length,
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
    addOrOptions: { addLabels: string[]; removeLabels: string[] } | string[],
    maybeRemove?: string[],
  ) {
    const options = Array.isArray(addOrOptions)
      ? { addLabels: addOrOptions as string[], removeLabels: maybeRemove ?? [] }
      : addOrOptions;
    return this.withErrorHandler(
      'modifyLabels',
      async () => {
        const addLabelIds = await Promise.all(
          (options.addLabels || []).map((lbl) => this.resolveLabelId(lbl)),
        );
        const removeLabelIds = await Promise.all(
          (options.removeLabels || []).map((lbl) => this.resolveLabelId(lbl)),
        );

        await this.modifyThreadLabels(threadIds, {
          addLabelIds,
          removeLabelIds,
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
              // Without this Gmail can file a reply sent from a draft as a new conversation.
              threadId: data.threadId,
            },
          },
        });
      },
      { draftId, data },
    );
  }
  public listThreadDrafts(threadId: string) {
    return this.withErrorHandler(
      'listThreadDrafts',
      async () => {
        // drafts.list can't filter by thread, but each entry carries message.threadId. Most
        // mailboxes have far fewer than one page of drafts; cap the scan just in case.
        const found: { draftId: string; messageId: string }[] = [];
        let pageToken: string | undefined;
        for (let page = 0; page < 5; page++) {
          const res = await this.gmail.users.drafts.list(
            { userId: 'me', maxResults: 500, pageToken },
            { retry: false, timeout: 30000 },
          );
          for (const draft of res.data.drafts ?? []) {
            if (draft.id && draft.message?.id && draft.message.threadId === threadId) {
              found.push({ draftId: draft.id, messageId: draft.message.id });
            }
          }
          pageToken = res.data.nextPageToken ?? undefined;
          if (!pageToken) break;
        }
        return found;
      },
      { threadId },
    );
  }
  public deleteDraft(draftId: string) {
    return this.withErrorHandler(
      'deleteDraft',
      async () => {
        await this.gmail.users.drafts.delete({ userId: 'me', id: draftId });
      },
      { draftId },
    );
  }
  public getDraft(draftId: string) {
    return this.withErrorHandler(
      'getDraft',
      async () => {
        const res = await this.gmail.users.drafts.get(
          { userId: 'me', id: draftId, format: 'full' },
          { retry: false, timeout: 30000 },
        );

        if (!res.data) {
          throw new Error('Draft not found');
        }

        const parsedDraft = await this.parseDraft(res.data);
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
        const { q: normalizedQ } = this.normalizeSearch('draft', q ?? '');
        const res = await this.gmail.users.drafts.list(
          {
            userId: 'me',
            q: normalizedQ ? normalizedQ : undefined,
            maxResults,
            pageToken: pageToken ? pageToken : undefined,
          },
          { retry: false, timeout: 30000 },
        );

        const drafts = await Effect.runPromise(
          Effect.forEach(
            res.data.drafts || [],
            (draft) =>
              Effect.tryPromise({
                try: async () => {
                  if (!draft.id) return null;
                  try {
                    const msg = await this.gmail.users.drafts.get(
                      { userId: 'me', id: draft.id, format: 'full' },
                      { retry: false, timeout: 30000 },
                    );
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
                  } catch (error) {
                    const status =
                      (error as { code?: number; response?: { status?: number } })?.response
                        ?.status ?? (error as { code?: number })?.code;
                    if (status === 404) return null;
                    // A transient/quota failure must not become a cached partial list.
                    throw error;
                  }
                },
                catch: (error) => error,
              }),
            { concurrency: 4 },
          ),
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
            historyId: draft.threadId ?? null,
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
        const { html: message, inlineImages } = await sanitizeTipTapHtml(data.message);
        const msg = createMimeMessage();
        msg.setSender('me');
        // name <email@example.com>
        const to = data.to.split(', ').map((recipient: string) => {
          if (recipient.includes('<')) {
            const [name, email] = recipient.split('<');
            return { addr: email.replace('>', ''), name: name.replace('>', '') };
          }
          return { addr: recipient };
        });

        msg.setTo(to);
        if (data.cc)
          msg.setCc(data.cc?.split(', ').map((recipient: string) => ({ addr: recipient })));
        if (data.bcc)
          msg.setBcc(data.bcc?.split(', ').map((recipient: string) => ({ addr: recipient })));

        msg.setSubject(data.subject);
        if (data.inReplyTo) msg.setHeader('In-Reply-To', toMessageIdList(data.inReplyTo));
        if (data.references) msg.setHeader('References', toMessageIdList(data.references));
        // Marks Zero's automatic drafts. Any later save from the app rewrites the MIME without
        // it, so the "Suggested by Zero" label disappears once the user edits the draft.
        if (data.isZeroSuggestion) msg.setHeader(ZERO_SUGGESTION_HEADER, 'true');
        msg.addMessage({
          contentType: 'text/html',
          data: message || '',
        });

        if (inlineImages.length > 0) {
          for (const image of inlineImages) {
            msg.addAttachment({
              inline: true,
              filename: `${image.cid}`,
              contentType: image.mimeType,
              data: image.data,
              headers: {
                'Content-ID': `<${image.cid}>`,
                'Content-Disposition': 'inline',
              },
            });
          }
        }

        if (data.attachments && data.attachments?.length > 0) {
          for (const attachment of data.attachments) {
            const base64Data = attachment.base64;
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
            threadId: data.threadId,
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
        color: mapGoogleLabelColor({
          backgroundColor: label.color?.backgroundColor ?? '',
          textColor: label.color?.textColor ?? '',
        }),
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
      color: mapGoogleLabelColor({
        backgroundColor: res.data.color?.backgroundColor ?? '',
        textColor: res.data.color?.textColor ?? '',
      }),
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
          ? mapToGoogleLabelColor({
              backgroundColor: label.color.backgroundColor,
              textColor: label.color.textColor,
            })
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
          ? mapToGoogleLabelColor({
              backgroundColor: label.color.backgroundColor,
              textColor: label.color.textColor,
            })
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
  public async revokeToken(token: string) {
    if (!token) return false;
    try {
      await this.auth.revokeToken(token);
      return true;
    } catch (error: unknown) {
      console.error('Failed to revoke Google token:', (error as Error).message);
      return false;
    }
  }

  public deleteAllSpam() {
    return this.withErrorHandler(
      'deleteAllSpam',
      async () => {
        let totalDeleted = 0;
        let hasMoreSpam = true;
        let pageToken: string | number | null | undefined = undefined;

        while (hasMoreSpam) {
          const spamThreads = await this.list({
            folder: 'spam',
            maxResults: 500,
            pageToken: pageToken as string | undefined,
          });

          if (!spamThreads.threads || spamThreads.threads.length === 0) {
            hasMoreSpam = false;
            break;
          }

          const threadIds = spamThreads.threads.map((thread) => thread.id);
          await this.modifyLabels(threadIds, {
            addLabels: ['TRASH'],
            removeLabels: ['SPAM', 'INBOX'],
          });

          totalDeleted += threadIds.length;
          pageToken = spamThreads.nextPageToken;

          if (!pageToken) {
            hasMoreSpam = false;
          }
        }

        return {
          success: true,
          message: `Deleted ${totalDeleted} spam emails`,
          count: totalDeleted,
        };
      },
      { email: this.config.auth?.email },
    );
  }

  private async getThreadMetadata(threadId: string) {
    return this.withErrorHandler(
      'getThreadMetadata',
      async () => {
        const res = await this.gmail.users.threads.get({
          userId: 'me',
          id: threadId,
          format: 'metadata', // Fetch only metadata,
          quotaUser: this.getQuotaUser(),
        });
        // Process res.data.messages to extract id and labelIds
        return {
          messages:
            res.data.messages?.map((msg) => ({
              id: msg.id,
              labelIds: msg.labelIds,
            })) || [],
        };
      },
      { threadId, email: this.config.auth?.email },
    );
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
    const allResults: Array<{
      threadId: string;
      status: 'fulfilled' | 'rejected';
      value?: unknown;
      reason?: unknown;
    }> = [];

    for (let i = 0; i < threadIds.length; i += chunkSize) {
      const chunk = threadIds.slice(i, i + chunkSize);

      const effects = chunk.map((threadId) =>
        Effect.tryPromise({
          try: async () => {
            const response = await this.gmail.users.threads.modify({
              userId: 'me',
              id: threadId,
              requestBody,
            });
            return { threadId, status: 'fulfilled' as const, value: response.data };
          },
          catch: (error) => {
            const details = error as { errors?: { message?: string }[]; message?: string } | null;
            const errorMessage = details?.errors?.[0]?.message || details?.message || error;
            return { threadId, status: 'rejected' as const, reason: { error: errorMessage } };
          },
        }),
      );

      const chunkResults = await Effect.runPromise(
        Effect.all(effects, { concurrency: 'unbounded' }),
      );
      allResults.push(...chunkResults);

      if (i + chunkSize < threadIds.length) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenChunks));
      }
    }

    const failures = allResults.filter((result) => result.status === 'rejected');
    if (failures.length > 0) {
      const failureReasons = failures.map((f) => ({ threadId: f.threadId, reason: f.reason }));
      const first = failureReasons[0];
      throw new Error(
        `Failed to modify labels for thread ${first.threadId}: ${JSON.stringify(first.reason)}`,
      );
    }
  }
  private normalizeSearch(folder: string, q: string) {
    if (folder !== 'inbox') {
      q = cleanSearchValue(q);

      if (folder === 'bin') {
        return { folder: undefined, q: `in:trash ${q}` };
      }
      if (folder === 'archive') {
        return { folder: undefined, q: `in:archive AND (${q})` };
      }
      if (folder === 'draft') {
        return { folder: undefined, q: `is:draft AND (${q})` };
      }

      if (folder === 'snoozed') {
        return { folder: undefined, q: `label:Snoozed AND (${q})` };
      }

      return { folder, q: folder.trim().length ? `in:${folder} ${q}` : q };
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

    // If there's a SimpleLogin Header, use it as the sender
    const simpleLoginSender = getSimpleLoginSender(payload);

    const sender =
      simpleLoginSender ||
      payload?.headers?.find((h) => h.name?.toLowerCase() === 'from')?.value ||
      'Failed';
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
      isDraft: labelIds ? labelIds.includes('DRAFT') : false,
      isZeroSuggestion:
        !!labelIds?.includes('DRAFT') &&
        !!payload?.headers?.some((h) => h.name?.toLowerCase() === ZERO_SUGGESTION_HEADER_LC),
    };
  }
  private async parseOutgoing(data: IOutgoingMessage) {
    const { raw } = await buildOutgoingMime(data, {
      defaultFrom: this.config.auth?.email || 'nobody@example.com',
      literalSender: true,
    });
    return { raw: Buffer.from(raw).toString('base64') };
  }

  private async parseDraft(draft: gmail_v1.Schema$Draft) {
    if (!draft.message) return null;

    const headers = draft.message.payload?.headers || [];
    const to =
      headers
        .find((h) => h.name === 'To')
        ?.value?.split(',')
        .map((e) => e.trim())
        .filter(Boolean) || [];

    const subject = headers.find((h) => h.name === 'Subject')?.value;

    const cc =
      draft.message.payload?.headers?.find((h) => h.name === 'Cc')?.value?.split(',') || [];
    const bcc =
      draft.message.payload?.headers?.find((h) => h.name === 'Bcc')?.value?.split(',') || [];

    const payload = draft.message.payload;
    let content = '';
    let attachments: {
      filename: string;
      mimeType: string;
      size: number;
      attachmentId: string;
      headers: { name: string; value: string }[];
      body: string;
    }[] = [];

    if (payload?.parts) {
      //  Get body
      const htmlPart = payload.parts.find((part) => part.mimeType === 'text/html');
      if (htmlPart?.body?.data) {
        content = fromBinary(htmlPart.body.data);
      }

      //  Get attachments
      const attachmentParts = payload.parts.filter(
        (part) => !!part.filename && !!part.body?.attachmentId,
      );

      attachments = await Promise.all(
        attachmentParts.map(async (part) => {
          try {
            const attachmentData = await this.getAttachment(
              draft.message!.id!,
              part.body!.attachmentId!,
            );
            return {
              filename: part.filename || '',
              mimeType: part.mimeType || '',
              size: Number(part.body?.size || 0),
              attachmentId: part.body!.attachmentId!,
              headers:
                part.headers?.map((h) => ({
                  name: h.name ?? '',
                  value: h.value ?? '',
                })) ?? [],
              body: attachmentData ?? '',
            };
          } catch (e) {
            console.error('Failed to get attachment', e);
            return null;
          }
        }),
      ).then((a) => a.filter((a): a is NonNullable<typeof a> => a !== null));
    } else if (payload?.body?.data) {
      content = fromBinary(payload.body.data);
    }

    return {
      id: draft.id || '',
      to,
      subject: subject ? he.decode(subject).trim() : '',
      content,
      // Only internalDate is read by clients. The full Gmail message re-sends every part's
      // base64 body (duplicating `content`), which bloated every draft open and cache row.
      rawMessage: { internalDate: draft.message.internalDate ?? null },
      cc,
      bcc,
      attachments,
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
      // Admission deferrals are expected durable scheduling decisions, not
      // provider failures. Preserve them without error-level request logging.
      if (error instanceof GmailQuotaDeferredError) throw error;
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
      if (isFatal) {
        try {
          await deleteActiveConnection();
        } catch {
          console.warn('[Gmail Driver] Reauthorization required outside request context');
        }
      }
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
      if (isFatal) void deleteActiveConnection();
      throw new StandardizedError(error, operation, context);
    }
  }

  private findAttachments(parts: gmail_v1.Schema$MessagePart[]): gmail_v1.Schema$MessagePart[] {
    let results: gmail_v1.Schema$MessagePart[] = [];

    for (const part of parts) {
      if (part.filename && part.filename.length > 0) {
        const contentDisposition =
          part.headers?.find((h) => h.name?.toLowerCase() === 'content-disposition')?.value || '';
        const isInline = contentDisposition.toLowerCase().includes('inline');
        const hasContentId = part.headers?.some((h) => h.name?.toLowerCase() === 'content-id');

        if (!isInline || (isInline && !hasContentId)) {
          results.push(part);
        }
      }

      if (part.parts && Array.isArray(part.parts)) {
        results = results.concat(this.findAttachments(part.parts));
      }

      if (part.body?.attachmentId && part.mimeType === 'message/rfc822') {
        if (part.filename && part.filename.length > 0) {
          results.push(part);
        }
      }
    }

    return results;
  }

  private async resolveLabelId(labelName: string): Promise<string> {
    if (this.systemLabelIds.has(labelName)) {
      return labelName;
    }

    if (this.labelIdCache[labelName]) {
      return this.labelIdCache[labelName];
    }

    const userLabels = await this.getUserLabels();
    const existing = userLabels.find((l) => l.name?.toLowerCase() === labelName.toLowerCase());
    if (existing && existing.id) {
      this.labelIdCache[labelName] = existing.id;
      return existing.id;
    }
    const prettifiedName = labelName.charAt(0).toUpperCase() + labelName.slice(1).toLowerCase();
    await this.createLabel({ name: prettifiedName });

    const refreshedLabels = await this.getUserLabels();
    const created = refreshedLabels.find(
      (l) => l.name?.toLowerCase() === prettifiedName.toLowerCase(),
    );
    if (!created || !created.id) {
      throw new Error(`Failed to create or retrieve Gmail label '${labelName}'.`);
    }

    this.labelIdCache[labelName] = created.id;
    return created.id;
  }
}
