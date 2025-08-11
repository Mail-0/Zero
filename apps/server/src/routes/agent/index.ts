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
  countThreads,
  countThreadsByLabels,
  deleteSpamThreads,
  get,
  getThreadLabels,
  modifyThreadLabels,
  type DB,
} from './db';
import {
  appendResponseMessages,
  createDataStreamResponse,
  generateText,
  streamText,
  type StreamTextOnFinishCallback,
} from 'ai';
import {
  IncomingMessageType,
  OutgoingMessageType,
  type IncomingMessage,
  type OutgoingMessage,
} from './types';
import {
  EPrompts,
  type IOutgoingMessage,
  type ISnoozeBatch,
  type ParsedMessage,
} from '../../types';
import type { IGetThreadResponse, IGetThreadsResponse, MailManager } from '../../lib/driver/types';
import { connectionToDriver, getZeroSocketAgent, reSyncThread } from '../../lib/server-utils';
import { generateWhatUserCaresAbout, type UserTopic } from '../../lib/analyze/interests';
import { DurableObjectOAuthClientProvider } from 'agents/mcp/do-oauth-client-provider';
import { AiChatPrompt, GmailSearchAssistantSystemPrompt } from '../../lib/prompts';
import { Migratable, Queryable, Transfer } from 'dormroom';
import type { CreateDraftData } from '../../lib/schemas';
import { drizzle } from 'drizzle-orm/durable-sqlite';
import { getPrompt } from '../../pipelines.effect';
import { AIChatAgent } from 'agents/ai-chat-agent';
import { DurableObject } from 'cloudflare:workers';
import { ToolOrchestrator } from './orchestrator';
import { eq, desc, isNotNull } from 'drizzle-orm';
import migrations from './db/drizzle/migrations';
import { getPromptName } from '../../pipelines';
import { anthropic } from '@ai-sdk/anthropic';
import { connection } from '../../db/schema';
import type { WSMessage } from 'partyserver';
import { tools as authTools } from './tools';
import { processToolCalls } from './utils';
import { type ZeroEnv } from '../../env';
import { type Connection } from 'agents';
import { openai } from '@ai-sdk/openai';
import * as schema from './db/schema';
import { threads } from './db/schema';
import { Effect, pipe } from 'effect';
import { groq } from '@ai-sdk/groq';
import { createDb } from '../../db';
import type { Message } from 'ai';
import { create } from './db';

const decoder = new TextDecoder();
const maxCount = 20;

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

const _migrations = Object.fromEntries(
  Object.entries(migrations.migrations).map(([_, value], index) => [index + 1, [value]]),
);

@Migratable({
  migrations: {
    1: [
      `CREATE TABLE IF NOT EXISTS shards (
      shard_id TEXT PRIMARY KEY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    ],
  },
})
@Queryable()
export class ShardRegistry extends DurableObject<ZeroEnv> {
  sql: SqlStorage;
  constructor(ctx: DurableObjectState, env: ZeroEnv) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
  }
}

@Migratable({
  migrations: _migrations,
})
@Queryable()
export class ZeroDriver extends DurableObject<ZeroEnv> {
  transfer = new Transfer(this);
  sql: SqlStorage;
  private db: DB;
  private syncThreadsInProgress: Map<string, boolean> = new Map();
  private driver: MailManager | null = null;
  private agent: DurableObjectStub<ZeroAgent> | null = null;
  private name: string = 'general';
  private connection: typeof connection.$inferSelect | null = null;
  private recipientCache: {
    contacts: Array<{ email: string; name?: string | null; freq: number; last: number }>;
    hash: string;
  } | null = null;

  private invalidateRecipientCache() {
    this.recipientCache = null;
  }

  private parseMalformedSender(rawData: string): { email: string; name?: string } | null {
    const emailRegex = /([^\s@]+@[^\s@]+\.[^\s@]+)/;

    if (emailRegex.test(rawData.trim())) {
      const email = rawData.trim();
      console.warn('[SuggestRecipients] Used fallback parsing for plain email:', email);
      return { email, name: undefined };
    }

    const emailMatch = rawData.match(emailRegex);
    if (!emailMatch) return null;

    const email = emailMatch[1];
    let name: string | undefined = undefined;

    const namePatterns = [
      /"name"\s*:\s*"([^"]+)"/,
      /'name'\s*:\s*'([^']+)'/,
      /name\s*:\s*([^,}\]]+)/,
      /"([^"]+)"\s*<[^>]*>/,
      /'([^']+)'\s*<[^>]*>/,
      /([^<]+)\s*<[^>]*>/,
      /"([^"]+)"/,
      /'([^']+)'/,
    ];

    for (const pattern of namePatterns) {
      const nameMatch = rawData.match(pattern);
      if (nameMatch && nameMatch[1]) {
        const potentialName = nameMatch[1].trim();
        if (potentialName && potentialName !== email && !potentialName.includes('@')) {
          name = potentialName.replace(/[{}[\],]/g, '').trim();
          if (name) break;
        }
      }
    }

    console.warn('[SuggestRecipients] Extracted from malformed data:', { email, name });
    return { email, name };
  }

  constructor(ctx: DurableObjectState, env: ZeroEnv) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.db = drizzle(ctx.storage, { schema });
  }

  async setName(name: string) {
    this.name = name;
    await this.ctx.blockConcurrencyWhile(async () => {
      await this.setupAuth();
    });
  }

  getDatabaseSize() {
    return this.ctx.storage.sql.databaseSize;
  }

  async isSyncing(): Promise<boolean> {
    return false;
  }

  async getAllSubjects() {
    const subjects = await this.db.select({ latestSubject: threads.latestSubject }).from(threads);
    return subjects.map((row) => row.latestSubject).filter((subject) => subject !== null);
  }

  broadcast(message: OutgoingMessage) {
    this.agent?.broadcastChatMessage(message);
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
            Array.isArray((data as any).topics) &&
            typeof (data as any).timestamp === 'number'
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
      const subjects = yield* Effect.tryPromise(() => this.getAllSubjects()).pipe(
        Effect.catchAll((error) => {
          console.error(`[getUserTopics] Failed to get subjects:`, error);
          return Effect.succeed([]);
        }),
      );
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
                await this.createLabel({
                  name: topic.topic,
                });
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
    this.invalidateRecipientCache();
    return result;
  }

  async create(data: IOutgoingMessage) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    const result = await this.driver.create(data);
    this.invalidateRecipientCache();
    return result;
  }

  async delete(id: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.delete(id);
  }

  async deleteAllSpam() {
    return await deleteSpamThreads(this.db);
  }

  async getEmailAliases() {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.getEmailAliases();
  }

  async getMessageAttachments(messageId: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.getMessageAttachments(messageId);
  }

  private dropTables() {
    this.sql.exec(`DROP TABLE IF EXISTS threads`);
    this.sql.exec(`DROP TABLE IF EXISTS thread_labels`);
    this.sql.exec(`DROP TABLE IF EXISTS labels`);
  }

  private createTables() {
    const m = Object.values(migrations.migrations);
    for (const migration of m) {
      this.sql.exec(migration);
    }
  }

  async forceReSync() {
    // this.foldersInSync.clear();
    this.syncThreadsInProgress.clear();
    this.dropTables();
    this.createTables();
    await this.syncFolders();
  }

  public async setupAuth() {
    if (this.name === 'general') return;
    if (!this.driver) {
      const { db, conn } = createDb(this.env.HYPERDRIVE.connectionString);
      const _connection = await db.query.connection.findFirst({
        where: eq(connection.id, this.name),
      });
      if (_connection) {
        this.driver = connectionToDriver(_connection);
        this.connection = _connection;
      }
      this.ctx.waitUntil(conn.end());
    }
    if (!this.agent) this.agent = await getZeroSocketAgent(this.name);
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
      await this.triggerSyncWorkflow('inbox');
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
    return await this.driver.list(params);
  }

  async getThread(threadId: string, includeDrafts: boolean = false) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.getThreadFromDB(threadId, includeDrafts);
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
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.modifyLabels(threadIds, {
      addLabels: addLabelIds,
      removeLabels: removeLabelIds,
    });
  }

  async listHistory<T>(historyId: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.listHistory<T>(historyId);
  }

  async getUserLabels() {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.getUserLabels();
  }

  async getLabel(id: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.getLabel(id);
  }

  async createLabel(params: {
    name: string;
    color?: {
      backgroundColor: string;
      textColor: string;
    };
  }) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.createLabel(params);
  }

  async bulkDelete(threadIds: string[]) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.modifyLabels(threadIds, {
      addLabels: ['TRASH'],
      removeLabels: ['INBOX'],
    });
  }

  async bulkArchive(threadIds: string[]) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.modifyLabels(threadIds, {
      addLabels: [],
      removeLabels: ['INBOX'],
    });
  }

  async updateLabel(
    id: string,
    label: { name: string; color?: { backgroundColor: string; textColor: string } },
  ) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.updateLabel(id, label);
  }

  async deleteLabel(id: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.deleteLabel(id);
  }

  async createDraft(draftData: CreateDraftData) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.createDraft(draftData);
  }

  async getDraft(id: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.getDraft(id);
  }

  async listDrafts(params: { q?: string; maxResults?: number; pageToken?: string }) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.listDrafts(params);
  }

  async deleteDraft(id: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    await this.driver.deleteDraft(id);
    // Broadcast drafts folder refresh
    await this.reloadFolder('drafts');
    return { success: true };
  }

  // Additional mail operations
  async count() {
    const folders = ['inbox', 'sent', 'spam', 'archive', 'trash'];
    const results = await countThreadsByLabels(
      this.db,
      folders.map((f) => f.toUpperCase()),
    );
    const resultMap = new Map(
      results.map((r: { labelId: string; count: number }) => [r.labelId, r.count]),
    );
    return folders.map((f) => ({ label: f, count: resultMap.get(f.toUpperCase()) ?? 0 }));
  }

  private getThreadKey(threadId: string) {
    return `${this.name}/${threadId}.json`;
  }

  async deleteThread(id: string) {
    await this.db.delete(threads).where(eq(threads.threadId, id));
    this.invalidateRecipientCache();
    this.agent?.broadcastChatMessage({
      type: OutgoingMessageType.Mail_List,
      folder: 'trash',
    });
  }

  async reloadFolder(folder: string) {
    this.agent?.broadcastChatMessage({
      type: OutgoingMessageType.Mail_List,
      folder,
    });
  }

  async syncThread({ threadId }: { threadId: string }): Promise<ThreadSyncResult> {
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
        if (!this.connection) {
          throw new Error('No connection available');
        }
        const result: ThreadSyncResult = {
          success: false,
          threadId,
          broadcastSent: false,
        };

        this.syncThreadsInProgress.set(threadId, true);

        const latest = yield* Effect.tryPromise(() =>
          this.env.THREAD_SYNC_WORKER.get(this.env.THREAD_SYNC_WORKER.newUniqueId()).syncThread(
            this.connection!,
            threadId,
          ),
        );

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

        // Update database
        yield* Effect.tryPromise(() =>
          create(
            this.db,
            {
              id: threadId,
              threadId,
              providerId: 'google',
              latestSender: latest.sender,
              latestReceivedOn: normalizedReceivedOn,
              latestSubject: latest.subject,
            },
            latest.tags.map((tag) => tag.id),
          ),
        ).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              console.log(`[syncThread] Updated database for ${threadId}`);
              this.invalidateRecipientCache();
            }),
          ),
          Effect.tap(() => Effect.sync(() => this.reloadFolder('inbox'))),
          Effect.catchAll((error) => {
            console.error(`[syncThread] Failed to update database for ${threadId}:`, error);
            return Effect.succeed(undefined);
          }),
        );

        // Broadcast update if agent exists
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

        console.log(`[syncThread] Completed sync for thread: ${threadId}`, {
          success: result.success,
          broadcastSent: result.broadcastSent,
          hasLatestMessage: !!latest,
        });

        return result;
      }).pipe(
        Effect.catchAll((error) => {
          this.syncThreadsInProgress.delete(threadId);
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
    const count = await countThreads(this.db);
    return count || 0;
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
        model: openai(this.env.OPENAI_MODEL || 'gpt-4o'),
        system: GmailSearchAssistantSystemPrompt(),
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

  private queryThreads(params: {
    labelIds?: string[];
    folder?: string;
    q?: string;
    pageToken?: string;
    maxResults: number;
  }) {
    return Effect.tryPromise(async () => {
      const { labelIds = [], folder, q, pageToken, maxResults } = params;

      console.log('[queryThreads] params:', { labelIds, folder, q, pageToken, maxResults });

      // Import the new database functions
      const {
        findThreadsWithPagination,
        findThreadsByFolderWithPagination,
        findThreadsByFolder,
        findThreadsWithAnyLabels,
        findThreadsWithTextSearch,
        list,
      } = await import('./db');

      // Case 1: All threads (no filters)
      if (!folder && labelIds.length === 0 && !q && !pageToken) {
        console.log('[queryThreads] Case: all threads');
        const threads = await list(this.db);
        return threads.map((thread: any) => ({
          id: thread.id,
          latest_received_on: thread.latestReceivedOn,
        }));
      }

      // Case 2: Folder only
      if (folder && labelIds.length === 0 && !q) {
        const folderLabel = folder.toUpperCase();
        console.log('[queryThreads] Case: folder only', { folderLabel });

        if (pageToken) {
          const result = await findThreadsByFolderWithPagination(this.db, folderLabel, {
            pageToken,
            maxResults,
          });
          return result.threads.map((thread: any) => ({
            id: thread.id,
            latest_received_on: thread.latestReceivedOn,
          }));
        } else {
          const threads = await findThreadsByFolder(this.db, folderLabel);
          return threads.slice(0, maxResults).map((thread: any) => ({
            id: thread.id,
            latest_received_on: thread.latestReceivedOn,
          }));
        }
      }

      // Case 3: Single label only
      if (labelIds.length === 1 && !folder && !q) {
        const labelId = labelIds[0];
        console.log('[queryThreads] Case: single label only', { labelId });

        if (pageToken) {
          const result = await findThreadsWithPagination(this.db, {
            labelIds: [labelId],
            pageToken,
            maxResults,
          });
          return result.threads.map((thread: any) => ({
            id: thread.id,
            latest_received_on: thread.latestReceivedOn,
          }));
        } else {
          const threads = await findThreadsWithAnyLabels(this.db, [labelId]);
          return threads.slice(0, maxResults).map((thread: any) => ({
            id: thread.id,
            latest_received_on: thread.latestReceivedOn,
          }));
        }
      }

      // Case 4: Text search only
      if (q && !folder && labelIds.length === 0) {
        console.log('[queryThreads] Case: text search only', { q });
        const threads = await findThreadsWithTextSearch(this.db, q);
        return threads.slice(0, maxResults).map((thread: any) => ({
          id: thread.id,
          latest_received_on: thread.latestReceivedOn,
        }));
      }

      // Case 5: Complex filtering (folder + labels + search + pagination)
      console.log('[queryThreads] Case: complex filtering', {
        folder,
        labelIds,
        q,
        pageToken,
      });

      const allLabelIds = [...labelIds];
      if (folder) {
        allLabelIds.push(folder.toUpperCase());
      }

      const result = await findThreadsWithPagination(this.db, {
        labelIds: allLabelIds,
        searchText: q,
        pageToken,
        maxResults,
        requireAllLabels: true, // Require all labels to be present
      });

      return result.threads.map((thread: any) => ({
        id: thread.id,
        latest_received_on: thread.latestReceivedOn,
      }));
    });
  }

  async getThreadsFromDB(params: {
    labelIds?: string[];
    folder?: string;
    q?: string;
    maxResults?: number;
    pageToken?: string;
  }): Promise<IGetThreadsResponse> {
    const { maxResults = 50 } = params;
    const normalizedParams = {
      ...params,
      folder: params.folder ? this.normalizeFolderName(params.folder) : undefined,
      maxResults,
    };

    const program = pipe(
      this.queryThreads(normalizedParams),
      Effect.map((result) => {
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
      }),
      Effect.catchAll((error) =>
        Effect.sync(() => {
          console.error('Failed to get threads from database:', error);
          throw error;
        }),
      ),
    );

    return await Effect.runPromise(program);
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
      return await this.modifyThreadLabelsInDB(threadId, addLabelIds, removeLabelIds);
    } catch (error) {
      console.error('Failed to modify thread labels by name:', error);
      throw error;
    }
  }

  async modifyThreadLabelsInDB(threadId: string, addLabels: string[], removeLabels: string[]) {
    try {
      const currentLabelsData = await getThreadLabels(this.db, threadId);
      const currentLabels = currentLabelsData.map((l) => l.id);

      const result = await modifyThreadLabels(this.db, threadId, addLabels, removeLabels);

      const allAffectedLabels = [...new Set([...addLabels, ...removeLabels])];
      await Promise.all(allAffectedLabels.map((label) => this.reloadFolder(label.toLowerCase())));

      await this.agent?.broadcastChatMessage({
        type: OutgoingMessageType.Mail_Get,
        threadId,
      });

      return {
        success: true,
        threadId,
        previousLabels: currentLabels,
        addedLabels: result.addedLabels,
        removedLabels: result.removedLabels,
      };
    } catch (error) {
      console.error('Failed to modify thread labels in database:', error);
      throw error;
    }
  }

  async getThreadFromDB(id: string, includeDrafts: boolean = false): Promise<IGetThreadResponse> {
    try {
      const result = await get(this.db, { id });
      if (!result) {
        await this.syncThread({ threadId: id });
        return {
          messages: [],
          latest: undefined,
          hasUnread: false,
          totalReplies: 0,
          labels: [],
        } satisfies IGetThreadResponse;
      }
      const storedThread = await this.env.THREADS_BUCKET.get(this.getThreadKey(id));

      let messages: ParsedMessage[] = storedThread
        ? (JSON.parse(await storedThread.text()) as IGetThreadResponse).messages
        : [];

      const isLatestDraft = messages.some((e) => e.isDraft === true);

      if (!includeDrafts) {
        messages = messages.filter((e) => e.isDraft !== true);
      }

      const labelsList = await getThreadLabels(this.db, id);
      const labelIds = labelsList.map((l) => l.id);

      return {
        messages,
        latest: messages.findLast((e) => e.isDraft !== true),
        hasUnread: labelIds.includes('UNREAD'),
        totalReplies: messages.filter((e) => e.isDraft !== true).length,
        labels: labelsList,
        isLatestDraft,
      } satisfies IGetThreadResponse;
    } catch (error) {
      console.error('Failed to get thread from database:', error);
      throw error;
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
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.getThreadsFromDB(params);
  }

  async get(id: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.getThreadFromDB(id);
  }

  async suggestRecipients(query: string = '', limit: number = 10) {
    const lower = query.toLowerCase();

    const hashRows = await this.db
      .select({ id: threads.id })
      .from(threads)
      .where(isNotNull(threads.latestSender))
      .orderBy(desc(threads.latestReceivedOn))
      .limit(100);

    const currentHash = hashRows.map((r) => r.id).join(',');

    if (!this.recipientCache || this.recipientCache.hash !== currentHash) {
      const rows = await this.db
        .select({
          latest_sender: threads.latestSender,
          latest_received_on: threads.latestReceivedOn,
        })
        .from(threads)
        .where(isNotNull(threads.latestSender))
        .orderBy(desc(threads.latestReceivedOn))
        .limit(100);

      const map = new Map<
        string,
        { email: string; name?: string | null; freq: number; last: number }
      >();

      for (const row of rows) {
        if (!row?.latest_sender) continue;

        let sender: { email?: string; name?: string } | null = null;

        try {
          const senderData = row.latest_sender;
          if (typeof senderData === 'string') {
            sender = JSON.parse(senderData);
          } else if (typeof senderData === 'object' && senderData !== null) {
            sender = senderData as { email?: string; name?: string };
          } else {
            sender = this.parseMalformedSender(String(senderData));
          }

          if (!sender) {
            console.error(
              '[SuggestRecipients] Failed to parse latest_sender, no fallback possible. Raw data:',
              row.latest_sender,
            );
            continue;
          }
        } catch (error) {
          sender = this.parseMalformedSender(String(row.latest_sender));
          if (!sender) {
            console.error(
              '[SuggestRecipients] Failed to parse latest_sender, no fallback possible:',
              error,
              'Raw data:',
              row.latest_sender,
            );
            continue;
          }
        }

        if (!sender?.email) continue;

        const key = sender.email.toLowerCase();
        const lastTs = row.latest_received_on
          ? new Date(String(row.latest_received_on)).getTime()
          : 0;

        if (!map.has(key)) {
          map.set(key, {
            email: sender.email,
            name: sender.name || null,
            freq: 1,
            last: lastTs,
          });
        } else {
          const entry = map.get(key)!;
          entry.freq += 1;
          if (lastTs > entry.last) entry.last = lastTs;
        }
      }

      this.recipientCache = {
        contacts: Array.from(map.values()),
        hash: currentHash,
      };
    }

    let contacts = this.recipientCache.contacts.slice();

    if (lower) {
      contacts = contacts.filter(
        (c) =>
          c.email.toLowerCase().includes(lower) || (c.name && c.name.toLowerCase().includes(lower)),
      );
    }

    contacts.sort((a, b) => b.freq - a.freq || b.last - a.last);

    return contacts.slice(0, limit).map((c) => ({
      email: c.email,
      name: c.name,
      displayText: c.name ? `${c.name} <${c.email}>` : c.email,
    }));
  }

  //   async get(id: string, includeDrafts: boolean = false) {
  //     if (!this.driver) {
  //       throw new Error('No driver available');
  //     }
  //     return await this.getThreadFromDB(id, includeDrafts);
  //   }

  public async storeThreadInDB(
    threadData: {
      id: string;
      threadId: string;
      providerId: string;
      latestSender: any;
      latestReceivedOn: string;
      latestSubject: string;
    },
    labelIds: string[],
  ): Promise<void> {
    try {
      await create(
        this.db,
        {
          id: threadData.id,
          threadId: threadData.threadId,
          providerId: threadData.providerId,
          latestSender: threadData.latestSender,
          latestReceivedOn: threadData.latestReceivedOn,
          latestSubject: threadData.latestSubject,
        },
        labelIds,
      );
      //   await sendDoState(this.name);
      console.log(`[ZeroDriver] Successfully stored thread ${threadData.id} in database`);
    } catch (error) {
      console.error(`[ZeroDriver] Failed to store thread ${threadData.id} in database:`, error);
      throw error;
    }
  }

  private async triggerSyncWorkflow(folder: string): Promise<void> {
    try {
      console.log(`[ZeroDriver] Triggering sync coordinator workflow for ${this.name}/${folder}`);

      const instance = await this.env.SYNC_THREADS_COORDINATOR_WORKFLOW.create({
        params: {
          connectionId: this.name,
          folder: folder,
        },
      });

      console.log(
        `[ZeroDriver] Sync coordinator workflow triggered for ${this.name}/${folder}, instance: ${instance.id}`,
      );
    } catch (error) {
      console.error(
        `[ZeroDriver] Failed to trigger sync coordinator workflow for ${this.name}/${folder}:`,
        error,
      );
      //   try {
      //     const fallbackInstance = await this.env.SYNC_THREADS_WORKFLOW.create({
      //       id: `${this.name}-${folder}`,
      //       params: {
      //         connectionId: this.name,
      //         folder: folder,
      //       },
      //     });
      //     console.log(`[ZeroDriver] Fallback to original workflow: ${fallbackInstance.id}`);
      //   } catch (fallbackError) {
      //     console.error(`[ZeroDriver] Fallback workflow also failed:`, fallbackError);
      //   }
    }
  }
}

export class ZeroAgent extends AIChatAgent<ZeroEnv> {
  private chatMessageAbortControllers: Map<string, AbortController> = new Map();

  async registerZeroMCP() {
    await this.mcp.connect(this.env.VITE_PUBLIC_BACKEND_URL + '/sse', {
      transport: {
        authProvider: new DurableObjectOAuthClientProvider(
          this.ctx.storage,
          'zero-mcp',
          this.env.VITE_PUBLIC_BACKEND_URL,
        ),
      },
    });
  }

  async registerThinkingMCP() {
    await this.mcp.connect(this.env.VITE_PUBLIC_BACKEND_URL + '/mcp/thinking/sse', {
      transport: {
        authProvider: new DurableObjectOAuthClientProvider(
          this.ctx.storage,
          'thinking-mcp',
          this.env.VITE_PUBLIC_BACKEND_URL,
        ),
      },
    });
  }

  onStart() {
    this.registerThinkingMCP();
  }

  async onConnect(connection: Connection): Promise<void> {
    connection.send(
      JSON.stringify({
        type: OutgoingMessageType.Mail_List,
        folder: 'inbox',
      }),
    );
  }

  async _reSyncThread({ threadId }: { threadId: string }) {
    await reSyncThread(this.name, threadId);
  }

  private getDataStreamResponse(
    onFinish: StreamTextOnFinishCallback<{}>,
    currentThreadId: string,
    currentFolder: string,
    currentFilter: string,
  ) {
    const dataStreamResponse = createDataStreamResponse({
      execute: async (dataStream) => {
        if (this.name === 'general') return;
        const connectionId = this.name;
        const orchestrator = new ToolOrchestrator(dataStream, connectionId);

        const mcpTools = this.mcp.unstable_getAITools();

        const rawTools = {
          ...(await authTools(connectionId)),
          ...mcpTools,
        };

        const tools = orchestrator.processTools(rawTools);
        const processedMessages = await processToolCalls(
          {
            messages: this.messages,
            dataStream,
            tools,
          },
          {},
        );

        const model =
          this.env.USE_OPENAI === 'true'
            ? groq('openai/gpt-oss-120b')
            : anthropic(this.env.OPENAI_MODEL || 'claude-3-7-sonnet-20250219');

        const result = streamText({
          model,
          maxSteps: 10,
          messages: processedMessages,
          tools,
          onFinish,
          onError: (error) => {
            console.error('Error in streamText', error);
          },
          system: await getPrompt(getPromptName(connectionId, EPrompts.Chat), AiChatPrompt(), {
            currentThreadId,
            currentFolder,
            currentFilter,
          }),
        });

        result.mergeIntoDataStream(dataStream);
      },
    });

    return dataStreamResponse;
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

          const chatMessageId = data.id;
          //   const abortSignal = this.getAbortSignal(chatMessageId);

          return this.tryCatchChat(async () => {
            const response = await this.onChatMessageWithContext(
              async ({ response }) => {
                const finalMessages = appendResponseMessages({
                  messages,
                  responseMessages: response.messages,
                });

                await this.persistMessages(finalMessages, [connection.id]);
                this.removeAbortController(chatMessageId);
              },
              threadId,
              currentFolder,
              currentFilter,
            );

            if (response) {
              await this.reply(data.id, response);
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
          this.destroyAbortControllers();
          void this.sql`delete from cf_ai_chat_agent_messages`;
          this.messages = [];
          this.broadcastChatMessage(
            {
              type: OutgoingMessageType.ChatClear,
            },
            [connection.id],
          );
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
      for await (const chunk of response.body!) {
        const body = decoder.decode(chunk);

        this.broadcastChatMessage({
          id,
          type: OutgoingMessageType.UseChatResponse,
          body,
          done: false,
        });
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

  async getCachedDoState(): Promise<{
    storageSize: number;
    counts: { label: string; count: number }[];
    shards: number;
    timestamp: number;
  } | null> {
    try {
      const cached = await this.ctx.storage.get('do_state_cache');
      if (!cached) return null;

      const data = cached as any;
      const now = Date.now();
      const CACHE_TTL = 5 * 60 * 1000;

      if (now - data.timestamp > CACHE_TTL) {
        await this.ctx.storage.delete('do_state_cache');
        return null;
      }

      return data;
    } catch (error) {
      console.error('[ZeroAgent] Failed to get cached DO state:', error);
      return null;
    }
  }

  async setCachedDoState(
    storageSize: number,
    counts: { label: string; count: number }[],
    shards: number,
  ): Promise<void> {
    try {
      const data = {
        storageSize,
        counts,
        shards,
        timestamp: Date.now(),
      };
      await this.ctx.storage.put('do_state_cache', data);
    } catch (error) {
      console.error('[ZeroAgent] Failed to cache DO state:', error);
    }
  }

  async invalidateDoStateCache(): Promise<void> {
    try {
      await this.ctx.storage.delete('do_state_cache');
    } catch (error) {
      console.error('[ZeroAgent] Failed to invalidate DO state cache:', error);
    }
  }

  async onChatMessageWithContext(
    onFinish: StreamTextOnFinishCallback<{}>,
    currentThreadId: string,
    currentFolder: string,
    currentFilter: string,
  ) {
    return this.getDataStreamResponse(onFinish, currentThreadId, currentFolder, currentFilter);
  }
}
