import type { IOutgoingMessage, ParsedMessage, Label, DeleteAllSpamResponse } from '../../types';
import { ThreadListSummarySchema, type ThreadListSummary } from '../thread-list-summary';
import type { EncryptedSecret } from '../crypto/credentials';
import type { LabelStorage } from '../mail-label-store';
import { ParsedMessageSchema } from '../../types';
import type { CreateDraftData } from '../schemas';
import { z } from 'zod';

export interface IGetThreadResponse {
  providerHistoryId?: string;
  messages: ParsedMessage[];
  latest?: ParsedMessage;
  hasUnread: boolean;
  totalReplies: number;
  labels: { id: string; name: string }[];
  isLatestDraft?: boolean;
}

export const IGetThreadResponseSchema = z.object({
  messages: z.array(ParsedMessageSchema),
  latest: ParsedMessageSchema.optional(),
  hasUnread: z.boolean(),
  totalReplies: z.number(),
  labels: z.array(z.object({ id: z.string(), name: z.string() })),
});

export interface ParsedDraft {
  id: string;
  fromEmail?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  to?: string[];
  subject?: string;
  content?: string;
  rawMessage?: {
    internalDate?: string | null;
  };
  cc?: string[];
  bcc?: string[];
  attachments?: {
    filename: string;
    mimeType: string;
    size: number;
    body: string;
    headers?: { name: string; value: string }[];
  }[];
}

export interface IConfig {
  auth?: {
    access_token: string;
    refresh_token: string;
    email: string;
  };
}

export interface ImapServerSettings {
  host: string;
  port: number;
  security: 'tls' | 'starttls';
  username: string;
}

/** Connection settings for `providerId = 'imap'` (see mail0_connection_imap). */
export interface ImapManagerSettings {
  connectionId: string;
  displayName?: string | null;
  imap: ImapServerSettings;
  smtp: ImapServerSettings;
  authMethod: 'password' | 'xoauth2';
  oauthProvider?: 'google' | 'microsoft' | null;
  /** Encrypted password (password auth) or refresh token (XOAUTH2). AAD = connectionId. */
  secret: EncryptedSecret;
  /** XOAUTH2 access token cached on the connection row, if still valid. */
  accessToken?: string | null;
  serverSavesSent: boolean;
  /** Called when an OAuth provider rotates the refresh token, so it can be persisted. */
  onSecretRotated?: (secret: EncryptedSecret) => Promise<void>;
}

export type ManagerConfig = {
  auth: {
    userId: string;
    // accountId: string;
    accessToken: string;
    refreshToken: string;
    email: string;
  };
  /** IMAP/SMTP connections only. */
  imap?: ImapManagerSettings;
  /** Durable per-mailbox storage (the ZeroDriver DO's SQLite) for providers that need an index. */
  storage?: LabelStorage;
};

export interface MailManager {
  config: ManagerConfig;
  getMessageAttachments(
    id: string,
    options?: { fresh?: boolean; includeInline?: boolean },
  ): Promise<
    {
      filename: string;
      mimeType: string;
      size: number;
      attachmentId: string;
      headers: { name: string; value: string }[];
      body: string;
    }[]
  >;
  get(id: string): Promise<IGetThreadResponse>;
  create(data: IOutgoingMessage): Promise<{ id?: string | null }>;
  sendDraft(id: string, data: IOutgoingMessage): Promise<void>;
  createDraft(
    data: CreateDraftData,
  ): Promise<{ id?: string | null; success?: boolean; error?: string }>;
  getDraft(id: string, options?: { includeInline?: boolean }): Promise<ParsedDraft>;
  deleteDraft(id: string): Promise<void>;
  /** Drafts that belong to a thread, mapping provider draft id -> the draft's message id. */
  listThreadDrafts(threadId: string): Promise<{ draftId: string; messageId: string }[]>;
  listDrafts(params: { q?: string; maxResults?: number; pageToken?: string }): Promise<{
    threads: { id: string; historyId: string | null; $raw: unknown }[];
    nextPageToken: string | null;
  }>;
  delete(id: string): Promise<void>;
  list(params: {
    folder: string;
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string | number;
  }): Promise<{
    threads: { id: string; historyId: string | null; $raw?: unknown }[];
    nextPageToken: string | null;
  }>;
  count(): Promise<{ count?: number; label?: string; labelId?: string }[]>;
  getTokens(
    code: string,
  ): Promise<{ tokens: { access_token?: string; refresh_token?: string; expiry_date?: number } }>;
  getUserInfo(
    tokens?: ManagerConfig['auth'],
  ): Promise<{ address: string; name: string; photo: string }>;
  getScope(): string;
  listHistory<T>(historyId: string): Promise<{ history: T[]; historyId: string }>;
  getMailboxHistoryId?(): Promise<string>;
  listMailboxThreadIds?(
    pageToken?: string,
  ): Promise<{ ids: string[]; nextPageToken: string | null }>;
  watchMailbox?(topicName: string): Promise<{ expiration: number }>;
  /**
   * Pull-based providers (IMAP): runs one bounded sync pass into the provider's local index.
   * `complete` is false while more work (backfill, a large batch of new mail) remains.
   */
  syncMailbox?(options?: {
    refreshFolders?: boolean;
  }): Promise<{ complete: boolean; fetched: number }>;
  /** Threads changed by syncMailbox (or local mutations) that the mailbox must re-import. */
  pendingThreadChanges?(limit: number): string[];
  acknowledgeThreadChanges?(threadIds: string[]): void;
  /**
   * Pull-based providers (IMAP): returns and clears the threads that received new incoming
   * mail since the last call (excluding backfill, sent mail and drafts), for the AI workflow.
   */
  takeNewMailThreads?(): string[];
  /**
   * Providers without native inbox categories (IMAP): overrides the header-derived
   * category (Personal / Promotions / Updates) of a thread. Returns whether it changed.
   */
  setThreadCategory?(
    threadId: string,
    category: 'personal' | 'promotions' | 'updates',
    source: 'ai' | 'user',
  ): Promise<boolean>;
  /** Releases open protocol connections. */
  dispose?(): Promise<void>;
  /**
   * Push for pull-based providers (IMAP IDLE): resolves when the inbox changes, after
   * `maxMs`, or when `signal` aborts. `unsupported` means the server can't push.
   */
  waitForInboxChange?(options: {
    maxMs: number;
    signal?: AbortSignal;
  }): Promise<'changed' | 'timeout' | 'aborted' | 'unsupported'>;
  /** Closes the push connection opened by waitForInboxChange. */
  stopWatching?(): Promise<void>;
  markAsRead(threadIds: string[]): Promise<void>;
  markAsUnread(threadIds: string[]): Promise<void>;
  batchModifyMessageLabels?(
    messageIds: string[],
    addLabelIds: string[],
    removeLabelIds: string[],
  ): Promise<void>;
  normalizeIds(id: string[]): { threadIds: string[] };
  modifyLabels(
    id: string[],
    options: { addLabels: string[]; removeLabels: string[] },
  ): Promise<void>;
  getAttachment(messageId: string, attachmentId: string): Promise<string | undefined>;
  getUserLabels(): Promise<Label[]>;
  getLabel(id: string): Promise<Label>;
  createLabel(
    label: {
      name: string;
      color?: { backgroundColor: string; textColor: string };
    },
    options?: {
      /**
       * `tag` asks for a label that tags messages without moving them. Only IMAP
       * distinguishes the two (keyword vs folder); Gmail and Outlook ignore it.
       */
      kind?: 'tag' | 'folder';
    },
  ): Promise<void>;
  /**
   * Providers with non-moving tag labels (IMAP keywords): adds/removes tag labels on
   * threads. Returns the added labels the server could not store, which the caller
   * keeps app-side instead.
   */
  applyTagLabels?(
    threadIds: string[],
    addLabels: string[],
    removeLabels: string[],
  ): Promise<{ unsupported: string[] }>;
  updateLabel(
    id: string,
    label: { name: string; color?: { backgroundColor: string; textColor: string } },
  ): Promise<void>;
  deleteLabel(id: string): Promise<void>;
  getEmailAliases(): Promise<{ email: string; name?: string; primary?: boolean }[]>;
  revokeToken(token: string): Promise<boolean>;
  deleteAllSpam(): Promise<DeleteAllSpamResponse>;
}

export interface IGetThreadsResponse {
  threads: {
    id: string;
    historyId: string | null;
    $raw?: unknown;
    summary?: ThreadListSummary | null;
  }[];
  nextPageToken: string | null;
}

export const IGetThreadsResponseSchema = z.object({
  threads: z.array(
    z.object({
      id: z.string(),
      historyId: z.string().nullable(),
      $raw: z.unknown().optional(),
      /** Row data for the mail list; null when the thread isn't available locally yet. */
      summary: ThreadListSummarySchema.nullable().optional(),
    }),
  ),
  nextPageToken: z.string().nullable(),
});
