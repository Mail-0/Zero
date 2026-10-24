/**
 * MailManager for generic IMAP/SMTP accounts.
 *
 * - Reading: the ZeroDriver DO calls `syncMailbox()` on an alarm. That keeps an IMAP index
 *   (ImapIndexStore, DO SQLite) up to date and queues changed threads, which the DO
 *   re-imports through `get(threadId)`. Raw messages are cached in R2.
 * - Labels map to folders (see ./imap/folders.ts): adding/removing INBOX, SPAM, TRASH,
 *   ARCHIVE or a user folder label moves messages. UNREAD/STARRED/IMPORTANT map to flags.
 *   Tag labels (`K_…`, see ./imap/keywords.ts) are IMAP keywords: they tag messages
 *   without moving them. AI labels and learned topics are always tags.
 * - Sending goes through SMTP; the message is then APPENDed to Sent unless the server
 *   does that itself.
 */
import {
  ImapAuthError,
  ImapClient,
  ImapCommandError,
  findSection,
  type CommandArg,
  type ImapAuth,
} from '../imap/client';
import {
  canStoreKeyword,
  isKeywordLabel,
  keywordForName,
  keywordFromLabelId,
  keywordLabelId,
} from '../imap/keywords';
import {
  attachmentPayload,
  listedAttachments,
  parseRawMessage,
  toParsedMessage,
} from '../imap/message';
import {
  SYSTEM_FOLDER_LABELS,
  folderPathFromLabelId,
  type SystemFolderLabel,
} from '../imap/folders';
import { ImapIndexStore, headersFromBlock, stableId, type StoredMessage } from '../imap/imap-store';
import { OAuthRefreshError, refreshAccessToken, type OAuthClientCredentials } from '../imap/oauth';
import type { IGetThreadResponse, MailManager, ManagerConfig, ParsedDraft } from './types';
import { SmtpAuthError, SmtpClient, stripBccHeader, type SmtpAuth } from '../smtp/client';
import { MailConnectionError, type SocketFactory } from '../mail-transport/socket';
import type { DeleteAllSpamResponse, IOutgoingMessage, Label } from '../../types';
import { HEADER_FIELDS, ImapSyncEngine, defaultSyncOptions } from '../imap/sync';
import { addressOf, buildDraftMime, buildOutgoingMime } from './outgoing-mime';
import { CATEGORY_LABELS, type MailCategory } from '../imap/categorize';
import { compileLocalLabelQuery } from '../mail-search-overlay';
import { sanitizeContext, StandardizedError } from './errors';
import { CredentialCipher } from '../crypto/credentials';
import type { CreateDraftData } from '../schemas';
import { translateSearch } from '../imap/search';
import { toSequenceSet } from '../imap/parser';

export interface BlobCache {
  get(key: string): Promise<Uint8Array | null>;
  put(key: string, value: Uint8Array): Promise<void>;
}

export interface ImapDriverDeps {
  socketFactory: SocketFactory;
  cipher: CredentialCipher;
  blobs: BlobCache;
  oauthClients: Partial<Record<'google' | 'microsoft', OAuthClientCredentials>>;
  fetcher?: typeof fetch;
}

/** Error message prefix the request layer treats as "reconnect required". */
export const REAUTH_REQUIRED = 'invalid_grant';

const IDLE_CLOSE_MS = 20_000;

/** Query terms answered exactly from the local index (labels = folders + flags). */
const LOCAL_LABEL_TERMS = {
  'is:unread': { label: 'UNREAD', present: true },
  'is:read': { label: 'UNREAD', present: false },
  'is:starred': { label: 'STARRED', present: true },
  'is:unstarred': { label: 'STARRED', present: false },
  'is:important': { label: 'IMPORTANT', present: true },
  'is:sent': { label: 'SENT', present: true },
  'in:sent': { label: 'SENT', present: true },
  'is:draft': { label: 'DRAFT', present: true },
  'in:draft': { label: 'DRAFT', present: true },
  'in:drafts': { label: 'DRAFT', present: true },
  'is:inbox': { label: 'INBOX', present: true },
  'in:inbox': { label: 'INBOX', present: true },
  'in:spam': { label: 'SPAM', present: true },
  'is:spam': { label: 'SPAM', present: true },
  'in:trash': { label: 'TRASH', present: true },
  'in:bin': { label: 'TRASH', present: true },
  'in:archive': { label: 'ARCHIVE', present: true },
  // Inbox categories (see ../imap/categorize.ts).
  'is:personal': { label: 'CATEGORY_PERSONAL', present: true },
  'is:promotions': { label: 'CATEGORY_PROMOTIONS', present: true },
  'is:updates': { label: 'CATEGORY_UPDATES', present: true },
  'category:primary': { label: 'CATEGORY_PERSONAL', present: true },
  'category:personal': { label: 'CATEGORY_PERSONAL', present: true },
  'category:promotions': { label: 'CATEGORY_PROMOTIONS', present: true },
  'category:updates': { label: 'CATEGORY_UPDATES', present: true },
  'category:social': { label: 'CATEGORY_SOCIAL', present: true },
  'category:forums': { label: 'CATEGORY_FORUMS', present: true },
  // Self-addressed mail is deduplicated into INBOX, so `is:sent to:me` adds nothing.
  'to:me': false,
} as const;
const MAX_CACHED_MESSAGE_BYTES = 25 * 1024 * 1024;

const encoder = new TextEncoder();

/** RFC 5322 requires CRLF; mimetext emits bare LF, which strict IMAP servers reject on APPEND. */
const toCrlf = (raw: string) => encoder.encode(raw.replace(/\r?\n/g, '\r\n'));

const hasFlag = (flags: string[], flag: string) =>
  flags.some((value) => value.toLowerCase() === flag.toLowerCase());

const defaultDeps = async (): Promise<ImapDriverDeps> => {
  const [{ env }, { cloudflareSocketFactory }] = await Promise.all([
    import('../../env'),
    import('../mail-transport/cloudflare-socket'),
  ]);
  return {
    socketFactory: cloudflareSocketFactory,
    cipher: new CredentialCipher(env.CREDENTIALS_ENCRYPTION_KEYS),
    blobs: {
      get: async (key) => {
        const object = await env.THREADS_BUCKET.get(key);
        return object ? new Uint8Array(await object.arrayBuffer()) : null;
      },
      put: async (key, value) => {
        await env.THREADS_BUCKET.put(key, value);
      },
    },
    oauthClients: {
      google: env.GOOGLE_CLIENT_ID
        ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
        : undefined,
      microsoft: env.MICROSOFT_CLIENT_ID
        ? { clientId: env.MICROSOFT_CLIENT_ID, clientSecret: env.MICROSOFT_CLIENT_SECRET }
        : undefined,
    },
  };
};

export class ImapMailManager implements MailManager {
  private client: ImapClient | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private lock: Promise<unknown> = Promise.resolve();
  private store: ImapIndexStore;
  private engine: ImapSyncEngine;
  private depsPromise: Promise<ImapDriverDeps>;
  private oauth: { accessToken: string; expiresAt: number } | null = null;
  private syncRuns = 0;

  constructor(
    public config: ManagerConfig,
    deps?: ImapDriverDeps,
  ) {
    if (!config.imap) throw new Error('IMAP settings are required');
    if (!config.storage) throw new Error('IMAP driver requires mailbox storage');
    this.store = new ImapIndexStore(config.storage);
    this.store.initialize();
    this.engine = new ImapSyncEngine(this.store, defaultSyncOptions);
    this.depsPromise = deps ? Promise.resolve(deps) : defaultDeps();
    if (config.imap.accessToken)
      this.oauth = { accessToken: config.imap.accessToken, expiresAt: Date.now() + 5 * 60_000 };
  }

  private get settings() {
    return this.config.imap!;
  }

  private get email() {
    return this.config.auth.email;
  }

  // ---------------------------------------------------------------- plumbing

  private async withErrorHandler<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: Record<string, unknown>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const authFailed =
        error instanceof ImapAuthError ||
        error instanceof SmtpAuthError ||
        (error instanceof OAuthRefreshError && error.permanent);
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[ERROR] [IMAP Driver] Operation: ${operation}`, {
        error: message,
        context: sanitizeContext(context),
        authFailed,
      });
      if (authFailed) {
        // `invalid_grant` makes the request layer mark the connection as needing reconnect.
        throw new StandardizedError(
          Object.assign(new Error(`${REAUTH_REQUIRED}: ${message}`), { code: 'AUTH_FAILED' }),
          operation,
          context,
        );
      }
      throw new StandardizedError(
        Object.assign(error instanceof Error ? error : new Error(message), {
          code:
            error instanceof MailConnectionError
              ? `CONNECTION_${error.kind.toUpperCase()}`
              : 'IMAP_ERROR',
        }) as Error & { code: string },
        operation,
        context,
      );
    }
  }

  private async secret() {
    const deps = await this.depsPromise;
    return deps.cipher.decrypt(this.settings.secret, this.settings.connectionId);
  }

  private async accessToken(force = false) {
    if (!force && this.oauth && this.oauth.expiresAt > Date.now() + 60_000)
      return this.oauth.accessToken;
    const provider = this.settings.oauthProvider;
    if (!provider) throw new OAuthRefreshError('XOAUTH2 connection has no OAuth provider', true);
    const deps = await this.depsPromise;
    const client = deps.oauthClients[provider];
    if (!client) throw new OAuthRefreshError(`${provider} OAuth is not configured`, false);
    const tokens = await refreshAccessToken(provider, client, await this.secret(), deps.fetcher);
    this.oauth = { accessToken: tokens.accessToken, expiresAt: tokens.expiresAt };
    if (tokens.refreshToken && this.settings.onSecretRotated) {
      const rotated = await deps.cipher.encrypt(tokens.refreshToken, this.settings.connectionId);
      this.settings.secret = rotated;
      await this.settings
        .onSecretRotated(rotated)
        .catch((error) =>
          console.warn('[IMAP Driver] Failed to persist rotated refresh token', String(error)),
        );
    }
    return tokens.accessToken;
  }

  private async imapAuth(): Promise<ImapAuth> {
    const { imap, authMethod } = this.settings;
    return authMethod === 'xoauth2'
      ? { method: 'xoauth2', username: imap.username, accessToken: await this.accessToken() }
      : { method: 'password', username: imap.username, password: await this.secret() };
  }

  private async smtpAuth(): Promise<SmtpAuth> {
    const { smtp, authMethod } = this.settings;
    return authMethod === 'xoauth2'
      ? { method: 'xoauth2', username: smtp.username, accessToken: await this.accessToken() }
      : { method: 'password', username: smtp.username, password: await this.secret() };
  }

  private async connectImap() {
    const deps = await this.depsPromise;
    const { imap } = this.settings;
    const open = async () =>
      ImapClient.connect({
        host: imap.host,
        port: imap.port,
        security: imap.security,
        auth: await this.imapAuth(),
        socketFactory: deps.socketFactory,
      });
    try {
      return await open();
    } catch (error) {
      // An expired cached XOAUTH2 token: refresh once and retry.
      if (error instanceof ImapAuthError && this.settings.authMethod === 'xoauth2') {
        await this.accessToken(true);
        return open();
      }
      throw error;
    }
  }

  private async connectSmtp() {
    const deps = await this.depsPromise;
    const { smtp } = this.settings;
    const open = async () =>
      SmtpClient.connect({
        host: smtp.host,
        port: smtp.port,
        security: smtp.security,
        auth: await this.smtpAuth(),
        socketFactory: deps.socketFactory,
        clientHostname: this.email.split('@')[1],
      });
    try {
      return await open();
    } catch (error) {
      if (error instanceof SmtpAuthError && this.settings.authMethod === 'xoauth2') {
        await this.accessToken(true);
        return open();
      }
      throw error;
    }
  }

  /** Runs `fn` with exclusive use of the (lazily opened, reused) IMAP connection. */
  private withImap<T>(fn: (client: ImapClient) => Promise<T>): Promise<T> {
    const run = async () => {
      clearTimeout(this.idleTimer);
      for (let attempt = 0; ; attempt++) {
        if (!this.client || this.client.isClosed) this.client = await this.connectImap();
        try {
          return await fn(this.client);
        } catch (error) {
          if (error instanceof MailConnectionError && attempt === 0) {
            await this.client?.close();
            this.client = null;
            continue;
          }
          throw error;
        } finally {
          this.scheduleIdleClose();
        }
      }
    };
    const task = this.lock.then(run, run);
    this.lock = task.catch(() => {});
    return task;
  }

  private scheduleIdleClose() {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      const client = this.client;
      this.client = null;
      void client?.logout();
    }, IDLE_CLOSE_MS);
  }

  async dispose() {
    clearTimeout(this.idleTimer);
    const client = this.client;
    this.client = null;
    await Promise.all([client?.logout(), this.stopWatching()]);
  }

  // ---------------------------------------------------------------- push (IMAP IDLE)

  private watchClient: ImapClient | null = null;
  private watchExists = -1;

  /**
   * Waits on a dedicated connection (IDLE on INBOX) until the inbox changes, `maxMs`
   * elapses or `signal` aborts. The connection stays open between calls so re-idling is
   * cheap; `stopWatching()` closes it. Returns `unsupported` when the server lacks IDLE.
   */
  waitForInboxChange(options: { maxMs: number; signal?: AbortSignal }) {
    return this.withErrorHandler('waitForInboxChange', async () => {
      if (!this.watchClient || this.watchClient.isClosed) {
        const client = await this.connectImap();
        if (!client.has('IDLE')) {
          await client.logout();
          return 'unsupported' as const;
        }
        const inbox = this.store.folders().find((folder) => folder.system === 'INBOX');
        const info = await client.select(inbox?.path ?? 'INBOX', { readOnly: true });
        this.watchExists = info.exists;
        this.watchClient = client;
      }
      const { reason } = await this.watchClient.idle({
        maxMs: options.maxMs,
        signal: options.signal,
        onUpdate: (update) => {
          // Some servers repeat the current count when IDLE starts; only a change counts.
          if (update.kind === 'exists') {
            const changed = update.count !== this.watchExists;
            this.watchExists = update.count;
            return changed;
          }
          if (update.kind === 'expunge') this.watchExists = Math.max(0, this.watchExists - 1);
          return true;
        },
      });
      return reason === 'update' ? ('changed' as const) : reason;
    });
  }

  async stopWatching() {
    const client = this.watchClient;
    this.watchClient = null;
    // Close rather than LOGOUT: LOGOUT would queue behind an IDLE still in progress.
    await client?.close();
  }

  private async ensureFolders(client: ImapClient) {
    if (!this.store.folders().length) await this.engine.refreshFolders(client);
  }

  private folderFor(label: string) {
    const upper = label.toUpperCase();
    if ((SYSTEM_FOLDER_LABELS as string[]).includes(upper))
      return this.store.folders().find((folder) => folder.system === upper && !folder.skip);
    const path = folderPathFromLabelId(label);
    if (path) return this.store.folder(path);
    return this.store
      .folders()
      .find(
        (folder) =>
          !folder.skip &&
          (folder.path === label || folder.path.toLowerCase() === label.toLowerCase()),
      );
  }

  private labelForFolder(path: string) {
    return this.store.folder(path)?.labelId ?? path;
  }

  private isFolderLabel(label: string) {
    const upper = label.toUpperCase();
    return (
      ['INBOX', 'SPAM', 'TRASH', 'ARCHIVE'].includes(upper) || folderPathFromLabelId(label) !== null
    );
  }

  /** Finds or creates the folder for a system label (e.g. Archive on servers without one). */
  private async systemFolder(client: ImapClient, label: SystemFolderLabel) {
    await this.ensureFolders(client);
    const existing = this.folderFor(label);
    if (existing) return existing.path;
    const names: Record<SystemFolderLabel, string> = {
      INBOX: 'INBOX',
      SENT: 'Sent',
      DRAFT: 'Drafts',
      SPAM: 'Junk',
      TRASH: 'Trash',
      ARCHIVE: 'Archive',
    };
    const inbox = this.store.folders().find((folder) => folder.system === 'INBOX');
    // Servers with an INBOX-rooted namespace (e.g. Courier) need children of INBOX.
    const rooted =
      inbox?.delimiter &&
      this.store
        .folders()
        .filter((folder) => !folder.system)
        .every((folder) => folder.path.startsWith(`INBOX${inbox.delimiter}`)) &&
      this.store.folders().some((folder) => folder.path.startsWith(`INBOX${inbox.delimiter}`));
    const path = rooted ? `INBOX${inbox!.delimiter}${names[label]}` : names[label];
    try {
      await client.createMailbox(path);
    } catch (error) {
      if (!(error instanceof ImapCommandError) || error.code !== 'ALREADYEXISTS') throw error;
    }
    await this.engine.refreshFolders(client);
    this.store.upsertFolder({
      path,
      labelId: label,
      system: label,
      delimiter: inbox?.delimiter ?? '/',
      skip: false,
    });
    return path;
  }

  private rawCacheKey(folder: string, uidValidity: number, uid: number) {
    return `imap-raw/${this.settings.connectionId}/${stableId('f', folder)}-${uidValidity}-${uid}.eml`;
  }

  /** Raw RFC 5322 bytes for messages, from R2 when cached, else one FETCH per folder. */
  private async rawMessages(messages: StoredMessage[]): Promise<Map<string, Uint8Array>> {
    const deps = await this.depsPromise;
    const out = new Map<string, Uint8Array>();
    const missing = new Map<string, { uid: number; key: string; cacheKey: string }[]>();
    await Promise.all(
      messages.map(async (message) => {
        const location = message.locations[0];
        if (!location) return;
        const folder = this.store.folder(location.folder);
        if (!folder) return;
        const cacheKey = this.rawCacheKey(location.folder, folder.uidValidity, location.uid);
        const cached = await deps.blobs.get(cacheKey).catch(() => null);
        if (cached) out.set(message.key, cached);
        else {
          const list = missing.get(location.folder) ?? [];
          list.push({ uid: location.uid, key: message.key, cacheKey });
          missing.set(location.folder, list);
        }
      }),
    );
    if (!missing.size) return out;
    await this.withImap(async (client) => {
      for (const [folder, items] of missing) {
        await client.select(folder, { readOnly: true });
        const fetched = await client.uidFetch(toSequenceSet(items.map((item) => item.uid)), [
          'UID',
          'BODY.PEEK[]',
        ]);
        for (const message of fetched) {
          const item = items.find((candidate) => candidate.uid === message.uid);
          const raw = findSection(message, 'BODY[]');
          if (!item || !raw) continue;
          out.set(item.key, raw);
          if (raw.length <= MAX_CACHED_MESSAGE_BYTES)
            await deps.blobs.put(item.cacheKey, raw).catch(() => {});
        }
      }
    });
    return out;
  }

  private messageTags(message: StoredMessage) {
    const tags = new Set<string>();
    const keywords = new Map<string, string>();
    let seen = false;
    let draft = false;
    for (const location of message.locations) {
      const label = this.labelForFolder(location.folder);
      tags.add(label);
      if (hasFlag(location.flags, '\\Seen')) seen = true;
      if (hasFlag(location.flags, '\\Flagged')) tags.add('STARRED');
      if (hasFlag(location.flags, '$Important')) tags.add('IMPORTANT');
      if (hasFlag(location.flags, '\\Draft') || label === 'DRAFT') draft = true;
      for (const flag of location.flags) {
        if (flag.startsWith('\\')) continue;
        const registered = this.store.keywordLabel(flag);
        if (registered) keywords.set(keywordLabelId(registered.keyword), registered.name);
      }
    }
    if (draft) tags.add('DRAFT');
    // Drafts and sent copies are never "unread", and have no inbox category.
    const unread = !seen && !draft && !tags.has('SENT');
    if (unread) tags.add('UNREAD');
    const category = message.threadCategory ?? message.category;
    if (category && !draft && !tags.has('SENT')) tags.add(CATEGORY_LABELS[category]);
    return {
      unread,
      draft,
      tags: [
        ...[...tags].map((id) => ({
          id,
          name: id,
          type: id.startsWith('F_') ? 'user' : 'system',
        })),
        ...[...keywords].map(([id, name]) => ({ id, name, type: 'user' })),
      ],
    };
  }

  // ---------------------------------------------------------------- sync

  syncMailbox(options: { refreshFolders?: boolean } = {}) {
    return this.withErrorHandler('syncMailbox', () =>
      this.withImap(async (client) => {
        const result = await this.engine.run(client, {
          refreshFolders: options.refreshFolders || this.syncRuns++ === 0,
        });
        return { complete: result.complete, fetched: result.fetched };
      }),
    );
  }

  pendingThreadChanges(limit: number) {
    return this.store.dirtyThreads(limit);
  }

  acknowledgeThreadChanges(threadIds: string[]) {
    this.store.clearDirty(threadIds);
  }

  takeNewMailThreads() {
    return this.store.takeNewMail();
  }

  /** The AI workflow's (or user's) inbox category for a thread; re-imported on next sync. */
  async setThreadCategory(threadId: string, category: MailCategory, source: 'ai' | 'user') {
    return this.store.setThreadCategory(threadId, category, source);
  }

  /** Fetches headers for UIDs (e.g. after APPEND or for search hits) into the index. */
  private async indexUids(client: ImapClient, folder: string, uids: number[]) {
    const state = this.store.folder(folder);
    if (!state || !uids.length) return;
    const fetched = await client.uidFetch(toSequenceSet(uids), [
      'UID',
      'FLAGS',
      'INTERNALDATE',
      'RFC822.SIZE',
      `BODY.PEEK[HEADER.FIELDS (${HEADER_FIELDS})]`,
    ]);
    this.engine.ingest(folder, state.uidValidity, fetched);
  }

  // ---------------------------------------------------------------- reading

  get(threadId: string) {
    return this.withErrorHandler(
      'get',
      async (): Promise<IGetThreadResponse> => {
        const stored = this.store.threadMessages(threadId);
        if (!stored.length)
          return { messages: [], latest: undefined, hasUnread: false, totalReplies: 0, labels: [] };
        const raws = await this.rawMessages(stored);
        const labels = new Map<string, string>();
        const messages = [];
        for (const message of stored) {
          const raw = raws.get(message.key);
          if (!raw) continue;
          const { tags, unread, draft } = this.messageTags(message);
          for (const tag of tags) labels.set(tag.id, tag.name);
          const email = await parseRawMessage(raw);
          messages.push(
            toParsedMessage(email, {
              id: message.key,
              threadId,
              tags,
              unread,
              isDraft: draft,
              internalDate: message.date,
            }),
          );
        }
        return {
          messages,
          latest: messages.findLast((message) => !message.isDraft),
          hasUnread: messages.some((message) => message.unread),
          totalReplies: messages.filter((message) => !message.isDraft).length,
          labels: [...labels].map(([id, name]) => ({ id, name })),
        };
      },
      { threadId },
    );
  }

  list(params: {
    folder: string;
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string | number;
  }) {
    const { folder, query = '', maxResults = 50, labelIds = [], pageToken } = params;
    return this.withErrorHandler(
      'list',
      async () => {
        const offset = Number(pageToken) || 0;
        const local = query.trim() ? compileLocalLabelQuery(query, LOCAL_LABEL_TERMS) : undefined;
        if (local) return this.listLocal(local, labelIds, maxResults, offset);

        const translated = translateSearch(query);
        // Tag labels span folders; filter them over the local index.
        if (translated.empty && labelIds.some(isKeywordLabel))
          return this.listLocal(() => true, labelIds, maxResults, offset);
        const folderLabel =
          translated.folder ??
          labelIds[0] ??
          {
            inbox: 'INBOX',
            sent: 'SENT',
            spam: 'SPAM',
            bin: 'TRASH',
            trash: 'TRASH',
            archive: 'ARCHIVE',
            draft: 'DRAFT',
          }[folder] ??
          folder;

        if (translated.empty) {
          const target = this.folderFor(folderLabel);
          if (!target) return { threads: [], nextPageToken: null };
          const rows = this.store.threadsInFolder(target.path, offset + maxResults + 1);
          const page = rows.slice(offset, offset + maxResults);
          return {
            threads: page.map((row) => ({ id: row.threadId, historyId: null })),
            nextPageToken: rows.length > offset + maxResults ? String(offset + maxResults) : null,
          };
        }

        return this.withImap(async (client) => {
          await this.ensureFolders(client);
          const target = this.folderFor(folderLabel);
          if (!target) return { threads: [], nextPageToken: null };
          await client.select(target.path, { readOnly: true });
          let criteria: CommandArg[] = translated.criteria;
          if (!client.utf8 && [...JSON.stringify(criteria)].some((ch) => ch.charCodeAt(0) > 0x7f)) {
            const toLiteral = (arg: CommandArg): CommandArg =>
              Array.isArray(arg)
                ? arg.map(toLiteral)
                : typeof arg === 'object' && 'quoted' in arg
                  ? { literal: encoder.encode(arg.quoted) }
                  : arg;
            criteria = ['CHARSET', 'UTF-8', ...criteria.map(toLiteral)];
          }
          const uids = (await client.uidSearch(criteria)).sort((a, b) => b - a);
          const page = uids.slice(offset, offset + maxResults);
          const unknown = page.filter((uid) => !this.store.hasLocation(target.path, uid));
          // Hits outside the synced window are indexed so their threads can be opened.
          if (unknown.length) await this.indexUids(client, target.path, unknown);
          const ids = this.store.threadsForUids(target.path, page);
          return {
            threads: ids.map((id) => ({ id, historyId: null })),
            nextPageToken: uids.length > offset + maxResults ? String(offset + maxResults) : null,
          };
        });
      },
      { folder, maxResults, pageToken },
    );
  }

  /** Label-only queries over the local index: newest threads with a matching message. */
  private listLocal(
    matches: (labels: Set<string>) => boolean,
    labelIds: string[],
    maxResults: number,
    offset: number,
  ) {
    const threads: { id: string; historyId: null }[] = [];
    let scanned = offset;
    const chunk = 200;
    for (;;) {
      const ids = this.store.threadsByDate(chunk, scanned);
      for (const id of ids) {
        scanned++;
        const hit = this.store.threadMessages(id).some((message) => {
          const labels = new Set(this.messageTags(message).tags.map((tag) => tag.id));
          return labelIds.every((label) => labels.has(label)) && matches(labels);
        });
        if (hit) threads.push({ id, historyId: null });
        if (threads.length === maxResults) break;
      }
      if (threads.length === maxResults || ids.length < chunk) {
        const more =
          threads.length === maxResults && this.store.threadsByDate(1, scanned).length > 0;
        return { threads, nextPageToken: more ? String(scanned) : null };
      }
    }
  }

  count() {
    return this.withErrorHandler('count', () =>
      this.withImap(async (client) => {
        await this.ensureFolders(client);
        const names: Record<string, string> = {
          INBOX: 'inbox',
          SENT: 'sent',
          DRAFT: 'drafts',
          SPAM: 'spam',
          TRASH: 'trash',
          ARCHIVE: 'archive',
        };
        const folders = this.store
          .folders()
          .filter((folder) => !folder.skip)
          .slice(0, 60);
        const out: { count?: number; label?: string; labelId?: string }[] = [];
        for (const folder of folders) {
          try {
            const status = await client.status(folder.path, ['MESSAGES', 'UNSEEN']);
            const totals =
              folder.system === 'SENT' || folder.system === 'DRAFT' || folder.system === 'ARCHIVE';
            out.push({
              labelId: folder.labelId,
              label: folder.system
                ? names[folder.system]
                : folder.path
                    .split(folder.delimiter ?? '/')
                    .join('/')
                    .toLowerCase(),
              count: totals ? status.MESSAGES : status.UNSEEN,
            });
          } catch {
            // Folder vanished; the next sync forgets it.
          }
        }
        return out;
      }),
    );
  }

  getMessageAttachments(messageId: string, options?: { fresh?: boolean; includeInline?: boolean }) {
    return this.withErrorHandler(
      'getMessageAttachments',
      async () => {
        const message = this.store.message(messageId);
        if (!message) return [];
        const raw = (await this.rawMessages([message])).get(message.key);
        if (!raw) return [];
        const email = await parseRawMessage(raw);
        return (
          options?.includeInline
            ? email.attachments.map((attachment, index) => ({ attachment, index }))
            : listedAttachments(email)
        )
          .map(({ index }) => attachmentPayload(email, String(index)))
          .filter((attachment): attachment is NonNullable<typeof attachment> => !!attachment);
      },
      { messageId },
    );
  }

  getAttachment(messageId: string, attachmentId: string) {
    return this.withErrorHandler(
      'getAttachment',
      async () => {
        const message = this.store.message(messageId);
        if (!message) return undefined;
        const raw = (await this.rawMessages([message])).get(message.key);
        if (!raw) return undefined;
        return attachmentPayload(await parseRawMessage(raw), attachmentId)?.body;
      },
      { messageId, attachmentId },
    );
  }

  // ---------------------------------------------------------------- sending

  private messageIdFor(domainSource: string) {
    const domain = addressOf(domainSource).split('@')[1] || 'zero.email';
    return `<${crypto.randomUUID()}@${domain}>`;
  }

  /** Fills In-Reply-To/References from the thread when the client did not send them. */
  private threadingHeaders(data: IOutgoingMessage) {
    const headers = { ...data.headers };
    const has = (name: string) => Object.keys(headers).some((key) => key.toLowerCase() === name);
    if (data.threadId && !data.isForward && !has('in-reply-to')) {
      const last = this.store
        .threadMessages(data.threadId)
        .findLast((message) => message.messageId);
      if (last?.messageId) {
        headers['In-Reply-To'] = `<${last.messageId}>`;
        if (!has('references')) {
          const ids = this.store
            .threadMessages(data.threadId)
            .map((message) => message.messageId)
            .filter((id): id is string => !!id);
          headers['References'] = ids.map((id) => `<${id}>`).join(' ');
        }
      }
    }
    return headers;
  }

  private async appendAndIndex(
    client: ImapClient,
    folder: string,
    raw: Uint8Array,
    flags: string[],
  ) {
    const appended = await client.append(folder, raw, flags, new Date());
    const state = this.store.folder(folder);
    if (appended && state && appended.uidValidity === state.uidValidity) {
      await client.select(folder, { readOnly: true });
      await this.indexUids(client, folder, [appended.uid]);
      return appended.uid;
    }
    return null;
  }

  private async sendRaw(data: IOutgoingMessage) {
    const from = data.fromEmail || this.email;
    const messageId = this.messageIdFor(from);
    const { raw, recipients } = await buildOutgoingMime(
      { ...data, headers: this.threadingHeaders(data) },
      {
        defaultFrom: this.settings.displayName
          ? `"${this.settings.displayName.replace(/"/g, '')}" <${this.email}>`
          : this.email,
        messageId,
      },
    );
    const smtpClient = await this.connectSmtp();
    try {
      await smtpClient.send(
        { from: addressOf(from), recipients },
        encoder.encode(stripBccHeader(raw)),
      );
    } finally {
      await smtpClient.quit();
    }

    const key = stableId('m', messageId.slice(1, -1));
    if (!this.settings.serverSavesSent) {
      await this.withImap(async (client) => {
        const sent = await this.systemFolder(client, 'SENT');
        await this.appendAndIndex(client, sent, toCrlf(raw), ['\\Seen']);
      }).catch((error) =>
        // The message was delivered; failing to file a copy must not report a send failure.
        console.warn('[IMAP Driver] Failed to save sent copy', String(error)),
      );
    }
    return { id: key, threadId: this.store.message(key)?.threadId ?? data.threadId ?? null };
  }

  create(data: IOutgoingMessage) {
    return this.withErrorHandler('create', () => this.sendRaw(data), { data });
  }

  sendDraft(id: string, data: IOutgoingMessage) {
    return this.withErrorHandler(
      'sendDraft',
      async () => {
        await this.sendRaw(data);
        await this.removeDraftLocations(id).catch((error) =>
          console.warn('[IMAP Driver] Failed to delete sent draft', String(error)),
        );
      },
      { id, data },
    );
  }

  // ---------------------------------------------------------------- drafts

  private async removeDraftLocations(id: string) {
    const message = this.store.message(id);
    if (!message) return;
    await this.withImap(async (client) => {
      const drafts = await this.systemFolder(client, 'DRAFT');
      const uids = message.locations
        .filter((location) => location.folder === drafts)
        .map((location) => location.uid);
      if (!uids.length) return;
      await client.select(drafts);
      const set = toSequenceSet(uids);
      await client.uidStore(set, '+FLAGS', ['\\Deleted']);
      await client.uidExpunge(set);
      this.store.removeLocations(drafts, uids);
    });
  }

  createDraft(data: CreateDraftData) {
    return this.withErrorHandler(
      'createDraft',
      async () => {
        const existing = data.id ? this.store.message(data.id) : null;
        const messageId = existing?.messageId
          ? `<${existing.messageId}>`
          : this.messageIdFor(data.fromEmail || this.email);
        const raw = await buildDraftMime(data, { from: this.email, messageId });
        return this.withImap(async (client) => {
          const drafts = await this.systemFolder(client, 'DRAFT');
          const oldUids =
            existing?.locations.filter((l) => l.folder === drafts).map((l) => l.uid) ?? [];
          await this.appendAndIndex(client, drafts, toCrlf(raw), ['\\Draft', '\\Seen']);
          if (oldUids.length) {
            await client.select(drafts);
            const set = toSequenceSet(oldUids);
            await client.uidStore(set, '+FLAGS', ['\\Deleted']);
            await client.uidExpunge(set);
            this.store.removeLocations(drafts, oldUids);
          }
          return { id: stableId('m', messageId.slice(1, -1)), success: true };
        });
      },
      { draftId: data.id },
    );
  }

  getDraft(id: string, options?: { includeInline?: boolean }) {
    return this.withErrorHandler(
      'getDraft',
      async (): Promise<ParsedDraft> => {
        const message = this.store.message(id);
        const drafts = this.folderFor('DRAFT')?.path;
        if (
          !message ||
          !drafts ||
          !message.locations.some((location) => location.folder === drafts)
        )
          throw new Error('Draft not found');
        const raw = (await this.rawMessages([message])).get(message.key);
        if (!raw) throw new Error('Draft not found');
        const email = await parseRawMessage(raw);
        const parsed = toParsedMessage(email, {
          id,
          threadId: message.threadId,
          tags: [],
          unread: false,
          isDraft: true,
        });
        const format = (list: { name?: string; email: string }[] | null) =>
          (list ?? []).map((address) => address.email).filter(Boolean);
        return {
          id,
          fromEmail: parsed.sender.email,
          threadId: message.threadId,
          inReplyTo: parsed.inReplyTo,
          references: parsed.references,
          to: format(parsed.to),
          cc: format(parsed.cc),
          bcc: format(parsed.bcc),
          subject: email.subject ?? '',
          content: parsed.decodedBody ?? '',
          rawMessage: { internalDate: String(message.date) },
          attachments: (options?.includeInline
            ? email.attachments.map((attachment, index) => ({ attachment, index }))
            : listedAttachments(email)
          )
            .map(({ index }) => attachmentPayload(email, String(index)))
            .filter((attachment): attachment is NonNullable<typeof attachment> => !!attachment),
        };
      },
      { id },
    );
  }

  listDrafts(params: { q?: string; maxResults?: number; pageToken?: string }) {
    const { maxResults = 20, pageToken } = params;
    return this.withErrorHandler(
      'listDrafts',
      async () => {
        const drafts = await this.withImap(async (client) => this.systemFolder(client, 'DRAFT'));
        const offset = Number(pageToken) || 0;
        const rows = this.store.threadsInFolder(drafts, offset + maxResults + 1);
        const page = rows.slice(offset, offset + maxResults);
        const messages = page.flatMap((row) =>
          this.store
            .threadMessages(row.threadId)
            .filter((message) => message.locations.some((location) => location.folder === drafts)),
        );
        const raws = await this.rawMessages(messages);
        const threads = [];
        for (const message of messages) {
          const raw = raws.get(message.key);
          if (!raw) continue;
          const parsed = toParsedMessage(await parseRawMessage(raw), {
            id: message.key,
            threadId: message.threadId,
            ...this.messageTags(message),
            isDraft: true,
          });
          threads.push({
            id: message.key,
            historyId: message.threadId,
            $raw: { ...parsed, decodedBody: undefined, attachments: undefined },
          });
        }
        return {
          threads,
          nextPageToken: rows.length > offset + maxResults ? String(offset + maxResults) : null,
        };
      },
      { maxResults, pageToken },
    );
  }

  listThreadDrafts(threadId: string) {
    return this.withErrorHandler(
      'listThreadDrafts',
      async () => {
        const drafts = this.folderFor('DRAFT')?.path;
        return this.store
          .threadMessages(threadId)
          .filter((message) =>
            message.locations.some(
              (location) => location.folder === drafts || hasFlag(location.flags, '\\Draft'),
            ),
          )
          .map((message) => ({ draftId: message.key, messageId: message.key }));
      },
      { threadId },
    );
  }

  deleteDraft(id: string) {
    return this.withErrorHandler('deleteDraft', () => this.removeDraftLocations(id), { id });
  }

  // ---------------------------------------------------------------- mutations

  private async moveLocations(
    client: ImapClient,
    locations: { folder: string; uid: number }[],
    destination: string,
  ) {
    const bySource = new Map<string, number[]>();
    for (const location of locations) {
      if (location.folder === destination) continue;
      bySource.set(location.folder, [...(bySource.get(location.folder) ?? []), location.uid]);
    }
    const unresolved: { source: string; uid: number; key: string | null }[] = [];
    for (const [source, uids] of bySource) {
      await client.select(source);
      const moved = await client.uidMove(toSequenceSet(uids), destination);
      const destState = this.store.folder(destination);
      // A folder we have not selected yet (uidValidity 0) adopts the COPYUID validity.
      const validity =
        moved &&
        destState &&
        (destState.uidValidity === 0 || moved.uidValidity === destState.uidValidity);
      for (const uid of uids) {
        const target = validity ? moved!.map.get(uid) : undefined;
        if (target)
          this.store.relocate({ folder: source, uid }, { folder: destination, uid: target });
        else unresolved.push({ source, uid, key: this.store.keyAt(source, uid) });
      }
    }
    if (!unresolved.length) return;
    // No COPYUID (no UIDPLUS): find the moved copies by Message-ID so the thread stays intact.
    await client.select(destination, { readOnly: true });
    for (const item of unresolved) {
      const messageId = item.key ? this.store.message(item.key)?.messageId : null;
      const [found] = messageId
        ? await client.uidSearch(['HEADER', { quoted: 'Message-ID' }, { quoted: messageId }])
        : [];
      if (found)
        this.store.relocate(
          { folder: item.source, uid: item.uid },
          { folder: destination, uid: found },
        );
      // Otherwise the next sync picks it up in its new folder.
      else this.store.removeLocations(item.source, [item.uid]);
    }
  }

  /**
   * Adds or removes one flag on the given locations. Keywords are only stored in folders
   * whose PERMANENTFLAGS allow them; returns the folders where an add was refused.
   */
  private async storeFlags(
    client: ImapClient,
    locations: { folder: string; uid: number; flags: string[] }[],
    flag: string,
    add: boolean,
  ): Promise<string[]> {
    const refused: string[] = [];
    const bySource = new Map<string, number[]>();
    for (const location of locations)
      bySource.set(location.folder, [...(bySource.get(location.folder) ?? []), location.uid]);
    for (const [folder, uids] of bySource) {
      await client.select(folder);
      if (
        add &&
        !flag.startsWith('\\') &&
        !canStoreKeyword(client.selected?.permanentFlags ?? [], flag)
      ) {
        refused.push(folder);
        continue;
      }
      await client.uidStore(toSequenceSet(uids), add ? '+FLAGS' : '-FLAGS', [flag]);
      for (const location of locations.filter((l) => l.folder === folder)) {
        const flags = add
          ? [...new Set([...location.flags, flag])]
          : location.flags.filter((value) => value.toLowerCase() !== flag.toLowerCase());
        this.store.updateFlags(folder, location.uid, flags);
      }
    }
    return refused;
  }

  private threadLocations(threadIds: string[]) {
    return threadIds.flatMap((id) =>
      this.store.threadMessages(id).flatMap((message) => message.locations),
    );
  }

  /** Adds/removes keyword tag labels (`K_…`); never moves messages. */
  private async storeKeywordLabels(
    client: ImapClient,
    threadIds: string[],
    addLabels: string[],
    removeLabels: string[],
  ) {
    const refused = new Set<string>();
    for (const [labels, add] of [
      [addLabels, true],
      [removeLabels, false],
    ] as const) {
      for (const label of labels) {
        const keyword = keywordFromLabelId(label);
        if (!keyword) continue;
        // Re-read locations each time: earlier stores updated their flags. Skip
        // messages already in the desired state, and drafts.
        const targets = this.threadLocations(threadIds).filter(
          (location) =>
            hasFlag(location.flags, keyword) !== add &&
            this.labelForFolder(location.folder) !== 'DRAFT',
        );
        if (!targets.length) continue;
        const failed = await this.storeFlags(client, targets, keyword, add);
        if (failed.length) refused.add(label);
      }
    }
    return refused;
  }

  applyTagLabels(threadIds: string[], addLabels: string[], removeLabels: string[]) {
    return this.withErrorHandler(
      'applyTagLabels',
      () =>
        this.withImap(async (client) => {
          await this.ensureFolders(client);
          const add = addLabels.filter(isKeywordLabel);
          const remove = removeLabels.filter(isKeywordLabel);
          const refused = await this.storeKeywordLabels(client, threadIds, add, remove);
          // Folder labels would move mail; anything that isn't a keyword stays app-side.
          return {
            unsupported: addLabels.filter((label) => !isKeywordLabel(label) || refused.has(label)),
          };
        }),
      { threadIds, addLabels, removeLabels },
    );
  }

  modifyLabels(threadIds: string[], options: { addLabels: string[]; removeLabels: string[] }) {
    return this.withErrorHandler(
      'modifyLabels',
      () =>
        this.withImap(async (client) => {
          await this.ensureFolders(client);
          const { addLabels, removeLabels } = options;
          const locations = () => this.threadLocations(threadIds);

          // Flags first (they don't change locations).
          const flagOps: [string, string][] = [
            ['UNREAD', '\\Seen'],
            ['STARRED', '\\Flagged'],
            ['IMPORTANT', '$Important'],
          ];
          for (const [label, flag] of flagOps) {
            const add = addLabels.includes(label);
            const remove = removeLabels.includes(label);
            if (!add && !remove) continue;
            // UNREAD is the inverse of \Seen.
            const setFlag = label === 'UNREAD' ? remove : add;
            await this.storeFlags(client, locations(), flag, setFlag);
          }
          // Tag labels (keywords) never move mail.
          await this.storeKeywordLabels(client, threadIds, addLabels, removeLabels);

          const addFolder = addLabels.find((label) => this.isFolderLabel(label));
          const removeFolders = removeLabels.filter((label) => this.isFolderLabel(label));
          if (!addFolder && !removeFolders.length) return;

          const labelOf = (folder: string) => this.labelForFolder(folder);
          const current = locations();
          let destination: string;
          let sources: typeof current;
          if (addFolder) {
            destination = (['INBOX', 'SPAM', 'TRASH', 'ARCHIVE'] as string[]).includes(
              addFolder.toUpperCase(),
            )
              ? await this.systemFolder(client, addFolder.toUpperCase() as SystemFolderLabel)
              : (this.folderFor(addFolder)?.path ?? '');
            if (!destination) throw new Error(`Unknown folder label ${addFolder}`);
            const destLabel = labelOf(destination);
            if (removeFolders.length) {
              sources = current.filter((l) => removeFolders.includes(labelOf(l.folder)));
            } else if (destLabel === 'TRASH' || destLabel === 'SPAM') {
              // Trashing/reporting a conversation takes all of it, except drafts.
              const keep = new Set(['DRAFT', destLabel]);
              sources = current.filter((l) => !keep.has(labelOf(l.folder)));
            } else {
              sources = current.filter((l) => labelOf(l.folder) === 'INBOX');
            }
          } else {
            const removed = new Set(removeFolders.map((label) => label.toUpperCase()));
            // Archive = leave INBOX; un-spam / restore = back to INBOX; dropping a user label
            // = archive (the message has to live somewhere).
            const target: SystemFolderLabel =
              removed.has('SPAM') || removed.has('TRASH') ? 'INBOX' : 'ARCHIVE';
            destination = await this.systemFolder(client, target);
            sources = current.filter((l) => removeFolders.includes(labelOf(l.folder)));
          }
          await this.moveLocations(client, sources, destination);
        }),
      { threadIds, options },
    );
  }

  markAsRead(threadIds: string[]) {
    return this.modifyLabels(threadIds, { addLabels: [], removeLabels: ['UNREAD'] });
  }

  markAsUnread(threadIds: string[]) {
    return this.modifyLabels(threadIds, { addLabels: ['UNREAD'], removeLabels: [] });
  }

  normalizeIds(ids: string[]) {
    return { threadIds: ids.map((id) => (id.startsWith('thread:') ? id.substring(7) : id)) };
  }

  /** Permanently deletes a thread (or a single message, by key). */
  delete(id: string) {
    return this.withErrorHandler(
      'delete',
      () =>
        this.withImap(async (client) => {
          const messages = this.store.threadMessages(id);
          const targets = messages.length ? messages : [this.store.message(id)].filter((m) => !!m);
          const byFolder = new Map<string, number[]>();
          for (const location of targets.flatMap((message) => message!.locations))
            byFolder.set(location.folder, [...(byFolder.get(location.folder) ?? []), location.uid]);
          for (const [folder, uids] of byFolder) {
            await client.select(folder);
            const set = toSequenceSet(uids);
            await client.uidStore(set, '+FLAGS', ['\\Deleted']);
            await client.uidExpunge(set);
            this.store.removeLocations(folder, uids);
          }
        }),
      { id },
    );
  }

  deleteAllSpam() {
    return this.withErrorHandler('deleteAllSpam', () =>
      this.withImap(async (client): Promise<DeleteAllSpamResponse> => {
        await this.ensureFolders(client);
        const spam = this.folderFor('SPAM');
        if (!spam) return { success: true, message: 'No spam folder', count: 0 };
        const info = await client.select(spam.path);
        if (!info.exists) return { success: true, message: 'Spam is empty', count: 0 };
        const uids = await client.uidSearch(['ALL']);
        const set = toSequenceSet(uids);
        await client.uidStore(set, '+FLAGS', ['\\Deleted']);
        await client.uidExpunge(set);
        this.store.removeLocations(spam.path, this.store.knownUids(spam.path));
        return {
          success: true,
          message: `Deleted ${uids.length} spam messages`,
          count: uids.length,
        };
      }),
    );
  }

  // ---------------------------------------------------------------- labels (folders)

  getUserLabels() {
    return this.withErrorHandler('getUserLabels', async (): Promise<Label[]> => {
      // The folder list is refreshed by sync; only connect when it was never loaded.
      if (!this.store.folders().length) await this.withImap((client) => this.ensureFolders(client));
      const folders: Label[] = this.store
        .folders()
        .filter((folder) => !folder.skip && !folder.system)
        .map((folder) => ({
          id: folder.labelId,
          name: this.displayName(folder.path, folder.delimiter),
          type: 'user',
        }));
      const tags: Label[] = this.store.keywordLabels().map((label) => ({
        id: keywordLabelId(label.keyword),
        name: label.name,
        type: 'user',
      }));
      return [...folders, ...tags];
    });
  }

  private displayName(path: string, delimiter: string | null) {
    let name = path;
    if (delimiter && name.toUpperCase().startsWith(`INBOX${delimiter}`)) name = name.slice(6);
    return delimiter ? name.split(delimiter).join('/') : name;
  }

  getLabel(id: string) {
    return this.withErrorHandler('getLabel', async (): Promise<Label> => {
      const keyword = keywordFromLabelId(id);
      if (keyword) {
        const tag = this.store.keywordLabel(keyword);
        if (!tag) throw new Error(`Label ${id} not found`);
        return { id, name: tag.name, type: 'user' };
      }
      const folder = this.folderFor(id);
      if (!folder) throw new Error(`Label ${id} not found`);
      return {
        id: folder.labelId,
        name: folder.system ?? this.displayName(folder.path, folder.delimiter),
        type: folder.system ? 'system' : 'user',
      };
    });
  }

  private pathForName(name: string) {
    const inbox = this.store.folders().find((folder) => folder.system === 'INBOX');
    const delimiter = inbox?.delimiter ?? '/';
    const userFolders = this.store.folders().filter((folder) => !folder.system && !folder.skip);
    const rooted =
      userFolders.length > 0 && userFolders.every((f) => f.path.startsWith(`INBOX${delimiter}`));
    const path = name.split('/').join(delimiter);
    return rooted ? `INBOX${delimiter}${path}` : path;
  }

  createLabel(
    label: { name: string; color?: { backgroundColor: string; textColor: string } },
    options: { kind?: 'tag' | 'folder' } = {},
  ) {
    if (options.kind === 'tag') {
      // A keyword needs no server call: it exists once a message carries it.
      return this.withErrorHandler(
        'createLabel',
        async () => {
          if (this.store.keywordByName(label.name)) return;
          const keyword = keywordForName(
            label.name,
            (candidate) => !!this.store.keywordLabel(candidate),
          );
          this.store.registerKeyword(keyword, label.name, 'app');
        },
        { name: label.name },
      );
    }
    return this.withErrorHandler(
      'createLabel',
      () =>
        this.withImap(async (client) => {
          await this.ensureFolders(client);
          await client.createMailbox(this.pathForName(label.name));
          await this.engine.refreshFolders(client);
        }),
      { name: label.name },
    );
  }

  updateLabel(
    id: string,
    label: { name: string; color?: { backgroundColor: string; textColor: string } },
  ) {
    const keyword = keywordFromLabelId(id);
    if (keyword) {
      // Renaming a tag keeps its keyword, so messages stay tagged.
      return this.withErrorHandler(
        'updateLabel',
        async () => {
          if (!this.store.keywordLabel(keyword)) throw new Error(`Label ${id} not found`);
          this.store.renameKeyword(keyword, label.name);
        },
        { id },
      );
    }
    return this.withErrorHandler(
      'updateLabel',
      () =>
        this.withImap(async (client) => {
          await this.ensureFolders(client);
          const folder = this.folderFor(id);
          if (!folder || folder.system) throw new Error('Only user folders can be renamed');
          await client.renameMailbox(folder.path, this.pathForName(label.name));
          await this.engine.refreshFolders(client);
        }),
      { id },
    );
  }

  deleteLabel(id: string) {
    const keyword = keywordFromLabelId(id);
    if (keyword) {
      return this.withErrorHandler(
        'deleteLabel',
        () =>
          this.withImap(async (client) => {
            // Untag every message first, or a later sync would rediscover the keyword.
            const tagged = this.store.keywordLocations(keyword);
            if (tagged.length) await this.storeFlags(client, tagged, keyword, false);
            this.store.forgetKeyword(keyword);
          }),
        { id },
      );
    }
    return this.withErrorHandler(
      'deleteLabel',
      () =>
        this.withImap(async (client) => {
          await this.ensureFolders(client);
          const folder = this.folderFor(id);
          if (!folder || folder.system) throw new Error('Only user folders can be deleted');
          await client.deleteMailbox(folder.path);
          await this.engine.refreshFolders(client);
        }),
      { id },
    );
  }

  // ---------------------------------------------------------------- account

  async getUserInfo() {
    return { address: this.email, name: this.settings.displayName ?? '', photo: '' };
  }

  async getEmailAliases() {
    return [{ email: this.email, name: this.settings.displayName ?? undefined, primary: true }];
  }

  getScope() {
    return this.settings.authMethod === 'xoauth2' ? 'imap:xoauth2' : 'imap:password';
  }

  async getTokens(): Promise<{
    tokens: { access_token?: string; refresh_token?: string; expiry_date?: number };
  }> {
    throw new Error('IMAP connections do not use OAuth codes');
  }

  async listHistory<T>(): Promise<{ history: T[]; historyId: string }> {
    return { history: [], historyId: '' };
  }

  async revokeToken() {
    return true;
  }
}

/** Verifies IMAP and SMTP settings by logging in to both. Used before saving a connection. */
export const testImapSmtpSettings = async (
  settings: {
    imap: { host: string; port: number; security: 'tls' | 'starttls'; username: string };
    smtp: { host: string; port: number; security: 'tls' | 'starttls'; username: string };
    auth: { method: 'password'; password: string } | { method: 'xoauth2'; accessToken: string };
  },
  socketFactory: SocketFactory,
) => {
  const imapAuth: ImapAuth =
    settings.auth.method === 'password'
      ? { method: 'password', username: settings.imap.username, password: settings.auth.password }
      : {
          method: 'xoauth2',
          username: settings.imap.username,
          accessToken: settings.auth.accessToken,
        };
  const smtpAuth: SmtpAuth =
    settings.auth.method === 'password'
      ? { method: 'password', username: settings.smtp.username, password: settings.auth.password }
      : {
          method: 'xoauth2',
          username: settings.smtp.username,
          accessToken: settings.auth.accessToken,
        };

  const result: {
    imap: { ok: boolean; error?: string; kind?: string; capabilities?: string[] };
    smtp: { ok: boolean; error?: string; kind?: string };
  } = { imap: { ok: false }, smtp: { ok: false } };

  const classify = (error: unknown) =>
    error instanceof ImapAuthError || error instanceof SmtpAuthError
      ? 'auth'
      : error instanceof MailConnectionError
        ? error.kind
        : 'protocol';

  await Promise.all([
    (async () => {
      try {
        const client = await ImapClient.connect({
          ...settings.imap,
          auth: imapAuth,
          socketFactory,
        });
        result.imap = { ok: true, capabilities: [...client.capabilities] };
        await client.logout();
      } catch (error) {
        result.imap = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          kind: classify(error),
        };
      }
    })(),
    (async () => {
      try {
        const client = await SmtpClient.connect({
          ...settings.smtp,
          auth: smtpAuth,
          socketFactory,
        });
        result.smtp = { ok: true };
        await client.quit();
      } catch (error) {
        result.smtp = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          kind: classify(error),
        };
      }
    })(),
  ]);
  return result;
};

export { headersFromBlock };
