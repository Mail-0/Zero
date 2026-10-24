/*
 * Licensed to Zero Email Inc. under one or more contributor license agreements.
 * You may not use this file except in compliance with the Apache License, Version 2.0 (the "License").
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Reuse or distribution of this file requires a license from Zero Email Inc.
 */

import {
  parseStoredThreadSummary,
  resolveStoredThreadSummary,
  toStoredThreadSummary,
  toThreadListSummary,
  type StoredThreadSummary,
  type ThreadListSummary,
} from '../../lib/thread-list-summary';
import {
  isDurableLabelMutation,
  normalizeDurableLabelMutation,
  splitLabelMutation,
  isSyntheticLabel,
} from '../../lib/mail-label-policy';
import {
  IncomingMessageType,
  OutgoingMessageType,
  type IncomingMessage,
  type OutgoingMessage,
} from './types';
import {
  EProviders,
  type IOutgoingMessage,
  type ISnoozeBatch,
  type ParsedMessage,
} from '../../types';
import type { IGetThreadResponse, IGetThreadsResponse, MailManager } from '../../lib/driver/types';
import { appendResponseMessages, createDataStreamResponse, generateText } from 'ai';

const storedSummaryJson = (thread: IGetThreadResponse) => {
  const summary = toStoredThreadSummary(thread);
  return summary ? JSON.stringify(summary) : null;
};
import {
  deleteAllAttachments,
  deleteAttachments,
  referencedAttachmentIds,
  sweepOrphanedAttachments,
} from '../../lib/chat-attachments';
import {
  assistantClient,
  completionText,
  bindAssistantConversation,
  ownedMailbox,
} from '../../lib/assistant';
import {
  connectionToDriver,
  getZeroSocketAgent,
  imapSettingsFromRow,
} from '../../lib/server-utils';
import { generateWhatUserCaresAbout, type UserTopic } from '../../lib/analyze/interests';
import { LIVE_AI_THREAD_LIMIT, selectAiThreads } from '../../lib/thread-ai-dispatch';
import { disconnectedTokens, isConnectionActive } from '../../lib/connection-status';
import { AI_DISABLED_MESSAGE, isAiEnabledForConnection } from '../../lib/ai-access';
import { MailLabelStore, type LabelStorage } from '../../lib/mail-label-store';
import { gmailDeliveryFailure } from '../../lib/gmail-delivery-failure';
import { compileLabelMatcher } from '../../lib/mail-search-overlay';
import { scheduleMailContinuation } from '../../lib/mail-schedule';
import { MailHistoryStore } from '../../lib/mail-history-store';
import { MailContactStore } from '../../lib/mail-contact-store';
import { MailCleanupStore } from '../../lib/mail-cleanup-store';
import { searchAssistantSystemPrompt } from '../../lib/prompts';
import { unwrapGmailError } from '../../lib/gmail-quota-error';
import { MailSearchStore } from '../../lib/mail-search-store';
import { withGmailPriority } from '../../lib/gmail-priority';
import { connection, connectionImap } from '../../db/schema';
import { MailDraftStore } from '../../lib/mail-draft-store';
import { MailCountStore } from '../../lib/mail-count-store';
import { Migratable, Queryable, Transfer } from 'dormroom';
import type { CreateDraftData } from '../../lib/schemas';
import { withRetry } from '../../lib/gmail-rate-limit';
import { ConversationStore } from './conversations';
import { AIChatAgent } from 'agents/ai-chat-agent';
import type { gmail_v1 } from '@googleapis/gmail';
import { miniModel } from '../../lib/ai-models';
import { Agent, type Connection } from 'agents';
import { env, type ZeroEnv } from '../../env';
import type { WSMessage } from 'partyserver';
import { createDb } from '../../db';
import { DriverRpcDO } from './rpc';
import type { Message } from 'ai';
import { eq } from 'drizzle-orm';
import { Effect } from 'effect';

const shouldDropTables = false;
const maxCount = 20;
const shouldLoop = env.THREAD_SYNC_LOOP !== 'false';

// Error types for getUserTopics
export class StorageError extends Error {
  readonly _tag = 'StorageError';
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;
  }
}

export class LabelRetrievalError extends Error {
  readonly _tag = 'LabelRetrievalError';
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'LabelRetrievalError';
    this.cause = cause;
  }
}

export class TopicGenerationError extends Error {
  readonly _tag = 'TopicGenerationError';
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'TopicGenerationError';
    this.cause = cause;
  }
}

export class LabelCreationError extends Error {
  readonly _tag = 'LabelCreationError';
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'LabelCreationError';
    this.cause = cause;
  }
}

export class BroadcastError extends Error {
  readonly _tag = 'BroadcastError';
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'BroadcastError';
    this.cause = cause;
  }
}

// Error types for syncThread
export class ThreadSyncError extends Error {
  readonly _tag = 'ThreadSyncError';
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ThreadSyncError';
    this.cause = cause;
  }
}

export class DriverUnavailableError extends Error {
  readonly _tag = 'DriverUnavailableError';
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'DriverUnavailableError';
    this.cause = cause;
  }
}

export class ThreadDataError extends Error {
  readonly _tag = 'ThreadDataError';
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ThreadDataError';
    this.cause = cause;
  }
}

export class DateNormalizationError extends Error {
  readonly _tag = 'DateNormalizationError';
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'DateNormalizationError';
    this.cause = cause;
  }
}

// Error types for syncThreads
export class FolderSyncError extends Error {
  readonly _tag = 'FolderSyncError';
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'FolderSyncError';
    this.cause = cause;
  }
}

export class ThreadListError extends Error {
  readonly _tag = 'ThreadListError';
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ThreadListError';
    this.cause = cause;
  }
}

export class ConcurrencyError extends Error {
  readonly _tag = 'ConcurrencyError';
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ConcurrencyError';
    this.cause = cause;
  }
}

// Union type for all possible errors
export type TopicGenerationErrors =
  | StorageError
  | LabelRetrievalError
  | TopicGenerationError
  | LabelCreationError
  | BroadcastError;

export type ThreadSyncErrors =
  | ThreadSyncError
  | DriverUnavailableError
  | ThreadDataError
  | DateNormalizationError;

export type FolderSyncErrors =
  | FolderSyncError
  | DriverUnavailableError
  | ThreadListError
  | ConcurrencyError;

// Success cases and result types
export interface TopicGenerationResult {
  topics: UserTopic[];
  cacheHit: boolean;
  cacheAge?: number;
  subjectsAnalyzed: number;
  existingLabelsCount: number;
  labelsCreated: number;
  broadcastSent: boolean;
}

export interface ThreadSyncResult {
  success: boolean;
  threadId: string;
  threadData?: IGetThreadResponse;
  reason?: string;
  normalizedReceivedOn?: string;
  broadcastSent: boolean;
}

export interface FolderSyncResult {
  synced: number;
  message: string;
  folder: string;
  pagesProcessed: number;
  totalThreads: number;
  successfulSyncs: number;
  failedSyncs: number;
  broadcastSent: boolean;
}

export interface CachedTopics {
  topics: UserTopic[];
  timestamp: number;
}

// Requirements interface
export interface TopicGenerationRequirements {
  readonly storage: DurableObjectStorage;
  readonly agent?: DurableObjectStub<ZeroAgent>;
  readonly connectionId: string;
}

export interface ThreadSyncRequirements {
  readonly driver: MailManager;
  readonly agent?: DurableObjectStub<ZeroAgent>;
  readonly connectionId: string;
}

export interface FolderSyncRequirements {
  readonly driver: MailManager;
  readonly agent?: DurableObjectStub<ZeroAgent>;
  readonly connectionId: string;
}

// Constants
export const TOPIC_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
export const TOPIC_CACHE_KEY = 'user_topics';

// Type aliases for better readability
export type TopicGenerationEffect = Effect.Effect<
  TopicGenerationResult,
  TopicGenerationErrors,
  TopicGenerationRequirements
>;
export type TopicGenerationSuccess = TopicGenerationResult;
export type TopicGenerationFailure = TopicGenerationErrors;

export type ThreadSyncEffect = Effect.Effect<
  ThreadSyncResult,
  ThreadSyncErrors,
  ThreadSyncRequirements
>;
export type ThreadSyncSuccess = ThreadSyncResult;
export type ThreadSyncFailure = ThreadSyncErrors;

export type FolderSyncEffect = Effect.Effect<
  FolderSyncResult,
  FolderSyncErrors,
  FolderSyncRequirements
>;
export type FolderSyncSuccess = FolderSyncResult;
export type FolderSyncFailure = FolderSyncErrors;

/** Concurrent AI thread runs per mailbox, and how long one may run before redispatch. */
const AI_RUN_CAPACITY = 4;
const AI_RUN_LEASE_MS = 10 * 60000;

/** IMAP push: one alarm-driven session, IDLE slices within it, and the activity window. */
const IMAP_IDLE_SESSION_MS = 10 * 60_000;
const IMAP_IDLE_SLICE_MS = 2 * 60_000;
const IMAP_IDLE_DEBOUNCE_MS = 300;
const IMAP_ACTIVE_WINDOW_MS = 15 * 60_000;
const IMAP_PRESENCE_TTL_MS = 6 * 60 * 60_000;
const IMAP_PRESENCE_KEY = 'imap_client_presence';
const IMAP_IDLE_UNSUPPORTED_KEY = 'imap_idle_unsupported';
const IMAP_IDLE_BACKOFF_KEY = 'imap_idle_backoff_until';

@Migratable({
  migrations: {
    1: [
      `CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY
      )`,
    ],
    2: [
      `CREATE TABLE IF NOT EXISTS threads (
            id TEXT PRIMARY KEY,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            thread_id TEXT NOT NULL,
            provider_id TEXT NOT NULL,
            latest_sender TEXT,
            latest_received_on TEXT,
            latest_subject TEXT,
            latest_label_ids TEXT,
            categories TEXT
        );`,
    ],
    // Body-free list-row snapshot (see StoredThreadSummary); NULL until the thread is next stored.
    3: [
      `ALTER TABLE threads ADD COLUMN summary_json TEXT`,
      // Lookups by thread_id (getThreadFromDB, list summaries) and the list's ORDER BY.
      `CREATE INDEX IF NOT EXISTS threads_thread_id ON threads(thread_id)`,
      `CREATE INDEX IF NOT EXISTS threads_latest_received_on ON threads(latest_received_on)`,
    ],
  },
})
@Queryable()
export class ZeroDriver extends Agent<ZeroEnv> {
  transfer = new Transfer(this);
  private foldersInSync: Map<string, boolean> = new Map();
  private syncThreadsInProgress: Map<string, boolean> = new Map();
  private driver: MailManager | null = null;
  /** Provider of this mailbox's connection, known once auth is set up. */
  private providerId: EProviders = EProviders.google;
  private agent: DurableObjectStub<ZeroAgent> | null = null;
  private unreadFlushInProgress = false;
  private lastSyncProgress: string | undefined;
  private messageLabelStore: MailLabelStore | undefined;
  private mailboxHistoryStore: MailHistoryStore | undefined;
  private mailboxCountStore: MailCountStore | undefined;
  private mailboxSearchStore: MailSearchStore | undefined;
  private mailboxDraftStore: MailDraftStore | undefined;
  private mailboxContactStore: MailContactStore | undefined;
  private get contactStore() {
    if (this.mailboxContactStore) return this.mailboxContactStore;
    const store = new MailContactStore({
      exec: (query, ...args) => this.ctx.storage.sql.exec(query, ...args),
      transaction: (fn) => this.ctx.storage.transactionSync(fn),
    });
    store.initialize();
    return (this.mailboxContactStore = store);
  }
  private mailboxWork: Promise<void> = Promise.resolve();
  private mailboxCleanupStore: MailCleanupStore | undefined;
  private get cleanupStore() {
    if (this.mailboxCleanupStore) return this.mailboxCleanupStore;
    const store = new MailCleanupStore({
      exec: (query, ...args) => this.ctx.storage.sql.exec(query, ...args),
      transaction: (fn) => this.ctx.storage.transactionSync(fn),
    });
    store.initialize();
    return (this.mailboxCleanupStore = store);
  }
  private get historyStore() {
    if (this.mailboxHistoryStore) return this.mailboxHistoryStore;
    const store = new MailHistoryStore({
      exec: (query, ...args) => this.ctx.storage.sql.exec(query, ...args),
      transaction: (fn) => this.ctx.storage.transactionSync(fn),
    });
    store.initialize();
    this.mailboxHistoryStore = store;
    return store;
  }

  private async withMailboxWork<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.mailboxWork;
    let release!: () => void;
    this.mailboxWork = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }
  private get labelStore() {
    if (this.messageLabelStore) return this.messageLabelStore;
    const store = new MailLabelStore({
      exec: (query, ...args) => this.ctx.storage.sql.exec(query, ...args),
      transaction: (fn) => this.ctx.storage.transactionSync(fn),
    });
    store.initialize();
    this.messageLabelStore = store;
    return store;
  }
  private get countStore() {
    if (this.mailboxCountStore) return this.mailboxCountStore;
    // Coverage checks depend on both durable stores having their tables ready.
    void this.labelStore;
    void this.historyStore;
    const store = new MailCountStore({
      exec: (query, ...args) => this.ctx.storage.sql.exec(query, ...args),
      transaction: (fn) => this.ctx.storage.transactionSync(fn),
    });
    store.initialize();
    this.mailboxCountStore = store;
    return store;
  }
  private get searchStore() {
    if (this.mailboxSearchStore) return this.mailboxSearchStore;
    const store = new MailSearchStore({
      exec: (query, ...args) => this.ctx.storage.sql.exec(query, ...args),
      transaction: (fn) => this.ctx.storage.transactionSync(fn),
    });
    store.initialize();
    this.mailboxSearchStore = store;
    return store;
  }

  private invalidateSearches() {
    if (this.driver?.batchModifyMessageLabels) this.searchStore.invalidate();
  }
  private get draftStore() {
    if (this.mailboxDraftStore) return this.mailboxDraftStore;
    const store = new MailDraftStore({
      exec: (query, ...args) => this.ctx.storage.sql.exec(query, ...args),
      transaction: (fn) => this.ctx.storage.transactionSync(fn),
    });
    store.initialize();
    this.mailboxDraftStore = store;
    return store;
  }

  private invalidateDrafts() {
    if (this.driver?.batchModifyMessageLabels) this.draftStore.invalidate();
  }

  private draftHistoryStamp() {
    const state = this.historyStore.state();
    return JSON.stringify([state.cursor, state.requested, state.snapshot_baseline]);
  }
  constructor(ctx: DurableObjectState, env: ZeroEnv) {
    super(ctx, env);
    ctx.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS mailbox_identity (id INTEGER PRIMARY KEY, name TEXT NOT NULL)',
    );
    if (shouldDropTables) this.dropTables();
  }

  // Agents invokes persisted schedules during construction, before PartyServer's
  // in-memory name is restored by an RPC or websocket request.
  override get name(): string {
    const row = this.ctx.storage.sql
      .exec<{ name: string }>('SELECT name FROM mailbox_identity WHERE id = 1')
      .toArray()[0];
    return row?.name ?? super.name;
  }

  override async setName(name: string) {
    if (!name) throw new Error('A mailbox name is required');
    const existing = this.ctx.storage.sql
      .exec<{ name: string }>('SELECT name FROM mailbox_identity WHERE id = 1')
      .toArray()[0];
    if (existing && existing.name !== name) throw new Error('Mailbox identity cannot change');
    this.ctx.storage.sql.exec('INSERT OR IGNORE INTO mailbox_identity VALUES (1, ?)', name);
    await super.setName(name);
  }

  async onStart() {
    if (this.cleanupStore.state()?.phase !== 'done' && this.cleanupStore.state())
      await this.ensureSpamRecovery();
    if (this.labelStore.nextAttempt() !== undefined) await this.ensureUnreadRecovery();
    if (
      this.name &&
      this.name !== 'general' &&
      !this.name.includes('aggregate') &&
      (await this.ctx.storage.get('mail_history_enabled'))
    ) {
      const offset = [...this.name].reduce(
        (hash, char) => (hash * 31 + char.charCodeAt(0)) % 60000,
        0,
      );
      this.historyStore.staggerRecovery(Date.now(), offset);
      await this.ensureHistoryRecovery();
    }
  }

  private async ensureHistoryRecovery() {
    await this.ctx.storage.put('mail_history_enabled', true);
    if (
      !this.getSchedules().some(
        (schedule) => schedule.callback === 'runMailboxHistory' && schedule.type === 'cron',
      )
    ) {
      await this.schedule('* * * * *', 'runMailboxHistory');
    }
  }

  private async scheduleHistorySoon() {
    await this.scheduleHistoryAt(Date.now() + 2000);
  }

  private async scheduleHistoryAt(time: number) {
    const future = this.getSchedules().filter(
      (schedule) =>
        schedule.callback === 'runMailboxHistory' &&
        schedule.type !== 'cron' &&
        schedule.time * 1000 > Date.now(),
    );
    if (future.some((schedule) => schedule.type !== 'cron' && schedule.time * 1000 <= time + 1000))
      return;
    await this.schedule(new Date(time), 'runMailboxHistory');
    for (const schedule of future) await this.cancelSchedule(schedule.id);
  }

  async signalMailboxHistory() {
    await this.ensureHistoryRecovery();
    this.historyStore.signal(Date.now());
    await this.scheduleHistorySoon();
    return { accepted: true };
  }

  /**
   * Dispatches owed AI thread workflow runs (summary, labels, auto-draft, vectors)
   * for threads that received new mail. Entitlement (Autumn `brain-activity`) is
   * checked by the runner. Runs are leased, not awaited: the workflow calls back into
   * this DO (getThread, label writes) and must not wait on the mailbox work gate. A
   * lost run (eviction, crash) is re-dispatched when its lease expires.
   */
  private dispatchDueAiRuns() {
    const connectionId = this.name;
    const store = this.historyStore;
    for (const run of store.leaseAiRuns(Date.now(), AI_RUN_CAPACITY, AI_RUN_LEASE_MS)) {
      const runner = this.env.WORKFLOW_RUNNER.get(
        this.env.WORKFLOW_RUNNER.idFromName(`${connectionId}:${run.threadId}`),
      );
      void runner
        .runLiveThreadWorkflow(
          { connectionId, threadId: run.threadId, providerId: this.providerId },
          `${connectionId}:${run.threadId}:${run.version}`,
          { skipDraft: run.draftDone },
        )
        .then(
          (result) => {
            if (result.status === 'retry')
              store.failAiRun(run.threadId, run.version, Date.now(), result.draftAttempted);
            else store.completeAiRun(run.threadId, run.version);
          },
          (error: unknown) => {
            console.error('[thread-workflow] run failed', {
              connectionId,
              threadId: run.threadId,
              error: error instanceof Error ? error.message : String(error),
            });
            store.failAiRun(run.threadId, run.version, Date.now(), false);
          },
        )
        .then(() =>
          // IMAP has no history tick to pick up retries or freed capacity.
          this.driver?.syncMailbox ? this.scheduleImapAiDispatchSoon() : this.scheduleHistorySoon(),
        )
        .catch((error: unknown) =>
          console.error('[thread-workflow] settle failed', {
            connectionId,
            threadId: run.threadId,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
    }
  }

  private removeStoredThread(threadId: string) {
    this.historyStore.removeAiRun(threadId);
    this.labelStore.removeThread(threadId);
    this.ctx.storage.sql.exec('DELETE FROM threads WHERE thread_id = ?', threadId);
    this.historyStore.enqueue(threadId, 'delete');
  }

  async mailboxSyncStatus() {
    return this.historyStore.state();
  }

  async syncProgress() {
    if (this.driver?.syncMailbox) return this.imapSyncProgress();
    const state = this.historyStore.state();
    const jobs = this.historyStore.progress();
    const labels = this.labelStore.status();
    const imports = this.historyStore.importProgress();
    return {
      importedThreads: imports.imported,
      spamCleanup: this.cleanupStore.state() ?? null,
      remainingThreads: imports.remaining,
      backfillResumeAt: jobs.backfillResumeAt,
      pendingImports: jobs.jobs.reduce((sum, row) => sum + Number(row.count), 0),
      blockedImports: jobs.jobs
        .filter((row) => row.blocked)
        .reduce((sum, row) => sum + Number(row.count), 0),
      queuedChanges: labels
        .filter((row) => !row.delivered && !row.blocked)
        .reduce((sum, row) => sum + Number(row.count), 0),
      confirmingChanges: labels
        .filter((row) => row.delivered)
        .reduce((sum, row) => sum + Number(row.count), 0),
      blockedChanges: labels
        .filter((row) => row.blocked)
        .reduce((sum, row) => sum + Number(row.count), 0),
      paused: Boolean(state.blocked),
      reason: state.error ? String(state.error) : null,
      retryAt: state.error
        ? Number(state.next_at)
        : Math.max(0, this.labelStore.nextAttempt() ?? 0, jobs.backfillResumeAt),
      reconciling: Boolean(state.snapshot_baseline),
    };
  }

  private async imapSyncProgress() {
    const state = (await this.ctx.storage.get<{
      lastRunAt: number;
      lastError: string | null;
      complete: boolean;
    }>('imap_sync_state')) ?? { lastRunAt: 0, lastError: null, complete: false };
    const remaining = this.driver?.pendingThreadChanges?.(10_000).length ?? 0;
    return {
      importedThreads: await this.getThreadCount(),
      spamCleanup: null,
      remainingThreads: remaining,
      backfillResumeAt: 0,
      pendingImports: remaining,
      blockedImports: 0,
      queuedChanges: 0,
      confirmingChanges: 0,
      blockedChanges: 0,
      paused: false,
      reason: state.lastError,
      retryAt: state.lastError ? state.lastRunAt + 60_000 : 0,
      reconciling: !state.complete,
    };
  }

  private async publishSyncProgress() {
    const progress = await this.syncProgress();
    const digest = JSON.stringify(progress);
    if (digest !== this.lastSyncProgress) {
      await this.agent?.broadcastChatMessage({ type: OutgoingMessageType.Mail_SyncStatus });
      this.lastSyncProgress = digest;
    }
  }

  async retryMailboxSync() {
    await this.driver?.dispose?.();
    this.driver = null;
    await this.setupAuth();
    // setupAuth reassigns the driver; TS still narrows it to null here.
    if ((this.driver as MailManager | null)?.syncMailbox) {
      // New settings or credentials: re-probe IDLE support and clear any push backoff.
      await this.ctx.storage.delete([IMAP_IDLE_UNSUPPORTED_KEY, IMAP_IDLE_BACKOFF_KEY]);
      await this.ensureImapSync();
      await this.scheduleImapSyncSoon(500);
      return;
    }
    this.historyStore.retry();
    this.cleanupStore.retry();
    if (this.cleanupStore.state() && this.cleanupStore.state()!.phase !== 'done')
      await this.ensureSpamRecovery();
    await this.signalMailboxHistory();
  }

  async recoverMailboxSync() {
    // IMAP mailboxes poll on their own alarm; the wakeup only repairs that schedule.
    if (this.driver?.syncMailbox) return this.ensureImapSync();
    // A cron wakeup repairs schedules without advancing notification revisions,
    // resetting retry state, or polling Gmail ahead of its persisted due time.
    await this.ensureHistoryRecovery();
    const state = this.historyStore.state();
    if (!state.blocked) {
      const due = Math.min(
        Number(state.next_at),
        this.historyStore.jobDue() ?? Infinity,
        this.historyStore.aiDue(Date.now(), AI_RUN_CAPACITY) ?? Infinity,
      );
      await this.scheduleHistoryAt(
        Math.max(Date.now() + 1000, this.historyStore.dispatchAfter(), due),
      );
    }
    if (this.labelStore.nextAttempt() !== undefined) await this.ensureUnreadRecovery();
    if (this.cleanupStore.state() && this.cleanupStore.state()!.phase !== 'done')
      await this.ensureSpamRecovery();
  }

  async runMailboxHistory() {
    return withGmailPriority('sync', () =>
      this.withMailboxWork(async () => {
        const store = this.historyStore;
        try {
          if (!store.beginTick(Date.now())) return;
          if (!this.driver) await this.setupAuth();
          if (!this.driver) {
            store.defer(Date.now(), 0, 'reauth_required', true);
            return;
          }
          if (!this.driver?.getMailboxHistoryId || !this.driver.listMailboxThreadIds) return;
          const state = store.state();
          const now = Date.now();
          if (
            !state.blocked &&
            (Number(state.next_at) <= now ||
              (state.snapshot_baseline && !state.error) ||
              (Number(state.requested) > Number(state.processed) && !state.error))
          ) {
            const revision = Number(state.requested);
            try {
              if (!state.cursor && !state.snapshot_baseline) {
                store.beginSnapshot(await this.driver.getMailboxHistoryId());
              }
              const current = store.state();
              if (current.snapshot_baseline) {
                if (current.snapshot_page !== '__complete__') {
                  const page = await withGmailPriority('backfill', () =>
                    this.driver!.listMailboxThreadIds!(
                      current.snapshot_page ? String(current.snapshot_page) : undefined,
                    ),
                  );
                  store.snapshotPage(page.ids, page.nextPageToken);
                }
                if (store.state().snapshot_page === '__complete__') {
                  store.finishSnapshot(now, (id) => store.enqueue(id, 'verify'));
                }
              } else {
                const result = await this.driver.listHistory<gmail_v1.Schema$History>(
                  String(current.cursor),
                );
                const touched = new Set<string>();
                for (const history of result.history) {
                  for (const change of [
                    ...(history.labelsAdded ?? []),
                    ...(history.labelsRemoved ?? []),
                    ...(history.messagesDeleted ?? []),
                  ]) {
                    if (change.message?.threadId)
                      await this.hydrateMessageLabels(change.message.threadId);
                  }
                }
                store.commit(result.historyId, revision, now, () => {
                  if (this.env.DISABLE_WORKFLOWS !== 'true')
                    for (const threadId of selectAiThreads(result.history))
                      store.markAiPending(threadId);
                  for (const history of result.history) {
                    for (const entry of history.messagesAdded ?? []) {
                      if (entry.message?.threadId) store.enqueue(entry.message.threadId);
                    }
                    for (const [changes, addition] of [
                      [history.labelsAdded, true],
                      [history.labelsRemoved, false],
                    ] as const) {
                      for (const change of changes ?? []) {
                        if (!change.message?.id || !change.message.threadId) continue;
                        const id = this.labelStore.applyProviderLabels(
                          change.message.id,
                          addition ? (change.labelIds ?? []) : [],
                          addition ? [] : (change.labelIds ?? []),
                          history.id ?? undefined,
                        );
                        if (id) touched.add(id);
                        else if (!this.labelStore.isDeleted(change.message.id))
                          store.enqueue(change.message.threadId);
                      }
                    }
                    for (const entry of history.messagesDeleted ?? []) {
                      if (!entry.message?.id) continue;
                      const id = this.labelStore.deleteMessage(entry.message.id);
                      if (id) {
                        touched.add(id);
                        store.enqueue(id);
                      } else if (entry.message.threadId)
                        store.enqueue(entry.message.threadId, 'verify');
                    }
                  }
                  for (const id of touched) {
                    const rows = this.ctx.storage.sql
                      .exec(
                        'SELECT message_id FROM mail_message_labels WHERE thread_id = ? LIMIT 1',
                        id,
                      )
                      .toArray();
                    this.refreshThreadLabels(id);
                    if (!rows.length) store.enqueue(id, 'verify');
                    store.notify(id);
                  }
                });
              }
            } catch (error) {
              const original = unwrapGmailError(error);
              const status = Number(
                (original as { code?: number; response?: { status?: number } })?.response?.status ??
                  (original as { code?: number })?.code,
              );
              if (status === 404 || (store.state().snapshot_baseline && status === 400)) {
                store.beginSnapshot(await this.driver.getMailboxHistoryId());
              } else {
                const failure = gmailDeliveryFailure(original, Number(state.attempts));
                store.defer(
                  now,
                  failure.delayMs,
                  failure.reason,
                  failure.blocked,
                  failure.reason !== 'quota_deferred',
                );
                if (failure.reason === 'rate_limited') {
                  store.delayDispatch(now + failure.delayMs);
                  this.labelStore.delayDispatch(now + failure.delayMs);
                }
                console.error('[mailbox-history]', {
                  reason: failure.reason,
                  blocked: failure.blocked,
                });
              }
            }
          }
          for (const notification of store.notifications(Date.now())) {
            try {
              await this.agent?.broadcastChatMessage({
                type: OutgoingMessageType.Mail_Get,
                threadId: String(notification.thread_id),
              });
              store.acknowledgeNotification(
                String(notification.thread_id),
                String(notification.version),
              );
            } catch {
              store.deferNotification(
                String(notification.thread_id),
                String(notification.version),
                Date.now() + 5000,
              );
            }
          }
          const job = store.state().blocked ? undefined : store.job(Date.now());
          if (job) {
            try {
              if (job.kind === 'delete')
                await this.env.THREADS_BUCKET.delete(this.getThreadKey(String(job.thread_id)));
              else if (job.kind === 'notify')
                await this.agent?.broadcastChatMessage({
                  type: OutgoingMessageType.Mail_Get,
                  threadId: String(job.thread_id),
                });
              else {
                const result = await withGmailPriority(
                  job.kind === 'backfill' ? 'backfill' : 'sync',
                  () =>
                    this.importThread({
                      threadId: String(job.thread_id),
                      durable: true,
                    }),
                );
                if (!result.success && result.reason === 'No latest message') {
                  this.ctx.storage.transactionSync(() =>
                    this.removeStoredThread(String(job.thread_id)),
                  );
                } else if (!result.success)
                  throw new Error(result.reason ?? 'Thread import failed');
                else store.markAiReady(String(job.thread_id));
              }
              if (job.kind === 'delete')
                await this.agent?.broadcastChatMessage({
                  type: OutgoingMessageType.Mail_Get,
                  threadId: String(job.thread_id),
                });
              store.acknowledgeJob(String(job.thread_id), String(job.version));
            } catch (error) {
              const original = unwrapGmailError(error);
              const status = Number(
                (original as { code?: number; response?: { status?: number } })?.response?.status ??
                  (original as { code?: number })?.code,
              );
              if (status === 404)
                this.ctx.storage.transactionSync(() =>
                  this.removeStoredThread(String(job.thread_id)),
                );
              else {
                const failure = gmailDeliveryFailure(original, Number(job.attempts));
                store.deferJob(
                  String(job.thread_id),
                  String(job.version),
                  Date.now() + failure.delayMs,
                  failure.blocked,
                  failure.reason !== 'quota_deferred',
                );
                if (failure.reason === 'quota_deferred' && job.kind === 'backfill')
                  store.pauseBackfill(Date.now() + failure.delayMs);
                if (failure.reason === 'rate_limited' || failure.reason === 'reauth_required') {
                  store.defer(Date.now(), failure.delayMs, failure.reason, failure.blocked);
                  store.delayDispatch(Date.now() + failure.delayMs);
                  this.labelStore.delayDispatch(Date.now() + failure.delayMs);
                }
              }
            }
          }
          this.dispatchDueAiRuns();
          if (!store.state().blocked) {
            const pendingCounts = this.countStore.pendingRefresh();
            if (pendingCounts && !pendingCounts.ready && pendingCounts.due <= Date.now()) {
              try {
                await this.count();
              } catch (error) {
                console.warn('[mailbox-counts] deferred refresh failed', unwrapGmailError(error));
              }
            }
            if (this.countStore.pendingRefresh()?.ready && this.agent) {
              try {
                await this.agent.broadcastChatMessage({ type: OutgoingMessageType.Mail_Count });
                this.countStore.acknowledgeRefreshNotification();
              } catch (error) {
                console.warn('[mailbox-counts] notification failed', error);
              }
            }
            await this.renewMailboxWatch();
          }
        } catch (error) {
          console.warn('[mailbox-sync] tick failed', unwrapGmailError(error));
          const failure = gmailDeliveryFailure(error, Number(store.state().attempts));
          store.defer(
            Date.now(),
            failure.delayMs,
            failure.reason,
            failure.blocked,
            failure.reason !== 'quota_deferred',
          );
        } finally {
          const state = store.state();
          await this.publishSyncProgress();
          const pendingCounts = this.countStore.pendingRefresh();
          const due = state.blocked
            ? undefined
            : Math.min(
                store.jobDue() ?? Infinity,
                store.aiDue(Date.now(), AI_RUN_CAPACITY) ?? Infinity,
                pendingCounts
                  ? pendingCounts.ready
                    ? Date.now() + 1000
                    : pendingCounts.due
                  : Infinity,
              );
          const dirty = Number(state.requested) > Number(state.processed);
          const active = Date.now() - Number(state.active_at) < 15 * 60000;
          const pollDelay = active ? 60000 : 15 * 60000;
          const next = state.blocked
            ? Date.now() + pollDelay
            : (state.snapshot_baseline && !state.error) || (dirty && !state.error)
              ? Date.now() + 2000
              : Math.max(Number(state.next_at), Date.now() + (active ? 1000 : pollDelay));
          await this.scheduleHistoryAt(
            Math.max(Date.now() + 1000, store.dispatchAfter(), Math.min(next, due ?? Infinity)),
          );
        }
      }),
    );
  }

  private async renewMailboxWatch() {
    const serviceAccountJson = this.env.GOOGLE_SERVICE_ACCOUNT || this.env.GOOGLE_S_ACCOUNT;
    if (!this.driver?.watchMailbox || !serviceAccountJson || serviceAccountJson === '{}') return;
    const serviceAccount = JSON.parse(serviceAccountJson) as { project_id: string };
    const lastProject = await this.ctx.storage.get<string>('mail_watch_project');
    if (lastProject !== serviceAccount.project_id) {
      await this.ctx.storage.put('mail_watch_project', serviceAccount.project_id);
      await this.ctx.storage.delete('mail_watch_renew_at');
    }
    const nextRenewal = await this.ctx.storage.get<number>('mail_watch_renew_at');
    if (nextRenewal && nextRenewal > Date.now()) return;
    const age = await this.env.gmail_sub_age.get(`${this.name}__google`);
    if (!age && !this.env.GMAIL_PUSH_URL) {
      // Topic/subscription provisioning remains in subscribe_queue.
      await this.ctx.storage.put('mail_watch_renew_at', Date.now() + 3600000);
      return;
    }
    try {
      const result = await this.driver.watchMailbox(
        `projects/${serviceAccount.project_id}/topics/notifications__${this.name}`,
      );
      await this.ctx.storage.put(
        'mail_watch_renew_at',
        Math.min(Date.now() + 86400000, result.expiration - 3600000),
      );
      await this.env.gmail_sub_age.put(`${this.name}__google`, new Date().toISOString());
    } catch {
      await this.ctx.storage.put('mail_watch_renew_at', Date.now() + 3600000);
      console.error('[mailbox-watch] renewal failed', { connectionId: this.name });
    }
  }

  private async ensureUnreadRecovery() {
    if (
      !this.getSchedules().some(
        (schedule) => schedule.callback === 'flushUnreadOutbox' && schedule.type === 'cron',
      )
    ) {
      await this.schedule('* * * * *', 'flushUnreadOutbox');
    }
  }

  getDatabaseSize() {
    return this.ctx.storage.sql.databaseSize;
  }

  getAllSubjects() {
    const subjects = this.sql`
      SELECT latest_subject FROM threads
      WHERE EXISTS (
        SELECT 1 FROM json_each(latest_label_ids) WHERE value = 'INBOX'
      );
    `;
    return subjects.map((row) => row.latest_subject) as string[];
  }

  async getUserTopics(): Promise<UserTopic[]> {
    // Create the Effect with proper types - no external requirements needed
    const topicGenerationEffect = Effect.gen(this, function* () {
      console.log(`[getUserTopics] Starting topic generation for connection: ${this.name}`);

      const result: TopicGenerationResult = {
        topics: [],
        cacheHit: false,
        subjectsAnalyzed: 0,
        existingLabelsCount: 0,
        labelsCreated: 0,
        broadcastSent: false,
      };

      // Check storage first
      const stored = yield* Effect.tryPromise(() => this.ctx.storage.get(TOPIC_CACHE_KEY)).pipe(
        Effect.tap(() =>
          Effect.sync(() => console.log(`[getUserTopics] Checking storage for cached topics`)),
        ),
        Effect.catchAll((error) => {
          console.warn(`[getUserTopics] Failed to get cached topics from storage:`, error);
          return Effect.succeed(null);
        }),
      );

      if (stored) {
        // Type guard to ensure stored is a valid CachedTopics object
        const isValidCachedTopics = (data: unknown): data is CachedTopics => {
          return (
            typeof data === 'object' &&
            data !== null &&
            'topics' in data &&
            'timestamp' in data &&
            Array.isArray(data.topics) &&
            typeof data.timestamp === 'number'
          );
        };

        const cachedTopicsResult = yield* Effect.try({
          try: () => {
            if (!isValidCachedTopics(stored)) {
              throw new Error('Invalid cached data format');
            }
            return stored as CachedTopics;
          },
          catch: (error) => new Error(`Invalid cached data: ${error}`),
        }).pipe(
          Effect.catchAll((error) => {
            console.warn(`[getUserTopics] Invalid cached data, regenerating:`, error);
            return Effect.succeed(null);
          }),
        );

        if (cachedTopicsResult) {
          const cacheAge = Date.now() - cachedTopicsResult.timestamp;

          if (cacheAge < TOPIC_CACHE_TTL) {
            console.log(
              `[getUserTopics] Using cached topics (age: ${Math.round(cacheAge / 1000 / 60)} minutes)`,
            );
            result.topics = cachedTopicsResult.topics;
            result.cacheHit = true;
            result.cacheAge = cacheAge;
            return result;
          } else {
            console.log(
              `[getUserTopics] Cache expired (age: ${Math.round(cacheAge / 1000 / 60)} minutes), regenerating`,
            );
          }
        }
      }

      // Generate new topics
      console.log(`[getUserTopics] Generating new topics`);
      const subjects = this.getAllSubjects();
      result.subjectsAnalyzed = subjects.length;
      console.log(`[getUserTopics] Found ${subjects.length} subjects for analysis`);

      let existingLabels: { name: string; id: string }[] = [];

      const existingLabelsResult = yield* Effect.tryPromise(() => this.getUserLabels()).pipe(
        Effect.tap((labels) =>
          Effect.sync(() => {
            result.existingLabelsCount = labels.length;
            console.log(`[getUserTopics] Retrieved ${labels.length} existing labels`);
          }),
        ),
        Effect.catchAll((error) => {
          console.warn(
            `[getUserTopics] Failed to get existing labels for topic generation:`,
            error,
          );
          return Effect.succeed([]);
        }),
      );

      existingLabels = existingLabelsResult;

      const topics = yield* Effect.tryPromise(() =>
        generateWhatUserCaresAbout(subjects, { existingLabels }),
      ).pipe(
        Effect.tap((topics) =>
          Effect.sync(() => {
            result.topics = topics;
            console.log(
              `[getUserTopics] Generated ${topics.length} topics:`,
              topics.map((t) => t.topic),
            );
          }),
        ),
        Effect.catchAll((error) => {
          console.error(`[getUserTopics] Failed to generate topics:`, error);
          return Effect.succeed([]);
        }),
      );

      if (topics.length > 0) {
        console.log(`[getUserTopics] Processing ${topics.length} topics`);

        // Ensure labels exist in user account
        yield* Effect.tryPromise(async () => {
          try {
            const existingLabelNames = new Set(
              existingLabels.map((label) => label.name.toLowerCase()),
            );
            let createdCount = 0;

            for (const topic of topics) {
              const topicName = topic.topic.toLowerCase();
              if (!existingLabelNames.has(topicName)) {
                console.log(`[getUserTopics] Creating label for topic: ${topic.topic}`);
                // A tag, not a folder: on IMAP this is a keyword, never a new mailbox.
                await this.createLabel({ name: topic.topic }, { kind: 'tag' });
                createdCount++;
              }
            }
            result.labelsCreated = createdCount;
            console.log(`[getUserTopics] Created ${createdCount} new labels`);
          } catch (error) {
            console.error(`[getUserTopics] Failed to ensure topic labels exist:`, error);
            throw error;
          }
        }).pipe(
          Effect.catchAll((error) => {
            console.error(`[getUserTopics] Error creating labels:`, error);
            return Effect.succeed(undefined);
          }),
        );

        // Store the result
        yield* Effect.tryPromise(() =>
          this.ctx.storage.put(TOPIC_CACHE_KEY, {
            topics,
            timestamp: Date.now(),
          }),
        ).pipe(
          Effect.tap(() =>
            Effect.sync(() => console.log(`[getUserTopics] Stored topics in cache`)),
          ),
          Effect.catchAll((error) => {
            console.error(`[getUserTopics] Failed to store topics in cache:`, error);
            return Effect.succeed(undefined);
          }),
        );

        // Broadcast message if agent exists
        if (this.agent) {
          yield* Effect.tryPromise(() =>
            this.agent!.broadcastChatMessage({
              type: OutgoingMessageType.User_Topics,
            }),
          ).pipe(
            Effect.tap(() =>
              Effect.sync(() => {
                result.broadcastSent = true;
                console.log(`[getUserTopics] Broadcasted topics update`);
              }),
            ),
            Effect.catchAll((error) => {
              console.warn(`[getUserTopics] Failed to broadcast topics update:`, error);
              return Effect.succeed(undefined);
            }),
          );
        } else {
          console.log(`[getUserTopics] No agent available for broadcasting`);
        }
      } else {
        console.log(`[getUserTopics] No topics generated`);
      }

      console.log(`[getUserTopics] Completed topic generation for connection: ${this.name}`, {
        topicsCount: result.topics.length,
        cacheHit: result.cacheHit,
        subjectsAnalyzed: result.subjectsAnalyzed,
        existingLabelsCount: result.existingLabelsCount,
        labelsCreated: result.labelsCreated,
        broadcastSent: result.broadcastSent,
      });

      return result;
    });

    // Run the Effect and extract just the topics for backward compatibility
    return Effect.runPromise(
      topicGenerationEffect.pipe(
        Effect.map((result) => result.topics),
        Effect.catchAll((error) => {
          console.error(`[getUserTopics] Critical error in getUserTopics:`, error);
          return Effect.succeed([]);
        }),
      ),
    );
  }

  async setMetaData(connectionId: string) {
    await this.setName(connectionId);
    this.agent ??= await getZeroSocketAgent(connectionId);
    return new DriverRpcDO(this, connectionId);
  }

  async markAsRead(threadIds: string[]) {
    return this.setThreadsUnread(threadIds, false);
  }

  async markAsUnread(threadIds: string[]) {
    return this.setThreadsUnread(threadIds, true);
  }

  async normalizeIds(ids: string[]) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return this.driver.normalizeIds(ids);
  }

  async sendDraft(id: string, data: IOutgoingMessage) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    const result = await this.driver.sendDraft(id, data);
    this.invalidateDrafts();
    this.invalidateSearches();
    await this.afterImapMutation();
    return result;
  }

  async create(data: IOutgoingMessage) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    const result = await this.driver.create(data);
    this.invalidateSearches();
    await this.afterImapMutation();
    return result;
  }

  async delete(id: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    const result = await this.driver.delete(id);
    this.invalidateDrafts();
    this.invalidateSearches();
    await this.afterImapMutation();
    return result;
  }

  async deleteAllSpam() {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    if (!this.driver.batchModifyMessageLabels) {
      const result = await this.driver.deleteAllSpam();
      this.invalidateSearches();
      return result;
    }
    await this.ensureSpamRecovery();
    const job = this.cleanupStore.admit();
    await this.scheduleSpamAt(Date.now() + 1000);
    return {
      success: true,
      message: 'Spam cleanup queued',
      count: Number(job.admitted),
      queued: true,
    };
  }

  private async ensureSpamRecovery() {
    await this.ensureUnreadRecovery();
    await this.ensureHistoryRecovery();
    if (!this.getSchedules().some((s) => s.callback === 'runSpamCleanup' && s.type === 'cron'))
      await this.schedule('* * * * *', 'runSpamCleanup');
  }

  private async scheduleSpamAt(time: number) {
    await scheduleMailContinuation(
      this.getSchedules(),
      'runSpamCleanup',
      time,
      Date.now(),
      (date) => this.schedule(date, 'runSpamCleanup'),
      (id) => this.cancelSchedule(id),
    );
  }

  async runSpamCleanup() {
    return withGmailPriority('sync', () =>
      this.withMailboxWork(async () => {
        const store = this.cleanupStore;
        const state = store.state();
        if (!state || state.phase === 'done' || state.blocked || Number(state.next_at) > Date.now())
          return;
        try {
          if (!this.driver) await this.setupAuth();
          if (!this.driver?.batchModifyMessageLabels) throw new Error('Gmail driver unavailable');
          if (state.phase === 'discover') {
            const page = await this.driver.list({
              folder: 'spam',
              maxResults: 500,
              pageToken: state.page ? String(state.page) : undefined,
            });
            store.page(
              page.threads.map((t) => t.id),
              page.nextPageToken,
            );
          } else {
            const id = store.target();
            if (!id) store.finish();
            else if (store.superseded(id)) store.acknowledge(id, false);
            else {
              // Refresh provider membership before applying a discovered target.
              const imported = await this.importThread({ threadId: id, durable: true });
              if (!imported.success) throw new Error(imported.reason ?? 'Cleanup import failed');
              // Empty-outbox recovery may have been removed during discovery.
              // Install a persisted wakeup before admitting any cleanup intent.
              await this.ensureUnreadRecovery();
              this.ctx.storage.transactionSync(() => {
                const apply =
                  !store.superseded(id) && this.labelStore.threadLabels(id).includes('SPAM');
                if (apply) {
                  this.labelStore.setThreadLabels(
                    [id],
                    ['TRASH'],
                    ['SPAM', 'INBOX'],
                    Date.now(),
                    () => {
                      this.refreshThreadLabels(id);
                      this.historyStore.notify(id);
                    },
                  );
                  this.invalidateSearches();
                }
                store.acknowledge(id, apply);
              });
              await this.schedule(1, 'flushUnreadOutbox');
            }
          }
        } catch (error) {
          const original = unwrapGmailError(error);
          const status = Number(
            (original as { response?: { status?: number }; code?: number })?.response?.status ??
              (original as { code?: number })?.code,
          );
          const id = store.target();
          if (state.phase === 'deliver' && status === 404 && id) store.acknowledge(id, false);
          else {
            const failure = gmailDeliveryFailure(error, Number(state.attempts));
            store.defer(
              Date.now() + failure.delayMs,
              failure.reason,
              failure.blocked,
              failure.reason !== 'quota_deferred',
            );
          }
        } finally {
          const next = store.state();
          if (next?.phase === 'done') {
            for (const s of this.getSchedules())
              if (s.callback === 'runSpamCleanup') await this.cancelSchedule(s.id);
          } else if (next && !next.blocked)
            await this.scheduleSpamAt(Math.max(Date.now() + 1000, Number(next.next_at)));
        }
      }),
    );
  }

  async getEmailAliases() {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.getEmailAliases();
  }

  async searchContacts(query: string, limit = 10) {
    if (!this.driver) throw new Error('No driver available');
    if (!query.trim() || query.length > 200 || !Number.isInteger(limit) || limit < 1 || limit > 20)
      throw new Error('Provide a contact query and a limit between 1 and 20');
    const backfillComplete = this.contactStore.backfill();
    return {
      ...this.contactStore.search(query, limit),
      backfillComplete,
      source: 'known_mailbox_correspondents' as const,
    };
  }

  async getForwardSource(threadId: string, messageId: string) {
    if (!this.driver) throw new Error('No driver available');
    const thread = await this.driver.get(threadId);
    const message = thread.messages.find((item) => item.id === messageId && !item.isDraft);
    if (!message) throw new Error('Forward source message not found');
    const attachments = await this.driver.getMessageAttachments(messageId, {
      fresh: true,
      includeInline: true,
    });
    return { message, attachments };
  }

  async getMessageAttachments(messageId: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.getMessageAttachments(messageId);
  }

  async onConnect() {
    if (!this.driver) await this.setupAuth();
  }

  private authSetup: Promise<void> | undefined;

  public async setupAuth() {
    if (this.authSetup) return this.authSetup;
    this.authSetup = this.initializeAuth();
    try {
      await this.authSetup;
    } finally {
      this.authSetup = undefined;
    }
  }

  private async initializeAuth() {
    if (this.name === 'general') return;
    if (!this.driver) {
      this.agent ??= await getZeroSocketAgent(this.name);
      const { db, conn } = createDb(this.env.HYPERDRIVE.connectionString);
      try {
        const _connection = await db.query.connection.findFirst({
          where: eq(connection.id, this.name),
        });
        if (_connection) {
          if (!isConnectionActive(_connection)) {
            throw Object.assign(new Error('Connection requires reauthorization'), { code: 401 });
          }
          this.providerId = _connection.providerId as EProviders;
          if (_connection.providerId === 'imap') {
            const settings = await db.query.connectionImap.findFirst({
              where: eq(connectionImap.connectionId, _connection.id),
            });
            if (!settings) throw new Error('IMAP connection settings are missing');
            this.driver = connectionToDriver(_connection, {
              imap: imapSettingsFromRow(_connection, settings, (secret) =>
                this.persistImapSecret(secret),
              ),
              storage: this.mailboxStorage,
            });
          } else {
            this.driver = connectionToDriver(_connection);
          }
        }
      } finally {
        this.ctx.waitUntil(conn.end());
      }
      if (this.driver?.syncMailbox) {
        await this.ensureImapSync();
      } else if (this.driver?.getMailboxHistoryId) {
        await this.ensureHistoryRecovery();
        await this.scheduleHistorySoon();
      } else if (this.driver && !(await this.ctx.storage.get('mail_initial_import_scheduled'))) {
        if ((await this.getThreadCount()) === 0) await this.schedule(1, 'syncFolders');
        await this.ctx.storage.put('mail_initial_import_scheduled', true);
      }
    }
  }

  /** The DO's SQLite, in the shape the mailbox stores expect. */
  private get mailboxStorage(): LabelStorage {
    return {
      exec: (query, ...args) => this.ctx.storage.sql.exec(query, ...args),
      transaction: (fn) => this.ctx.storage.transactionSync(fn),
    };
  }

  // ---- IMAP (pull-based) sync ------------------------------------------------------------

  private async persistImapSecret(secret: { ciphertext: string; iv: string; keyVersion: number }) {
    const { db, conn } = createDb(this.env.HYPERDRIVE.connectionString);
    try {
      await db
        .update(connectionImap)
        .set({
          encryptedSecret: secret.ciphertext,
          iv: secret.iv,
          keyVersion: secret.keyVersion,
          updatedAt: new Date(),
        })
        .where(eq(connectionImap.connectionId, this.name));
    } finally {
      this.ctx.waitUntil(conn.end());
    }
  }

  private async ensureImapSync() {
    if (
      !this.getSchedules().some(
        (schedule) => schedule.callback === 'runImapSync' && schedule.type === 'cron',
      )
    ) {
      await this.schedule('* * * * *', 'runImapSync');
    }
    if (!(await this.ctx.storage.get('imap_sync_started'))) {
      await this.ctx.storage.put('imap_sync_started', true);
      await this.scheduleImapSyncSoon(1000);
    }
  }

  private async scheduleImapSyncSoon(delayMs = 3000) {
    const due = Date.now() + delayMs;
    const pending = this.getSchedules().some(
      (schedule) =>
        schedule.callback === 'runImapSync' &&
        schedule.type !== 'cron' &&
        schedule.time * 1000 <= due + 1000,
    );
    if (!pending) await this.schedule(new Date(due), 'runImapSync');
  }

  private imapSyncInFlight = false;
  /** A push arrived while a pass was running; run another right after it. */
  private imapSyncRequested = false;

  /** One bounded IMAP sync pass, then re-imports the threads it changed. */
  async runImapSync() {
    if (this.name === 'general' || this.name.includes('aggregate')) return;
    if (this.imapSyncInFlight) {
      this.imapSyncRequested = true;
      return;
    }
    this.imapSyncInFlight = true;
    this.imapSyncRequested = false;
    try {
      if (!this.driver) await this.setupAuth().catch(() => {});
      const driver = this.driver as MailManager | null;
      if (!driver?.syncMailbox) {
        // Connection deleted or awaiting reconnect: stop polling until it is set up again.
        await this.stopImapSync();
        return;
      }
      let complete = true;
      try {
        const result = await driver.syncMailbox();
        complete = result.complete;
        await this.ctx.storage.put('imap_sync_state', {
          lastRunAt: Date.now(),
          lastError: null,
          complete,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.ctx.storage.put('imap_sync_state', {
          lastRunAt: Date.now(),
          lastError: message,
          complete: false,
        });
        if (message.includes('invalid_grant')) {
          await this.disconnectImap();
          return;
        }
        console.warn('[runImapSync] sync failed', { connectionId: this.name, error: message });
      }
      // Even a failed pass may have indexed some new mail before it stopped.
      this.admitImapAiRuns(driver);
      const remaining = await this.withMailboxWork(() => this.importImapChanges(driver));
      this.dispatchDueAiRuns();
      if (this.imapSyncRequested) await this.scheduleImapSyncSoon(200);
      else if (!complete || remaining) await this.scheduleImapSyncSoon(remaining ? 500 : 3000);
      await this.publishSyncProgress();
      // The minute poll also (re)starts push for users active through the REST API.
      await this.ensureImapIdle();
    } finally {
      this.imapSyncInFlight = false;
    }
  }

  // ---- IMAP push (IDLE), only while the user is active ------------------------------------

  private imapIdleRunning = false;
  private imapIdleAbort: AbortController | null = null;

  /** Browser sockets open on this mailbox's ZeroAgent, reported on connect/close. */
  async setClientPresence(connectionId: string, count: number) {
    await this.setName(connectionId);
    await this.ctx.storage.put(IMAP_PRESENCE_KEY, { count, at: Date.now() });
    if (count > 0) await this.ensureImapIdle();
  }

  /** Active = an app tab is connected, or the mailbox was used in the last 15 minutes. */
  private async isUserActive() {
    const presence = await this.ctx.storage.get<{ count: number; at: number }>(IMAP_PRESENCE_KEY);
    // A count with no update for hours means the agent was evicted without onClose.
    if (presence && presence.count > 0 && Date.now() - presence.at < IMAP_PRESENCE_TTL_MS)
      return true;
    return Date.now() - Number(this.historyStore.state().active_at) < IMAP_ACTIVE_WINDOW_MS;
  }

  /** Starts an IDLE session soon if push is enabled, supported and the user is active. */
  private async ensureImapIdle() {
    if (this.env.IMAP_IDLE_ENABLED === 'false' || this.imapIdleRunning) return;
    if (!this.driver) await this.setupAuth().catch(() => {});
    if (!this.driver?.waitForInboxChange) return;
    if (await this.ctx.storage.get(IMAP_IDLE_UNSUPPORTED_KEY)) return;
    const backoffUntil = (await this.ctx.storage.get<number>(IMAP_IDLE_BACKOFF_KEY)) ?? 0;
    if (backoffUntil > Date.now()) return;
    if (!(await this.isUserActive())) return;
    const pending = this.getSchedules().some(
      (schedule) => schedule.callback === 'runImapIdle' && schedule.type !== 'cron',
    );
    if (!pending) await this.schedule(new Date(Date.now() + 500), 'runImapIdle');
  }

  /**
   * Schedule callback that starts a push session. The session is not awaited: the agents
   * SDK runs schedule callbacks one at a time and arms the next alarm only after they
   * return, so awaiting would stall the minute poll, AI dispatch and the label outbox.
   * The minute poll's alarm keeps the DO resident; if it is evicted anyway, the next poll
   * restarts push (ensureImapIdle).
   */
  async runImapIdle() {
    if (this.name === 'general' || this.name.includes('aggregate')) return;
    if (this.imapIdleRunning || this.env.IMAP_IDLE_ENABLED === 'false') return;
    this.imapIdleRunning = true;
    void this.imapIdleSession().catch((error: unknown) =>
      console.error('[imap-idle] session crashed', {
        connectionId: this.name,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }

  /**
   * One bounded push session: IDLEs on INBOX in short slices, re-checking that the user is
   * still active, and syncs right after every change. Chains another session while the
   * user stays active.
   */
  private async imapIdleSession() {
    const abort = new AbortController();
    this.imapIdleAbort = abort;
    const sessionEnd = Date.now() + IMAP_IDLE_SESSION_MS;
    let failures = 0;
    let stop = false;
    let changes = 0;
    try {
      while (!stop && !abort.signal.aborted && Date.now() < sessionEnd) {
        if (!(await this.isUserActive())) break;
        if (!this.driver) await this.setupAuth().catch(() => {});
        const driver = this.driver as MailManager | null;
        if (!driver?.waitForInboxChange || !driver.syncMailbox) break;
        let outcome: Awaited<ReturnType<NonNullable<MailManager['waitForInboxChange']>>>;
        try {
          outcome = await driver.waitForInboxChange({
            maxMs: Math.min(IMAP_IDLE_SLICE_MS, sessionEnd - Date.now()),
            signal: abort.signal,
          });
          failures = 0;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failures++;
          console.warn('[imap-idle] wait failed', { connectionId: this.name, failures, message });
          if (message.includes('invalid_grant') || failures >= 3) {
            // Back off; the minute poll keeps the mailbox current meanwhile.
            await this.ctx.storage.put(
              IMAP_IDLE_BACKOFF_KEY,
              Date.now() + Math.min(30, 2 ** failures) * 60_000,
            );
            stop = true;
          } else await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** failures));
          continue;
        }
        if (outcome === 'unsupported') {
          await this.ctx.storage.put(IMAP_IDLE_UNSUPPORTED_KEY, true);
          stop = true;
        } else if (outcome === 'aborted') stop = true;
        else if (outcome === 'changed') {
          changes++;
          // Let a burst of untagged updates settle, then sync immediately.
          await new Promise((resolve) => setTimeout(resolve, IMAP_IDLE_DEBOUNCE_MS));
          await this.runImapSync();
        }
      }
    } finally {
      this.imapIdleRunning = false;
      if (this.imapIdleAbort === abort) this.imapIdleAbort = null;
      console.log('[imap-idle] session ended', { connectionId: this.name, changes });
      const resume = !stop && !abort.signal.aborted && (await this.isUserActive());
      if (resume) await this.schedule(new Date(Date.now() + 100), 'runImapIdle');
      else await this.driver?.stopWatching?.().catch(() => {});
    }
  }

  private async stopImapIdle() {
    this.imapIdleAbort?.abort();
    for (const schedule of this.getSchedules())
      if (schedule.callback === 'runImapIdle') await this.cancelSchedule(schedule.id);
    await this.driver?.stopWatching?.().catch(() => {});
  }

  /**
   * Records an owed AI thread workflow run for every thread that received new incoming
   * mail in the last IMAP sync pass: the IMAP counterpart of `selectAiThreads` on a Gmail
   * history delta. The run becomes dispatchable once the thread import lands.
   */
  private admitImapAiRuns(driver: MailManager) {
    const threads = driver.takeNewMailThreads?.() ?? [];
    if (!threads.length || this.env.DISABLE_WORKFLOWS === 'true') return;
    // Same backfill guard as Gmail: a pass this large is a bulk import, not live mail.
    if (threads.length > LIVE_AI_THREAD_LIMIT) return;
    for (const threadId of threads) this.historyStore.markAiPending(threadId);
  }

  /** IMAP mailboxes have no history tick; a settled AI run re-dispatches through this. */
  async runImapAiDispatch() {
    if (!this.driver) await this.setupAuth().catch(() => {});
    if (!this.driver?.syncMailbox) return;
    this.dispatchDueAiRuns();
  }

  private async scheduleImapAiDispatchSoon(delayMs = 2000) {
    const due = Date.now() + delayMs;
    const pending = this.getSchedules().some(
      (schedule) =>
        schedule.callback === 'runImapAiDispatch' &&
        schedule.type !== 'cron' &&
        schedule.time * 1000 <= due + 1000,
    );
    if (!pending) await this.schedule(new Date(due), 'runImapAiDispatch');
  }

  /** Imports up to `limit` changed threads; returns how many are still queued. */
  private async importImapChanges(driver: MailManager, limit = 50) {
    const ids = driver.pendingThreadChanges?.(limit) ?? [];
    const done: string[] = [];
    let broadcast = false;
    for (const threadId of ids) {
      try {
        const result = await this.importThread({ threadId });
        if (result.success) {
          const present = new Set(result.threadData?.messages.map((message) => message.id) ?? []);
          // IMAP threads can lose messages (moved out by a merge, expunged); drop stale rows.
          for (const row of this.ctx.storage.sql
            .exec<{
              message_id: string;
            }>('SELECT message_id FROM mail_message_labels WHERE thread_id = ?', threadId)
            .toArray())
            if (!present.has(row.message_id))
              this.ctx.storage.sql.exec(
                'DELETE FROM mail_message_labels WHERE message_id = ?',
                row.message_id,
              );
          this.refreshThreadLabels(threadId);
          this.historyStore.markAiReady(threadId);
          done.push(threadId);
          broadcast = true;
        } else if (result.reason === 'No latest message') {
          await this.removeImapThread(threadId);
          done.push(threadId);
          broadcast = true;
        }
      } catch (error) {
        console.warn('[importImapChanges] import failed', { threadId, error: String(error) });
      }
    }
    driver.acknowledgeThreadChanges?.(done);
    if (broadcast)
      await this.agent?.broadcastChatMessage({
        type: OutgoingMessageType.Mail_List,
        folder: 'inbox',
      });
    return driver.pendingThreadChanges?.(1).length ?? 0;
  }

  private async removeImapThread(threadId: string) {
    this.historyStore.removeAiRun(threadId);
    this.ctx.storage.sql.exec('DELETE FROM threads WHERE thread_id = ?', threadId);
    this.ctx.storage.sql.exec('DELETE FROM mail_message_labels WHERE thread_id = ?', threadId);
    this.labelStore.removeSyntheticThreadLabels(threadId);
    await this.env.THREADS_BUCKET.delete(this.getThreadKey(threadId)).catch(() => {});
  }

  /** Credentials were rejected: mark the connection for reconnect and stop polling. */
  private async disconnectImap() {
    const { db, conn } = createDb(this.env.HYPERDRIVE.connectionString);
    try {
      await db
        .update(connection)
        .set({ ...disconnectedTokens, updatedAt: new Date() })
        .where(eq(connection.id, this.name));
      await db
        .update(connectionImap)
        .set({ status: 'auth_failed', updatedAt: new Date() })
        .where(eq(connectionImap.connectionId, this.name));
    } finally {
      this.ctx.waitUntil(conn.end());
    }
    await this.stopImapSync();
    await this.driver?.dispose?.();
    this.driver = null;
  }

  private async stopImapSync() {
    await this.stopImapIdle();
    for (const schedule of this.getSchedules())
      if (schedule.callback === 'runImapSync') await this.cancelSchedule(schedule.id);
    await this.ctx.storage.delete('imap_sync_started');
  }

  /** After a local mutation, re-sync soon so the imported threads reflect the server. */
  private async afterImapMutation() {
    if (this.driver?.syncMailbox) await this.scheduleImapSyncSoon(1500);
  }

  async syncFolders() {
    if (this.name === 'general') return;
    // Skip sync for aggregate instances - they should only mirror primary operations
    // The multi-stub pattern ensures aggregate gets operations in background
    if (this.name.includes('aggregate')) {
      console.log('[syncFolders] Skipping sync for aggregate instance');
      return;
    }

    const threadCount = await this.getThreadCount();
    if (threadCount < maxCount) {
      console.log(
        `[syncFolders] Starting folder sync for ${this.name} (threadCount: ${threadCount})`,
      );
      this.ctx.waitUntil(this.syncThreads('inbox'));
      this.ctx.waitUntil(this.syncThreads('sent'));
      this.ctx.waitUntil(this.syncThreads('spam'));
    } else {
      console.log(
        `[syncFolders] Skipping sync for ${this.name} - threadCount (${threadCount}) >= maxCount (${maxCount})`,
      );
    }
  }

  async rawListThreads(params: {
    folder: string;
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string;
  }): Promise<IGetThreadsResponse> {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    if (!params.query?.trim() || !this.driver.batchModifyMessageLabels)
      return this.driver.list(params);
    this.historyStore.activate(Date.now());
    const state = this.historyStore.state();
    const response = await this.searchStore.read(
      params,
      Date.now(),
      JSON.stringify([state.cursor, state.requested, state.snapshot_baseline]),
      (search) => this.driver!.list(search),
    );
    return this.overlayPendingLabels(params.query, response);
  }

  /**
   * Provider search lags queued label writes (outbox dispatch + Gmail indexing),
   * so e.g. a thread just marked read would keep matching `is:unread`. Drop
   * threads whose locally pending labels make the query definitely false.
   */
  private overlayPendingLabels(query: string, response: IGetThreadsResponse) {
    const matches = compileLabelMatcher(query);
    if (!matches || !response.threads.length) return response;
    const pending = this.labelStore.pendingThreadMessageLabels(
      response.threads.map((thread) => thread.id),
    );
    if (!pending.size) return response;
    return {
      ...response,
      threads: response.threads.filter((thread) => {
        const messages = pending.get(thread.id);
        return !messages || matches(messages);
      }),
    };
  }

  async getThread(threadId: string, includeDrafts: boolean = false) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.getThreadFromDB(threadId, includeDrafts);
  }

  /**
   * Body-free row data for a page of list results, read in one RPC. A thread that fails or
   * isn't imported yet maps to null and the client fetches it individually instead.
   */
  async getThreadListSummaries(threadIds: string[]): Promise<(ThreadListSummary | null)[]> {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    if (!threadIds.length) return [];
    this.historyStore.activate(Date.now());

    // One indexed read for the page; only threads the snapshot can't answer touch R2.
    const placeholders = threadIds.map(() => '?').join(',');
    const stored = new Map<string, StoredThreadSummary>();
    for (const row of this.ctx.storage.sql.exec<{ thread_id: string; summary_json: string | null }>(
      `SELECT thread_id, summary_json FROM threads WHERE thread_id IN (${placeholders})`,
      ...threadIds,
    )) {
      const summary = parseStoredThreadSummary(row.summary_json);
      if (summary) stored.set(String(row.thread_id), summary);
    }

    return await Promise.all(
      threadIds.map(async (id) => {
        try {
          const snapshot = stored.get(id);
          if (snapshot) {
            const resolved = resolveStoredThreadSummary(id, snapshot, this.labelStore);
            if (resolved.kind === 'summary') return resolved.summary;
            if (resolved.kind === 'empty') return null;
          }
          // No snapshot yet (stored before the column existed) or it can't answer exactly.
          const thread = await this.getThreadFromDB(id, true);
          if (!snapshot && thread.messages.length) this.backfillStoredSummary(id, thread);
          return toThreadListSummary(thread);
        } catch (error) {
          console.warn('[getThreadListSummaries] Failed for', id, error);
          return null;
        }
      }),
    );
  }

  /**
   * Lazily fills summary_json for threads stored before it existed. `thread` came from the
   * stored R2 JSON, so the snapshot matches what syncThread would have written; deleted
   * messages are already filtered out, which only makes the snapshot more conservative.
   */
  private backfillStoredSummary(threadId: string, thread: IGetThreadResponse) {
    const json = storedSummaryJson(thread);
    if (!json) return;
    this.ctx.storage.sql.exec(
      'UPDATE threads SET summary_json = ? WHERE thread_id = ? AND summary_json IS NULL',
      json,
      threadId,
    );
  }

  //   async markThreadsRead(threadIds: string[]) {
  //     if (!this.driver) {
  //       throw new Error('No driver available');
  //     }
  //     return await this.driver.modifyLabels(threadIds, {
  //       addLabels: [],
  //       removeLabels: ['UNREAD'],
  //     });
  //   }

  //   async markThreadsUnread(threadIds: string[]) {
  //     if (!this.driver) {
  //       throw new Error('No driver available');
  //     }
  //     return await this.driver.modifyLabels(threadIds, {
  //       addLabels: ['UNREAD'],
  //       removeLabels: [],
  //     });
  //   }

  async modifyLabels(threadIds: string[], addLabelIds: string[], removeLabelIds: string[]) {
    const { providerAdd, providerRemove, syntheticAdd, syntheticRemove } = splitLabelMutation(
      addLabelIds,
      removeLabelIds,
    );
    if (isDurableLabelMutation(providerAdd, providerRemove)) {
      return this.setThreadLabels(
        threadIds,
        providerAdd,
        providerRemove,
        syntheticAdd,
        syntheticRemove,
      );
    }
    if (!providerAdd.length && !providerRemove.length) {
      return Promise.all(
        threadIds.map((id) => this.modifyThreadLabelsInDB(id, syntheticAdd, syntheticRemove)),
      );
    }
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.modifyLabels(threadIds, {
      addLabels: providerAdd,
      removeLabels: providerRemove,
    });
  }

  async listHistory<T>(historyId: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    const result = await this.driver.listHistory<T>(historyId);
    for (const history of result.history as gmail_v1.Schema$History[]) {
      for (const [changes, addition] of [
        [history.labelsAdded, true],
        [history.labelsRemoved, false],
      ] as const) {
        for (const change of changes ?? []) {
          if (!change.message?.id || !change.message.threadId) continue;
          await this.hydrateMessageLabels(change.message.threadId);
          const threadId = this.labelStore.applyProviderLabels(
            change.message.id,
            addition ? (change.labelIds ?? []) : [],
            addition ? [] : (change.labelIds ?? []),
          );
          if (threadId) this.refreshThreadLabels(threadId);
        }
      }
    }
    return result;
  }

  private refreshThreadLabels(threadId: string) {
    void this
      .sql`UPDATE threads SET latest_label_ids = ${JSON.stringify(this.labelStore.threadLabels(threadId))},
      updated_at = CURRENT_TIMESTAMP WHERE thread_id = ${threadId}`;
  }

  private async hydrateMessageLabels(threadId: string) {
    const store = this.labelStore;
    if (store.isThreadDeleted(threadId)) return;
    const stored = this.ctx.storage.sql
      .exec('SELECT message_id FROM mail_message_labels WHERE thread_id = ? LIMIT 1', threadId)
      .toArray();
    if (stored.length) return;
    const body = await this.env.THREADS_BUCKET.get(this.getThreadKey(threadId));
    if (!body) return;
    const thread = JSON.parse(await body.text()) as IGetThreadResponse;
    store.importMessages(
      threadId,
      thread.messages.map((message) => ({
        id: message.id,
        labels: message.tags.map((tag) => tag.id),
      })),
      thread.providerHistoryId,
    );
  }

  async setThreadsUnread(threadIds: string[], unread: boolean) {
    return this.setThreadLabels(threadIds, unread ? ['UNREAD'] : [], unread ? [] : ['UNREAD']);
  }

  async setThreadsStarred(threadIds: string[], starred?: boolean) {
    const ids = [...new Set(threadIds)];
    if (!ids.length) return { success: false, starred: false };
    for (const id of ids) await this.ensureMutationLabels(id);
    const desired =
      starred ?? !ids.some((id) => this.labelStore.threadLabels(id).includes('STARRED'));
    await this.setThreadLabels(ids, desired ? ['STARRED'] : [], desired ? [] : ['STARRED']);
    return { success: true, starred: desired };
  }

  async setThreadsImportant(threadIds: string[], important?: boolean) {
    const ids = [...new Set(threadIds)];
    if (!ids.length) return { success: false, important: false };
    for (const id of ids) await this.ensureMutationLabels(id);
    const desired =
      important ?? !ids.some((id) => this.labelStore.threadLabels(id).includes('IMPORTANT'));
    await this.setThreadLabels(ids, desired ? ['IMPORTANT'] : [], desired ? [] : ['IMPORTANT']);
    return { success: true, important: desired };
  }

  private async ensureMutationLabels(threadId: string) {
    await this.hydrateMessageLabels(threadId);
    const stored = this.ctx.storage.sql
      .exec('SELECT message_id FROM mail_message_labels WHERE thread_id = ? LIMIT 1', threadId)
      .toArray();
    if (stored.length) return;
    const result = await this.syncThread({ threadId, durable: true });
    if (!result.success) throw new Error(result.reason ?? `Could not load thread ${threadId}`);
  }

  async setThreadLabels(
    threadIds: string[],
    addLabels: string[],
    removeLabels: string[],
    syntheticAdd: string[] = [],
    syntheticRemove: string[] = [],
  ) {
    ({ addLabels, removeLabels } = normalizeDurableLabelMutation(addLabels, removeLabels));
    const ids = [...new Set(threadIds)];
    if (!ids.length) return [];
    this.historyStore.activate(Date.now());
    if (!this.driver) await this.setupAuth();
    if (!this.driver?.batchModifyMessageLabels) {
      if (!this.driver) throw new Error('No driver available');
      await this.driver.modifyLabels(ids, { addLabels, removeLabels });
      await this.afterImapMutation();
      for (const threadId of ids) {
        await this.hydrateMessageLabels(threadId);
        for (const row of this.ctx.storage.sql.exec(
          'SELECT message_id FROM mail_message_labels WHERE thread_id = ?',
          threadId,
        )) {
          this.labelStore.applyProviderLabels(String(row.message_id), addLabels, removeLabels);
        }
      }
      return Promise.all(
        ids.map((id) =>
          this.modifyThreadLabelsInDB(
            id,
            [...addLabels, ...syntheticAdd],
            [...removeLabels, ...syntheticRemove],
          ),
        ),
      );
    }
    const store = this.labelStore;
    for (const threadId of ids) {
      await this.ensureMutationLabels(threadId);
    }
    await this.ensureUnreadRecovery();
    await this.ensureHistoryRecovery();
    store.setThreadLabels(ids, addLabels, removeLabels, Date.now(), () => {
      if (
        [...addLabels, ...removeLabels].some((label) => ['INBOX', 'SPAM', 'TRASH'].includes(label))
      )
        this.cleanupStore.recordMove(ids);
      for (const threadId of ids) {
        if (syntheticAdd.length || syntheticRemove.length)
          store.setSyntheticThreadLabels(threadId, syntheticAdd, syntheticRemove);
        this.refreshThreadLabels(threadId);
        this.historyStore.notify(threadId);
      }
    });
    this.invalidateSearches();
    await this.schedule(1, 'flushUnreadOutbox');
    await this.scheduleHistorySoon();
    return ids.map((threadId) => ({ success: true, threadId, queued: true }));
  }

  async labelSyncStatus() {
    return this.labelStore.status();
  }
  async retryLabelSync() {
    return this.retryUnreadSync();
  }

  async unreadSyncStatus() {
    return this.labelStore.status();
  }

  async retryUnreadSync() {
    this.driver = null;
    await this.setupAuth();
    this.labelStore.retryBlocked(Date.now());
    await this.ensureUnreadRecovery();
    await this.schedule(1, 'flushUnreadOutbox');
  }

  async flushUnreadOutbox() {
    return withGmailPriority('foreground', () =>
      this.withMailboxWork(() => this.deliverUnreadOutbox()),
    );
  }

  private async deliverUnreadOutbox() {
    if (this.unreadFlushInProgress) return;
    this.unreadFlushInProgress = true;
    const store = this.labelStore;
    try {
      const batch = store.pendingBatches(Date.now())[0];
      if (!batch) return;
      store.delayDispatch(Date.now() + 1000);
      try {
        if (!this.driver) await this.setupAuth();
        if (!this.driver?.batchModifyMessageLabels) throw new Error('Gmail driver unavailable');
        if (
          !this.historyStore.state().cursor &&
          !this.historyStore.state().snapshot_baseline &&
          this.driver.getMailboxHistoryId
        ) {
          this.historyStore.beginSnapshot(await this.driver.getMailboxHistoryId());
        }
        await Effect.runPromise(
          Effect.tryPromise({
            try: () =>
              this.driver!.batchModifyMessageLabels!(
                batch.ids,
                batch.addLabelIds,
                batch.removeLabelIds,
              ),
            catch: (error) => error,
          }),
        );
        store.acknowledge(batch);
        this.invalidateSearches();
        await this.signalMailboxHistory();
      } catch (error) {
        const failure = gmailDeliveryFailure(
          error,
          Math.max(...batch.operations.map((op) => op.attempts)),
        );
        store.defer(
          batch,
          Date.now() + failure.delayMs,
          failure.reason,
          failure.blocked,
          failure.reason !== 'quota_deferred',
        );
        if (failure.reason === 'rate_limited') store.delayDispatch(Date.now() + failure.delayMs);
        if (failure.reason === 'rate_limited')
          this.historyStore.delayDispatch(Date.now() + failure.delayMs);
        console.error('[label-outbox]', {
          reason: failure.reason,
          blocked: failure.blocked,
          count: batch.ids.length,
        });
      }
    } finally {
      this.unreadFlushInProgress = false;
      try {
        try {
          await this.publishSyncProgress();
        } catch (error) {
          console.warn('[label-outbox] progress broadcast failed', error);
        }
      } catch (error) {
        console.warn('[mailbox-sync] progress broadcast failed', error);
      }
      const due = store.nextAttempt();
      if (due !== undefined)
        await this.schedule(new Date(Math.max(due, Date.now() + 1000)), 'flushUnreadOutbox');
      else {
        for (const schedule of this.getSchedules()) {
          if (schedule.callback === 'flushUnreadOutbox' && schedule.type === 'cron')
            await this.cancelSchedule(schedule.id);
        }
      }
    }
  }

  async getUserLabels() {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    const labels = await this.driver.getUserLabels();
    if (this.driver.batchModifyMessageLabels) this.countStore.saveCatalogue(labels, Date.now());
    return labels;
  }

  async getLabel(id: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.getLabel(id);
  }

  async createLabel(
    params: {
      name: string;
      color?: {
        backgroundColor: string;
        textColor: string;
      };
    },
    options?: { kind?: 'tag' | 'folder' },
  ) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    const result = await this.driver.createLabel(params, options);
    this.invalidateSearches();
    if (this.driver.batchModifyMessageLabels) this.countStore.invalidate();
    return result;
  }

  async bulkDelete(threadIds: string[]) {
    return this.setThreadLabels(threadIds, ['TRASH'], ['INBOX']);
  }

  async bulkArchive(threadIds: string[]) {
    return this.setThreadLabels(threadIds, [], ['INBOX']);
  }

  async updateLabel(
    id: string,
    label: { name: string; color?: { backgroundColor: string; textColor: string } },
  ) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    const result = await this.driver.updateLabel(id, label);
    this.invalidateSearches();
    if (this.driver.batchModifyMessageLabels) this.countStore.invalidate();
    return result;
  }

  async deleteLabel(id: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    const result = await this.driver.deleteLabel(id);
    this.labelStore.forgetAppLabel(id);
    this.invalidateSearches();
    if (this.driver.batchModifyMessageLabels) this.countStore.invalidate();
    return result;
  }

  async createDraft(draftData: CreateDraftData) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    const result = await this.driver.createDraft(draftData);
    this.invalidateDrafts();
    this.invalidateSearches();
    await this.afterImapMutation();
    return result;
  }

  async listThreadDrafts(threadId: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.listThreadDrafts(threadId);
  }

  async deleteDraft(id: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    await this.driver.deleteDraft(id);
    this.invalidateDrafts();
    this.invalidateSearches();
    await this.afterImapMutation();
  }

  async getDraft(id: string, options?: { fresh?: boolean }) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    if (options?.fresh) return this.driver.getDraft(id, { includeInline: true });
    if (!this.driver.batchModifyMessageLabels) return this.driver.getDraft(id);
    return this.draftStore.get(id, Date.now(), this.draftHistoryStamp(), () =>
      this.driver!.getDraft(id),
    );
  }

  async listDrafts(params: { q?: string; maxResults?: number; pageToken?: string }) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    if (!this.driver.batchModifyMessageLabels) return this.driver.listDrafts(params);
    return this.draftStore.list(params, Date.now(), this.draftHistoryStamp(), (drafts) =>
      this.driver!.listDrafts(drafts),
    );
  }

  // Additional mail operations
  async count() {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    if (!this.driver.batchModifyMessageLabels) return this.driver.count();
    const counts = await this.countStore.read(
      Date.now(),
      this.historyStore.state().cursor ? String(this.historyStore.state().cursor) : null,
      async () =>
        (await this.driver!.count()).map((row) => ({
          labelId: row.labelId,
          label: row.label ?? '',
          count: row.count ?? NaN,
        })),
      () => this.driver!.getUserLabels(),
    );
    const pending = this.countStore.pendingRefresh();
    if (pending) {
      await this.ensureHistoryRecovery();
      await this.scheduleHistoryAt(Math.max(Date.now() + 1000, pending.ready ? 0 : pending.due));
    }
    return counts;
  }

  private async listWithRetry(params: Parameters<MailManager['list']>[0]) {
    if (!this.driver) throw new Error('No driver available');

    return Effect.runPromise(withRetry(Effect.tryPromise(() => this.driver!.list(params))));
  }

  private async getWithRetry(threadId: string): Promise<IGetThreadResponse> {
    if (!this.driver) throw new Error('No driver available');

    return Effect.runPromise(withRetry(Effect.tryPromise(() => this.driver!.get(threadId))));
  }

  private getThreadKey(threadId: string) {
    return `${this.name}/${threadId}.json`;
  }

  async *streamThreads(folder: string) {
    let pageToken: string | null = null;
    let hasMore = true;

    while (hasMore) {
      // Rate limiting delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const result = await this.listWithRetry({
        folder,
        maxResults: maxCount, // Smaller batches for streaming
        pageToken: pageToken || undefined,
      });

      // Stream each thread individually
      for (const thread of result.threads) {
        yield thread;
      }

      pageToken = result.nextPageToken;
      hasMore = pageToken !== null && shouldLoop;
    }
  }

  async dropTables() {
    console.log('Dropping tables');
    return this.sql`
        DROP TABLE IF EXISTS threads;`;
  }

  async deleteThread(id: string) {
    void this.sql`
      DELETE FROM threads WHERE thread_id = ${id};
    `;
    this.agent?.broadcastChatMessage({
      type: OutgoingMessageType.Mail_List,
      folder: 'bin',
    });
  }

  async reloadFolder(folder: string) {
    this.agent?.broadcastChatMessage({
      type: OutgoingMessageType.Mail_List,
      folder,
    });
  }

  async syncThread(params: { threadId: string; durable?: boolean }): Promise<ThreadSyncResult> {
    return this.withMailboxWork(() => this.importThread(params));
  }

  private async importThread({
    threadId,
    durable = false,
  }: {
    threadId: string;
    durable?: boolean;
  }): Promise<ThreadSyncResult> {
    if (this.name === 'general' || this.name.includes('aggregate')) {
      console.log(`[syncThread] Skipping sync for ${this.name} instance - thread ${threadId}`);
      return { success: true, threadId, broadcastSent: false };
    }

    if (this.syncThreadsInProgress.has(threadId)) {
      console.log(`[syncThread] Sync already in progress for thread ${threadId}, skipping...`);
      return { success: true, threadId, broadcastSent: false };
    }

    return Effect.runPromise(
      Effect.gen(this, function* () {
        console.log(`[syncThread] Starting sync for thread: ${threadId}`);

        const result: ThreadSyncResult = {
          success: false,
          threadId,
          broadcastSent: false,
        };

        // Setup driver if needed
        if (!this.driver) {
          yield* Effect.tryPromise(() => this.setupAuth()).pipe(
            Effect.tap(() => Effect.sync(() => console.log(`[syncThread] Setup auth completed`))),
            Effect.catchAll((error) => {
              console.error(`[syncThread] Failed to setup auth:`, error);
              return Effect.succeed(undefined);
            }),
          );
        }

        if (!this.driver) {
          console.error(`[syncThread] No driver available for thread ${threadId}`);
          result.success = false;
          result.reason = 'No driver available';
          return result;
        }

        this.syncThreadsInProgress.set(threadId, true);

        // Get thread data with retry
        const threadData = yield* Effect.tryPromise(() =>
          durable ? this.driver!.get(threadId) : this.getWithRetry(threadId),
        ).pipe(
          Effect.tap(() =>
            Effect.sync(() => console.log(`[syncThread] Retrieved thread data for ${threadId}`)),
          ),
          Effect.catchAll((error) => {
            console.error(`[syncThread] Failed to get thread data for ${threadId}:`, error);
            return Effect.fail(
              new ThreadDataError(`Failed to get thread data for ${threadId}`, error),
            );
          }),
        );

        const latest = threadData.latest ?? threadData.messages.at(-1);

        if (!latest) {
          this.syncThreadsInProgress.delete(threadId);
          console.log(`[syncThread] Skipping thread ${threadId} - no latest message`);
          result.success = false;
          result.reason = 'No latest message';
          return result;
        }

        // Normalize received date
        const normalizedReceivedOn = yield* Effect.try({
          try: () => new Date(latest.receivedOn).toISOString(),
          catch: (error) =>
            new DateNormalizationError(`Failed to normalize date for ${threadId}`, error),
        }).pipe(
          Effect.catchAll((error) => {
            console.warn(
              `[syncThread] Date normalization failed for ${threadId}, using current date:`,
              error,
            );
            return Effect.succeed(new Date().toISOString());
          }),
        );

        result.normalizedReceivedOn = normalizedReceivedOn;
        this.labelStore.importMessages(
          threadId,
          threadData.messages.map((message) => ({
            id: message.id,
            labels: message.tags.map((tag) => tag.id),
          })),
          threadData.providerHistoryId,
          true,
        );

        // Store thread data in bucket
        yield* Effect.tryPromise(() =>
          this.env.THREADS_BUCKET.put(this.getThreadKey(threadId), JSON.stringify(threadData), {
            customMetadata: { threadId },
          }),
        ).pipe(
          Effect.tap(() =>
            Effect.sync(() =>
              console.log(`[syncThread] Stored thread data in bucket for ${threadId}`),
            ),
          ),
          Effect.catchAll((error) => {
            console.error(
              `[syncThread] Failed to store thread data in bucket for ${threadId}:`,
              error,
            );
            return durable ? Effect.fail(error) : Effect.succeed(undefined);
          }),
        );

        // Update database
        yield* Effect.tryPromise(() =>
          Promise.resolve(this.sql`
          INSERT OR REPLACE INTO threads (
            id,
            thread_id,
            provider_id,
            latest_sender,
            latest_received_on,
            latest_subject,
            latest_label_ids,
            summary_json,
            updated_at
          ) VALUES (
            ${threadId},
            ${threadId},
            ${this.providerId},
            ${JSON.stringify(latest.sender)},
            ${normalizedReceivedOn},
            ${latest.subject},
            ${JSON.stringify(this.labelStore.threadLabels(threadId))},
            ${storedSummaryJson(threadData)},
            CURRENT_TIMESTAMP
          )
        `),
        ).pipe(
          Effect.tap(() =>
            Effect.sync(() => console.log(`[syncThread] Updated database for ${threadId}`)),
          ),
          Effect.catchAll((error) => {
            console.error(`[syncThread] Failed to update database for ${threadId}:`, error);
            return durable ? Effect.fail(error) : Effect.succeed(undefined);
          }),
        );

        // Broadcast update if agent exists
        this.contactStore.observe(threadData.messages.filter((message) => !message.isDraft));
        if (this.agent) {
          yield* Effect.tryPromise(() =>
            this.agent!.broadcastChatMessage({
              type: OutgoingMessageType.Mail_Get,
              threadId,
            }),
          ).pipe(
            Effect.tap(() =>
              Effect.sync(() => {
                result.broadcastSent = true;
                console.log(`[syncThread] Broadcasted update for ${threadId}`);
              }),
            ),
            Effect.catchAll((error) => {
              console.warn(`[syncThread] Failed to broadcast update for ${threadId}:`, error);
              return Effect.succeed(undefined);
            }),
          );
        } else {
          console.log(`[syncThread] No agent available for broadcasting ${threadId}`);
        }

        this.syncThreadsInProgress.delete(threadId);

        result.success = true;
        result.threadData = threadData;

        console.log(`[syncThread] Completed sync for thread: ${threadId}`, {
          success: result.success,
          broadcastSent: result.broadcastSent,
          hasLatestMessage: !!latest,
        });

        return result;
      }).pipe(
        Effect.catchAll((error) => {
          this.syncThreadsInProgress.delete(threadId);
          if (durable) return Effect.fail(error.cause ?? error);
          console.error(`[syncThread] Critical error syncing thread ${threadId}:`, error);
          return Effect.succeed({
            success: false,
            threadId,
            reason: error.message,
            broadcastSent: false,
          });
        }),
      ),
    );
  }

  async getThreadCount() {
    const count = this.sql`SELECT COUNT(*) FROM threads`;
    return count[0]['COUNT(*)'] as number;
  }

  async getFolderThreadCount(folder: string) {
    const count = this.sql`SELECT COUNT(*) FROM threads WHERE EXISTS (
      SELECT 1 FROM json_each(latest_label_ids) WHERE value = ${folder}
    )`;
    return count[0]['COUNT(*)'] as number;
  }

  async syncThreads(folder: string): Promise<FolderSyncResult> {
    // Skip sync for aggregate instances - they should only mirror primary operations
    if (this.name.includes('aggregate')) {
      console.log(`[syncThreads] Skipping sync for aggregate instance - folder ${folder}`);
      return {
        synced: 0,
        message: 'Skipped aggregate instance',
        folder,
        pagesProcessed: 0,
        totalThreads: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        broadcastSent: false,
      };
    }

    if (!this.driver) {
      console.error(`[syncThreads] No driver available for folder ${folder}`);
      return {
        synced: 0,
        message: 'No driver available',
        folder,
        pagesProcessed: 0,
        totalThreads: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        broadcastSent: false,
      };
    }

    if (this.foldersInSync.has(folder)) {
      console.log(`[syncThreads] Sync already in progress for folder ${folder}, skipping...`);
      return {
        synced: 0,
        message: 'Sync already in progress',
        folder,
        pagesProcessed: 0,
        totalThreads: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        broadcastSent: false,
      };
    }

    return Effect.runPromise(
      Effect.gen(this, function* () {
        console.log(`[syncThreads] Starting sync for folder: ${folder}`);

        const result: FolderSyncResult = {
          synced: 0,
          message: 'Sync completed',
          folder,
          pagesProcessed: 0,
          totalThreads: 0,
          successfulSyncs: 0,
          failedSyncs: 0,
          broadcastSent: false,
        };

        // Check thread count
        const threadCount = yield* Effect.tryPromise(() => this.getThreadCount()).pipe(
          Effect.tap((count) =>
            Effect.sync(() => console.log(`[syncThreads] Current thread count: ${count}`)),
          ),
          Effect.catchAll((error) => {
            console.warn(`[syncThreads] Failed to get thread count:`, error);
            return Effect.succeed(0);
          }),
        );

        if (threadCount >= maxCount && !shouldLoop) {
          console.log(`[syncThreads] Threads already synced (${threadCount}), skipping...`);
          result.message = 'Threads already synced';
          return result;
        }

        this.foldersInSync.set(folder, true);

        // Sync single thread function
        const syncSingleThread = (threadId: string) =>
          Effect.gen(this, function* () {
            yield* Effect.sleep(150); // Rate limiting delay
            const syncResult = yield* Effect.tryPromise(() => this.syncThread({ threadId })).pipe(
              Effect.tap(() =>
                Effect.sync(() =>
                  console.log(`[syncThreads] Successfully synced thread ${threadId}`),
                ),
              ),
              Effect.catchAll((error) => {
                console.error(`[syncThreads] Failed to sync thread ${threadId}:`, error);
                return Effect.succeed({
                  success: false,
                  threadId,
                  reason: error.message,
                  broadcastSent: false,
                });
              }),
            );

            if (syncResult.success) {
              result.successfulSyncs++;
            } else {
              result.failedSyncs++;
            }

            return syncResult;
          });

        // Main sync program
        let pageToken: string | null = null;
        let hasMore = true;

        while (hasMore) {
          result.pagesProcessed++;

          // Rate limiting delay between pages
          yield* Effect.sleep(1000);

          console.log(
            `[syncThreads] Processing page ${result.pagesProcessed} for folder ${folder}`,
          );

          const listResult = yield* Effect.tryPromise(() =>
            this.listWithRetry({
              folder,
              maxResults: maxCount,
              pageToken: pageToken || undefined,
            }),
          ).pipe(
            Effect.tap((listResult) =>
              Effect.sync(() => {
                console.log(
                  `[syncThreads] Retrieved ${listResult.threads.length} threads from page ${result.pagesProcessed}`,
                );
                result.totalThreads += listResult.threads.length;
              }),
            ),
            Effect.catchAll((error) => {
              console.error(`[syncThreads] Failed to list threads for folder ${folder}:`, error);
              return Effect.fail(
                new ThreadListError(`Failed to list threads for folder ${folder}`, error),
              );
            }),
          );

          // Process threads with controlled concurrency to avoid rate limits
          const threadIds = listResult.threads.map((thread) => thread.id);
          const syncEffects = threadIds.map(syncSingleThread);

          yield* Effect.all(syncEffects, { concurrency: 1, discard: true }).pipe(
            Effect.tap(() =>
              Effect.sync(() =>
                console.log(`[syncThreads] Completed page ${result.pagesProcessed}`),
              ),
            ),
            Effect.catchAll((error) => {
              console.error(
                `[syncThreads] Failed to process threads on page ${result.pagesProcessed}:`,
                error,
              );
              return Effect.succeed(undefined);
            }),
          );

          result.synced += listResult.threads.length;
          pageToken = listResult.nextPageToken;
          hasMore = pageToken !== null && shouldLoop;
        }

        // Broadcast completion if agent exists
        if (this.agent) {
          yield* Effect.tryPromise(() =>
            this.agent!.broadcastChatMessage({
              type: OutgoingMessageType.Mail_List,
              folder,
            }),
          ).pipe(
            Effect.tap(() =>
              Effect.sync(() => {
                result.broadcastSent = true;
                console.log(`[syncThreads] Broadcasted completion for folder ${folder}`);
              }),
            ),
            Effect.catchAll((error) => {
              console.warn(
                `[syncThreads] Failed to broadcast completion for folder ${folder}:`,
                error,
              );
              return Effect.succeed(undefined);
            }),
          );
        } else {
          console.log(`[syncThreads] No agent available for broadcasting folder ${folder}`);
        }

        this.foldersInSync.delete(folder);

        console.log(`[syncThreads] Completed sync for folder: ${folder}`, {
          synced: result.synced,
          pagesProcessed: result.pagesProcessed,
          totalThreads: result.totalThreads,
          successfulSyncs: result.successfulSyncs,
          failedSyncs: result.failedSyncs,
          broadcastSent: result.broadcastSent,
        });

        return result;
      }).pipe(
        Effect.catchAll((error) => {
          this.foldersInSync.delete(folder);
          console.error(`[syncThreads] Critical error syncing folder ${folder}:`, error);
          return Effect.succeed({
            synced: 0,
            message: `Sync failed: ${error.message}`,
            folder,
            pagesProcessed: 0,
            totalThreads: 0,
            successfulSyncs: 0,
            failedSyncs: 0,
            broadcastSent: false,
          });
        }),
      ),
    );
  }

  async inboxRag(query: string) {
    if (!this.env.AUTORAG_ID) {
      console.warn('[inboxRag] AUTORAG_ID not configured - RAG search disabled');
      return { result: 'Not enabled', data: [] };
    }

    try {
      console.log(`[inboxRag] Executing AI search with parameters:`, {
        query,
        max_num_results: 3,
        score_threshold: 0.3,
        folder_filter: `${this.name}/`,
      });

      const answer = await this.env.AI.autorag(this.env.AUTORAG_ID).aiSearch({
        query: query,
        //   rewrite_query: true,
        max_num_results: 3,
        ranking_options: {
          score_threshold: 0.3,
        },
        //   stream: true,
        filters: {
          type: 'eq',
          key: 'folder',
          value: `${this.name}/`,
        },
      });

      return { result: answer.response, data: answer.data };
    } catch (error) {
      console.error(`[inboxRag] Search failed for query: "${query}"`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        user: this.name,
      });

      // Return empty result on error to prevent breaking the flow
      return { result: 'Search failed', data: [] };
    }
  }

  async searchThreads(params: {
    query: string;
    folder?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string;
  }) {
    const { query, folder = 'inbox', maxResults = 50, labelIds = [], pageToken } = params;

    if (!this.driver) {
      throw new Error('No driver available');
    }

    // Create parallel Effect operations
    const ragEffect = Effect.tryPromise(() =>
      this.inboxRag(query).then((rag) => {
        const ids = rag?.data?.map((d) => d.attributes.threadId).filter(Boolean) ?? [];
        return ids.slice(0, maxResults);
      }),
    ).pipe(Effect.catchAll(() => Effect.succeed([])));

    const genQueryEffect = Effect.tryPromise(() =>
      generateText({
        model: miniModel(),
        system: searchAssistantSystemPrompt(this.providerId),
        prompt: params.query,
      }).then((response) => response.text),
    ).pipe(Effect.catchAll(() => Effect.succeed(query)));

    const genQueryResult = await Effect.runPromise(genQueryEffect);

    const rawEffect = Effect.tryPromise(() =>
      this.driver!.list({
        folder,
        query: genQueryResult,
        labelIds,
        maxResults,
        pageToken,
      }).then((r) => r.threads.map((t) => t.id)),
    ).pipe(Effect.catchAll(() => Effect.succeed([])));

    const effects: Effect.Effect<string[]>[] = [rawEffect];
    if (this.env.AUTORAG_ID) effects.unshift(ragEffect as Effect.Effect<string[]>);

    // Run both in parallel and wait for results
    const results = await Effect.runPromise(Effect.all(effects, { concurrency: 'unbounded' }));
    if (this.env.AUTORAG_ID) {
      const [ragIds, rawIds] = results;

      // Return InboxRag results if found, otherwise fallback to raw
      if (ragIds.length > 0) {
        return {
          threadIds: ragIds,
          source: 'autorag' as const,
        };
      }

      return {
        threadIds: rawIds,
        source: 'raw' as const,
        nextPageToken: pageToken,
      };
    }
    const [rawIds] = results;
    return {
      threadIds: rawIds,
      source: 'raw' as const,
      nextPageToken: pageToken,
    };
  }

  normalizeFolderName(folderName: string) {
    if (folderName === 'bin') return 'trash';
    return folderName;
  }

  async getThreadsFromDB(params: {
    labelIds?: string[];
    folder?: string;
    q?: string;
    maxResults?: number;
    pageToken?: string;
  }): Promise<IGetThreadsResponse> {
    const { labelIds = [], q, maxResults = 50, pageToken } = params;
    let folder = params.folder ?? 'inbox';

    try {
      folder = this.normalizeFolderName(folder);
      // TODO: Sometimes the DO storage is resetting
      //   const folderThreadCount = (await this.count()).find((c) => c.label === folder)?.count;
      //   const currentThreadCount = await this.getThreadCount();

      //   if (folderThreadCount && folderThreadCount > currentThreadCount && folder) {
      //     this.ctx.waitUntil(this.syncThreads(folder));
      //   }

      // Which filters apply. These are tags only - never SQL. Every query below binds its
      // values through the parameterized `this.sql` template.
      const whereConditions: ('folder' | 'labels' | 'q' | 'cursor')[] = [];
      if (folder) whereConditions.push('folder');
      if (labelIds.length > 0) whereConditions.push('labels');
      if (q) whereConditions.push('q');
      if (pageToken) whereConditions.push('cursor');

      // Execute query based on conditions
      let result;

      if (whereConditions.length === 0) {
        // No conditions
        result = this.sql`
            SELECT id, latest_received_on
            FROM threads
            ORDER BY latest_received_on DESC
            LIMIT ${maxResults}
          `;
      } else if (whereConditions.length === 1) {
        // Single condition
        const condition = whereConditions[0];
        if (condition === 'cursor') {
          const cursorValue = pageToken!;
          result = this.sql`
              SELECT id, latest_received_on
              FROM threads
              WHERE latest_received_on < ${cursorValue}
              ORDER BY latest_received_on DESC
              LIMIT ${maxResults}
            `;
        } else if (folder) {
          // Folder condition
          const folderLabel = folder.toUpperCase();
          result = this.sql`
              SELECT id, latest_received_on
              FROM threads
              WHERE EXISTS (
                SELECT 1 FROM json_each(latest_label_ids) WHERE value = ${folderLabel}
              )
              ORDER BY latest_received_on DESC
              LIMIT ${maxResults}
            `;
        } else {
          // Single label condition
          const labelId = labelIds[0];
          result = this.sql`
              SELECT id, latest_received_on
              FROM threads
              WHERE EXISTS (
                SELECT 1 FROM json_each(latest_label_ids) WHERE value = ${labelId}
              )
              ORDER BY latest_received_on DESC
              LIMIT ${maxResults}
            `;
        }
      } else {
        // Multiple conditions - handle combinations
        if (folder && labelIds.length === 0 && pageToken) {
          // Folder + cursor
          const folderLabel = folder.toUpperCase();
          result = this.sql`
              SELECT id, latest_received_on
              FROM threads
              WHERE EXISTS (
                SELECT 1 FROM json_each(latest_label_ids) WHERE value = ${folderLabel}
              ) AND latest_received_on < ${pageToken}
              ORDER BY latest_received_on DESC
              LIMIT ${maxResults}
            `;
        } else if (labelIds.length === 1 && pageToken && !folder) {
          // Single label + cursor
          const labelId = labelIds[0];
          result = this.sql`
              SELECT id, latest_received_on
              FROM threads
              WHERE EXISTS (
                SELECT 1 FROM json_each(latest_label_ids) WHERE value = ${labelId}
              ) AND latest_received_on < ${pageToken}
              ORDER BY latest_received_on DESC
              LIMIT ${maxResults}
            `;
        } else {
          // For now, fallback to just cursor if complex combinations
          const cursorValue = pageToken || '';
          result = this.sql`
              SELECT id, latest_received_on
              FROM threads
              WHERE latest_received_on < ${cursorValue}
              ORDER BY latest_received_on DESC
              LIMIT ${maxResults}
            `;
        }
      }

      if (result?.length) {
        const threads = result.map((row) => ({
          id: String(row.id),
          historyId: null,
        }));

        // Use latest_received_on for pagination cursor
        const nextPageToken =
          threads.length === maxResults && result.length > 0
            ? String(result[result.length - 1].latest_received_on)
            : null;

        return {
          threads,
          nextPageToken,
        };
      }
      return {
        threads: [],
        nextPageToken: '',
      };
    } catch (error) {
      console.error('Failed to get threads from database:', error);
      throw error;
    }
  }

  async modifyThreadLabelsByName(
    threadId: string,
    addLabelNames: string[],
    removeLabelNames: string[],
  ) {
    try {
      if (!this.driver) {
        throw new Error('No driver available');
      }

      // Get all user labels to map names to IDs
      const userLabels = await this.getUserLabels();
      const labelMap = new Map(userLabels.map((label) => [label.name.toLowerCase(), label.id]));

      // Convert label names to IDs
      const addLabelIds: string[] = [];
      const removeLabelIds: string[] = [];

      // Process add labels
      for (const labelName of addLabelNames) {
        const labelId = labelMap.get(labelName.toLowerCase());
        if (labelId) {
          addLabelIds.push(labelId);
        } else {
          console.warn(`Label "${labelName}" not found in user labels`);
        }
      }

      // Process remove labels
      for (const labelName of removeLabelNames) {
        const labelId = labelMap.get(labelName.toLowerCase());
        if (labelId) {
          removeLabelIds.push(labelId);
        } else {
          console.warn(`Label "${labelName}" not found in user labels`);
        }
      }

      // Call the existing function with IDs
      return isDurableLabelMutation(addLabelIds, removeLabelIds)
        ? this.setThreadLabels([threadId], addLabelIds, removeLabelIds)
        : this.modifyThreadLabelsInDB(threadId, addLabelIds, removeLabelIds);
    } catch (error) {
      console.error('Failed to modify thread labels by name:', error);
      throw error;
    }
  }

  /**
   * Applies AI-chosen labels so they persist across re-imports and later label changes:
   * - Gmail: real Gmail labels, through the durable label outbox.
   * - IMAP: keyword tags on the server (never a folder move); labels the server can't
   *   store as keywords are kept by the app instead.
   * - Anything else (Outlook): kept by the app.
   */
  async applyAiLabels(threadId: string, addLabels: string[], removeLabels: string[]) {
    const add = [...new Set(addLabels)];
    const remove = [...new Set(removeLabels)].filter((label) => !add.includes(label));
    if (!add.length && !remove.length) return { success: true, threadId };
    if (!this.driver) await this.setupAuth();
    const driver = this.driver;
    if (!driver) throw new Error('No driver available');

    let appAdd = add;
    if (driver.batchModifyMessageLabels) {
      const durableAdd = add.filter((label) => isDurableLabelMutation([label], []));
      const durableRemove = remove.filter((label) => isDurableLabelMutation([label], []));
      if (durableAdd.length || durableRemove.length)
        await this.setThreadLabels([threadId], durableAdd, durableRemove);
      appAdd = add.filter((label) => !durableAdd.includes(label));
    } else if (driver.applyTagLabels) {
      const { unsupported } = await driver.applyTagLabels([threadId], add, remove);
      const stored = add.filter((label) => !unsupported.includes(label));
      await this.hydrateMessageLabels(threadId);
      for (const row of this.ctx.storage.sql.exec(
        'SELECT message_id FROM mail_message_labels WHERE thread_id = ?',
        threadId,
      ))
        this.labelStore.applyProviderLabels(String(row.message_id), stored, remove);
      appAdd = add.filter((label) => unsupported.includes(label));
      await this.afterImapMutation();
    }
    // Removal also clears any app-kept copy, whichever store held the label.
    this.labelStore.setAppThreadLabels(threadId, appAdd, remove);
    this.refreshThreadLabels(threadId);
    this.invalidateSearches();
    await this.agent?.broadcastChatMessage({ type: OutgoingMessageType.Mail_Get, threadId });
    return { success: true, threadId, appKept: appAdd };
  }

  /**
   * Overrides a thread's inbox category on providers without native categories (IMAP).
   * The thread is re-imported on the next sync pass, which is scheduled right away.
   */
  async setThreadCategory(
    threadId: string,
    category: 'personal' | 'promotions' | 'updates',
    source: 'ai' | 'user' = 'ai',
  ) {
    if (!this.driver) await this.setupAuth();
    if (!this.driver?.setThreadCategory) return { success: false, reason: 'unsupported' as const };
    const changed = await this.driver.setThreadCategory(threadId, category, source);
    if (changed) await this.afterImapMutation();
    return { success: true, changed };
  }

  async modifyThreadLabelsInDB(threadId: string, addLabels: string[], removeLabels: string[]) {
    try {
      // Get current labels
      const result = this.sql`
        SELECT latest_label_ids
        FROM threads
        WHERE thread_id = ${threadId}
        LIMIT 1
      `;

      if (!result || result.length === 0) {
        throw new Error(`Thread ${threadId} not found in database`);
      }

      let currentLabels: string[];
      try {
        currentLabels = JSON.parse(String(result[0].latest_label_ids || '[]')) as string[];
      } catch (error) {
        console.error(`Invalid JSON in latest_label_ids for thread ${threadId}:`, error);
        currentLabels = [];
      }

      // Apply label modifications
      this.labelStore.importSyntheticThreadLabels(threadId, currentLabels);
      this.labelStore.setSyntheticThreadLabels(
        threadId,
        addLabels.filter(isSyntheticLabel),
        removeLabels.filter(isSyntheticLabel),
      );
      let updatedLabels = [...currentLabels];

      // Remove labels
      if (removeLabels.length > 0) {
        updatedLabels = updatedLabels.filter((label) => !removeLabels.includes(label));
      }

      // Add labels (avoid duplicates)
      if (addLabels.length > 0) {
        for (const label of addLabels) {
          if (!updatedLabels.includes(label)) {
            updatedLabels.push(label);
          }
        }
      }

      const storedMessages = this.ctx.storage.sql
        .exec('SELECT message_id FROM mail_message_labels WHERE thread_id = ? LIMIT 1', threadId)
        .toArray();
      if (storedMessages.length) {
        updatedLabels = updatedLabels.filter((label) => label !== 'UNREAD');
        if (this.labelStore.threadLabels(threadId).includes('UNREAD')) updatedLabels.push('UNREAD');
      }

      // Update the database
      void this.sql`
        UPDATE threads
        SET latest_label_ids = ${JSON.stringify(updatedLabels)},
            updated_at = CURRENT_TIMESTAMP
        WHERE thread_id = ${threadId}
      `;

      await this.agent?.broadcastChatMessage({
        type: OutgoingMessageType.Mail_Get,
        threadId,
      });

      return {
        success: true,
        threadId,
        previousLabels: currentLabels,
        updatedLabels,
      };
    } catch (error) {
      console.error('Failed to modify thread labels in database:', error);
      throw error;
    }
  }

  async getThreadFromDB(id: string, includeDrafts: boolean = false): Promise<IGetThreadResponse> {
    this.historyStore.activate(Date.now());
    try {
      const result = this.sql`
          SELECT
            id,
            thread_id,
            provider_id,
            latest_sender,
            latest_received_on,
            latest_subject,
            latest_label_ids,
            created_at,
            updated_at
          FROM threads
          WHERE thread_id = ${id}
          LIMIT 1
        `;

      if (!result || result.length === 0) {
        if (!this.labelStore.isThreadDeleted(id)) {
          await this.ensureCachedThreadImport(id);
        }
        return {
          messages: [],
          latest: undefined,
          hasUnread: false,
          totalReplies: 0,
          labels: [],
        } satisfies IGetThreadResponse;
      }
      const row = result[0] as { latest_label_ids: string };
      const storedThread = await this.env.THREADS_BUCKET.get(this.getThreadKey(id));
      if (!storedThread) {
        await this.ensureCachedThreadImport(id);
      }

      let messages: ParsedMessage[] = storedThread
        ? (JSON.parse(await storedThread.text()) as IGetThreadResponse).messages
        : [];

      const store = this.labelStore;
      await this.hydrateMessageLabels(id);
      messages = messages
        .filter((message) => !store.isDeleted(message.id))
        .map((message) => {
          const labels = store.messageLabels(message.id);
          return labels
            ? {
                ...message,
                unread: labels.includes('UNREAD'),
                tags: labels.map(
                  (label) =>
                    message.tags.find((tag) => tag.id === label) ?? {
                      id: label,
                      name: label,
                      type: 'system',
                    },
                ),
              }
            : message;
        });

      const isLatestDraft = messages.some((e) => e.isDraft === true);

      if (!includeDrafts) {
        messages = messages.filter((e) => e.isDraft !== true);
      }

      const latestLabelIds = messages.length
        ? store.threadLabels(id)
        : JSON.parse(row.latest_label_ids || '[]');

      return {
        messages,
        latest: messages.findLast((e) => e.isDraft !== true),
        hasUnread: latestLabelIds.includes('UNREAD'),
        totalReplies: messages.filter((e) => e.isDraft !== true).length,
        labels: latestLabelIds.map((id: string) => ({ id, name: id })),
        isLatestDraft,
      } satisfies IGetThreadResponse;
    } catch (error) {
      console.error('Failed to get thread from database:', error);
      throw error;
    }
  }

  private async ensureCachedThreadImport(id: string) {
    if (this.driver?.getMailboxHistoryId) {
      this.historyStore.ensureImport(id);
      await this.ensureHistoryRecovery();
      await this.scheduleHistorySoon();
    } else {
      const queued = await this.getQueues('callback', 'syncThread');
      if (!queued.some((item) => (item.payload as { threadId?: string })?.threadId === id)) {
        await this.queue('syncThread', { threadId: id });
      }
    }
  }

  async unsnoozeThreadsHandler(payload: ISnoozeBatch) {
    const { connectionId, threadIds, keyNames } = payload;
    try {
      if (!this.driver) {
        await this.setupAuth();
      }

      if (threadIds.length) {
        await this.modifyLabels(threadIds, ['INBOX'], ['SNOOZED']);
      }

      if (keyNames.length) {
        await Promise.all(keyNames.map((k: string) => this.env.snoozed_emails.delete(k)));
      }
    } catch (error) {
      console.error('[AGENT][unsnoozeThreadsHandler] Failed', { connectionId, threadIds, error });
      throw error;
    }
  }

  async listThreads(params: {
    folder: string;
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string;
  }) {
    this.historyStore.activate(Date.now());
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.getThreadsFromDB(params);
  }

  async list(params: {
    folder: string;
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string;
  }) {
    this.historyStore.activate(Date.now());
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.getThreadsFromDB(params);
  }

  //   async get(id: string, includeDrafts: boolean = false) {
  //     if (!this.driver) {
  //       throw new Error('No driver available');
  //     }
  //     return await this.getThreadFromDB(id, includeDrafts);
  //   }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const UUID = '[0-9a-f-]{36}';
type ChatFinish = (event: {
  response: { messages: Parameters<typeof appendResponseMessages>[0]['responseMessages'] };
}) => Promise<void>;

export class ZeroAgent extends AIChatAgent<ZeroEnv> {
  private chatMessageAbortControllers: Map<string, AbortController> = new Map();
  private connectionThreadIds: Map<string, string | null> = new Map();
  private conversationStore?: ConversationStore;

  // A method, not a getter: the agents framework reads prototype getters in its constructor.
  private conversations() {
    if (this.conversationStore) return this.conversationStore;
    const store = new ConversationStore(this.sql.bind(this));
    // Chats from before conversation history existed become its first entry.
    if (
      this.name !== 'general' &&
      !store.getState('current_conversation') &&
      this.messages.length
    ) {
      store.save(store.currentId(), this.messages);
    }
    return (this.conversationStore = store);
  }

  /** Mirrors every save of the open chat into its conversation record. */
  override async persistMessages(messages: Message[], excludeBroadcastIds: string[] = []) {
    await super.persistMessages(messages, excludeBroadcastIds);
    if (this.name === 'general') return;
    this.cleanUpRemovedConversations(
      this.conversations().save(this.conversations().currentId(), messages),
    );
  }

  /** Conversation history: list, start new, reopen, delete. */
  override async onRequest(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    const route = pathname.match(new RegExp(`/conversations(?:/(new|${UUID}))?(?:/(open))?$`));
    if (!route) return super.onRequest(request);
    if (this.name === 'general') return new Response('Not Found', { status: 404 });

    const [, target, action] = route;
    const method = request.method;
    if (method === 'GET' && !target) {
      return Response.json({
        currentId: this.conversations().currentId(),
        conversations: this.conversations().list(),
      });
    }
    if (method === 'POST' && target === 'new') {
      this.startNewConversation();
      return Response.json({ ok: true });
    }
    if (method === 'POST' && target && action === 'open') {
      return (await this.openConversation(target))
        ? Response.json({ ok: true })
        : new Response('Not Found', { status: 404 });
    }
    if (method === 'DELETE' && target && target !== 'new' && !action) {
      return this.deleteConversation(target)
        ? Response.json({ ok: true })
        : new Response('Not Found', { status: 404 });
    }
    return new Response('Method Not Allowed', { status: 405 });
  }

  private startNewConversation() {
    this.destroyAbortControllers();
    this.conversations().startNew();
    void this.sql`delete from cf_ai_chat_agent_messages`;
    this.messages = [];
    this.broadcastChatMessage({ type: OutgoingMessageType.ChatClear });
  }

  private async openConversation(id: string): Promise<boolean> {
    const messages = this.conversations().get(id);
    if (!messages) return false;
    if (id === this.conversations().currentId()) return true;
    this.destroyAbortControllers();
    this.conversations().setCurrent(id);
    // Loads it as the open chat and broadcasts it to every tab, without bumping its date.
    await super.persistMessages(messages);
    return true;
  }

  private deleteConversation(id: string): boolean {
    const removed = this.conversations().delete(id);
    if (removed === undefined) return false;
    if (id === this.conversations().currentId()) this.startNewConversation();
    this.cleanUpRemovedConversations([removed]);
    return true;
  }

  private referencedAttachments() {
    return referencedAttachmentIds(
      this.name,
      ...this.conversations().allMessagesJson(),
      JSON.stringify(this.messages),
    );
  }

  /** Deletes attachments that only the removed conversations referenced. */
  private cleanUpRemovedConversations(removedMessagesJson: string[]) {
    if (removedMessagesJson.length === 0) return;
    const candidates = referencedAttachmentIds(this.name, ...removedMessagesJson);
    if (candidates.size === 0) return;
    const stillUsed = this.referencedAttachments();
    const ids = [...candidates].filter((id) => !stillUsed.has(id));
    void deleteAttachments(this.name, ids).catch((error: unknown) =>
      console.warn('[chat-attachments] cleanup failed', error),
    );
  }

  /** At most daily: deletes uploads no conversation references (e.g. never sent). */
  private maybeSweepAttachments() {
    const last = Number(this.conversations().getState('attachments_swept_at') ?? 0);
    if (Date.now() - last < DAY_MS) return;
    this.conversations().setState('attachments_swept_at', String(Date.now()));
    void sweepOrphanedAttachments(this.name, this.referencedAttachments(), DAY_MS).catch(
      (error: unknown) => console.warn('[chat-attachments] sweep failed', error),
    );
  }

  /** Called when the mailbox is removed: drops all chat history and attachments. */
  async clearChatData() {
    this.startNewConversation();
    this.conversations().deleteAll();
    await deleteAllAttachments(this.name);
  }

  /** Tells the mailbox how many app tabs are open, so IMAP push runs only while used. */
  override onConnect() {
    this.reportPresence();
  }

  override onClose(connection: Connection) {
    this.reportPresence(connection.id);
  }

  private reportPresence(closing?: string) {
    if (this.name === 'general' || this.name.includes('aggregate')) return;
    const count = [...this.getConnections()].filter((c) => c.id !== closing).length;
    const connectionId = this.name;
    const mailbox = this.env.ZERO_DRIVER.get(this.env.ZERO_DRIVER.idFromName(connectionId));
    this.ctx.waitUntil(
      mailbox.setClientPresence(connectionId, count).catch((error: unknown) =>
        console.warn('[presence] report failed', {
          connectionId,
          error: error instanceof Error ? error.message : String(error),
        }),
      ),
    );
  }

  private async tryCatchChat<T>(fn: () => T | Promise<T>) {
    try {
      return await fn();
    } catch (e) {
      throw this.onError(e);
    }
  }

  private getAbortSignal(id: string): AbortSignal | undefined {
    // Defensive check, since we're coercing message types at the moment
    if (typeof id !== 'string') {
      return undefined;
    }

    if (!this.chatMessageAbortControllers.has(id)) {
      this.chatMessageAbortControllers.set(id, new AbortController());
    }

    return this.chatMessageAbortControllers.get(id)?.signal;
  }

  /**
   * Remove an abort controller from the cache of pending message responses
   */
  private removeAbortController(id: string) {
    this.chatMessageAbortControllers.delete(id);
  }

  broadcastChatMessage(message: OutgoingMessage, exclude?: string[]) {
    this.broadcast(JSON.stringify(message), exclude);
  }

  private cancelChatRequest(id: string) {
    if (this.chatMessageAbortControllers.has(id)) {
      const abortController = this.chatMessageAbortControllers.get(id);
      abortController?.abort();
    }
  }

  async onMessage(connection: Connection, message: WSMessage) {
    // 'general' is one room shared by every signed-in user with no mailbox selected,
    // so chat state there (persisted and broadcast) would leak across users.
    if (this.name === 'general') return;
    if (typeof message === 'string') {
      let data: IncomingMessage;
      try {
        data = JSON.parse(message) as IncomingMessage;
      } catch (error) {
        console.warn(error);
        // silently ignore invalid messages for now
        // TODO: log errors with log levels
        return;
      }
      switch (data.type) {
        case IncomingMessageType.UseChatRequest: {
          if (data.init.method !== 'POST') break;

          // The socket also carries mail sync, so only chat requests are refused.
          if (!(await isAiEnabledForConnection(this.name))) {
            connection.send(
              JSON.stringify({
                id: data.id,
                type: OutgoingMessageType.UseChatResponse,
                // Data stream protocol error part, surfaced by useChat as an error.
                body: `3:${JSON.stringify(AI_DISABLED_MESSAGE)}\n`,
                done: true,
              }),
            );
            break;
          }

          const { body } = data.init;

          const { messages, threadId, currentFolder, currentFilter } = JSON.parse(
            body as string,
          ) as {
            threadId: string;
            currentFolder: string;
            currentFilter: string;
            messages: Message[];
          };
          this.broadcastChatMessage(
            {
              type: OutgoingMessageType.ChatMessages,
              messages,
            },
            [connection.id],
          );
          await this.persistMessages(messages, [connection.id]);
          const conversationId = this.conversations().currentId();

          const chatMessageId = data.id;
          const abortSignal = this.getAbortSignal(chatMessageId);

          return this.tryCatchChat(async () => {
            const response = await this.onChatMessageWithContext(
              async ({ response }) => {
                const finalMessages = appendResponseMessages({
                  messages,
                  responseMessages: response.messages,
                });

                // If the user switched chats mid-reply, file it under the chat it belongs to.
                if (this.conversations().currentId() === conversationId) {
                  await this.persistMessages(finalMessages, [connection.id]);
                } else {
                  this.cleanUpRemovedConversations(
                    this.conversations().save(conversationId, finalMessages),
                  );
                }
                this.removeAbortController(chatMessageId);
                this.maybeSweepAttachments();
              },
              threadId,
              currentFolder,
              currentFilter,
              abortSignal,
            );

            if (response) {
              await this.reply(data.id, response).finally(() =>
                this.removeAbortController(chatMessageId),
              );
            } else {
              console.warn(
                `[AIChatAgent] onChatMessage returned no response for chatMessageId: ${chatMessageId}`,
              );
              this.broadcastChatMessage(
                {
                  id: data.id,
                  type: OutgoingMessageType.UseChatResponse,
                  body: 'No response was generated by the agent.',
                  done: true,
                },
                [connection.id],
              );
            }
          });
        }
        case IncomingMessageType.ChatClear: {
          // Clearing deletes the open chat (and its files); "new chat" archives it instead.
          const removed = this.conversations().delete(this.conversations().currentId());
          this.startNewConversation();
          if (removed !== undefined) this.cleanUpRemovedConversations([removed]);
          break;
        }
        case IncomingMessageType.ChatMessages: {
          await this.persistMessages(data.messages, [connection.id]);
          break;
        }
        case IncomingMessageType.ChatRequestCancel: {
          this.cancelChatRequest(data.id);
          break;
        }
        // case IncomingMessageType.Mail_List: {
        //   const result = await this.getThreadsFromDB({
        //     labelIds: data.labelIds,
        //     folder: data.folder,
        //     q: data.query,
        //     max: data.maxResults,
        //     cursor: data.pageToken,
        //   });
        //   this.currentFolder = data.folder;
        //   connection.send(
        //     JSON.stringify({
        //       type: OutgoingMessageType.Mail_List,
        //       result,
        //     }),
        //   );
        //   break;
        // }
        // case IncomingMessageType.Mail_Get: {
        //   const result = await this.getThreadFromDB(data.threadId);
        //   connection.send(
        //     JSON.stringify({
        //       type: OutgoingMessageType.Mail_Get,
        //       result,
        //       threadId: data.threadId,
        //     }),
        //   );
        //   break;
        // }
      }
    }
  }

  private async reply(id: string, response: Response) {
    // now take chunks out from dataStreamResponse and send them to the client
    return this.tryCatchChat(async () => {
      const reader = response.body!.getReader();
      const streamDecoder = new TextDecoder();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          this.broadcastChatMessage({
            id,
            type: OutgoingMessageType.UseChatResponse,
            body: streamDecoder.decode(value, { stream: true }),
            done: false,
          });
        }
        const final = streamDecoder.decode();
        if (final)
          this.broadcastChatMessage({
            id,
            type: OutgoingMessageType.UseChatResponse,
            body: final,
            done: false,
          });
      } finally {
        reader.releaseLock();
      }

      this.broadcastChatMessage({
        id,
        type: OutgoingMessageType.UseChatResponse,
        body: '',
        done: true,
      });
    });
  }

  private destroyAbortControllers() {
    for (const controller of this.chatMessageAbortControllers.values()) {
      controller?.abort();
    }
    this.chatMessageAbortControllers.clear();
  }

  async onChatMessageWithContext(
    onFinish: ChatFinish,
    currentThreadId: string,
    currentFolder: string,
    currentFilter: string,
    abortSignal?: AbortSignal,
  ) {
    // The Durable Object remains a history/socket adapter, not an agent loop.
    // Mailbox sync, presence, old conversations and attachment storage stay put.
    const conversationId = this.conversations().currentId();
    const messages = [...this.messages];
    return createDataStreamResponse({
      execute: async (stream) => {
        const { db, conn } = createDb(this.env.HYPERDRIVE.connectionString);
        let userId: string | undefined;
        try {
          userId = (
            await db
              .select({ userId: connection.userId })
              .from(connection)
              .where(eq(connection.id, this.name))
          )[0]?.userId;
        } finally {
          await conn.end().catch(() => {});
        }
        if (!userId) throw new Error('Mailbox account not found');
        await ownedMailbox(userId, this.name);
        const agent = await bindAssistantConversation(userId, conversationId);
        if (messages.some((message) => message.experimental_attachments?.length)) {
          throw new Error(
            'This conversation contains attachments, which the Keiki web gateway does not yet support. Start a new text-only chat.',
          );
        }
        const transcript = messages
          .filter((message) => message.role === 'user' || message.role === 'assistant')
          .map((message) => ({ role: message.role, content: message.content }));
        const response = await assistantClient().completions({
          agentId: agent.agentId,
          conversationId,
          messages: [
            {
              role: 'system',
              content: JSON.stringify({
                activeMailbox: this.name,
                currentThreadId,
                currentFolder,
                currentFilter,
              }),
            },
            ...transcript,
          ],
          signal: abortSignal,
        });
        let text = '';
        for await (const delta of completionText(response)) {
          text += delta;
          stream.write(`0:${JSON.stringify(delta)}\n`);
        }
        await onFinish({
          response: {
            messages: [
              { id: crypto.randomUUID(), role: 'assistant', content: [{ type: 'text', text }] },
            ],
          },
        });
      },
      onError: (error) => (error instanceof Error ? error.message : 'Assistant request failed'),
    });
  }
}
