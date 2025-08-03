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
import { generateWhatUserCaresAbout, type UserTopic } from '../../lib/analyze/interests';
import { DurableObjectOAuthClientProvider } from 'agents/mcp/do-oauth-client-provider';
import { AiChatPrompt, GmailSearchAssistantSystemPrompt } from '../../lib/prompts';
import { connectionToDriver, getZeroSocketAgent } from '../../lib/server-utils';
import { Migratable, Queryable, Transfer } from 'dormroom';
import type { CreateDraftData } from '../../lib/schemas';
import { withRetry } from '../../lib/gmail-rate-limit';
import { getPrompt } from '../../pipelines.effect';
import { AIChatAgent } from 'agents/ai-chat-agent';
import { ToolOrchestrator } from './orchestrator';
import { getPromptName } from '../../pipelines';
import { Agent, type Connection } from 'agents';
import { anthropic } from '@ai-sdk/anthropic';
import { env, type ZeroEnv } from '../../env';
import { connection } from '../../db/schema';
import type { WSMessage } from 'partyserver';
import { tools as authTools } from './tools';
import { processToolCalls } from './utils';
import { openai } from '@ai-sdk/openai';
import { createDb } from '../../db';
import { DriverRpcDO } from './rpc';
import type { Message } from 'ai';
import { eq } from 'drizzle-orm';
import { Effect } from 'effect';

const decoder = new TextDecoder();

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
  },
})
@Queryable()
export class ZeroDriver extends Agent<ZeroEnv> {
  transfer = new Transfer(this);
  private foldersInSync: Map<string, boolean> = new Map();
  private syncThreadsInProgress: Map<string, boolean> = new Map();
  private driver: MailManager | null = null;
  private agent: DurableObjectStub<ZeroAgent> | null = null;
  constructor(ctx: DurableObjectState, env: ZeroEnv) {
    super(ctx, env);
    if (shouldDropTables) this.dropTables();
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

  async setMetaData(connectionId: string) {
    await this.setName(connectionId);
    this.agent = await getZeroSocketAgent(connectionId);
    return new DriverRpcDO(this, connectionId);
  }

  async markAsRead(threadIds: string[]) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.markAsRead(threadIds);
  }

  async markAsUnread(threadIds: string[]) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.markAsUnread(threadIds);
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
    return await this.driver.sendDraft(id, data);
  }

  async create(data: IOutgoingMessage) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.create(data);
  }

  async delete(id: string) {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.delete(id);
  }

  async deleteAllSpam() {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.deleteAllSpam();
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

  async onConnect() {
    if (!this.driver) await this.setupAuth();
  }

  public async setupAuth() {
    if (this.name === 'general') return;
    if (!this.driver) {
      this.agent = await getZeroSocketAgent(this.name);
      const { db, conn } = createDb(this.env.HYPERDRIVE.connectionString);
      const _connection = await db.query.connection.findFirst({
        where: eq(connection.id, this.name),
      });
      if (_connection) this.driver = connectionToDriver(_connection);
      this.ctx.waitUntil(conn.end());
    }
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

  // Additional mail operations
  async count() {
    if (!this.driver) {
      throw new Error('No driver available');
    }
    return await this.driver.count();
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
        const threadData = yield* Effect.tryPromise(() => this.getWithRetry(threadId)).pipe(
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

        const latest = threadData.latest;

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
            return Effect.succeed(undefined);
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
            updated_at
          ) VALUES (
            ${threadId},
            ${threadId},
            'google',
            ${JSON.stringify(latest.sender)},
            ${normalizedReceivedOn},
            ${latest.subject},
            ${JSON.stringify(latest.tags.map((tag) => tag.id))},
            CURRENT_TIMESTAMP
          )
        `),
        ).pipe(
          Effect.tap(() =>
            Effect.sync(() => console.log(`[syncThread] Updated database for ${threadId}`)),
          ),
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

      // Build WHERE conditions
      const whereConditions: string[] = [];

      // Add folder condition (maps to specific label)
      if (folder) {
        const folderLabel = folder.toUpperCase();
        whereConditions.push(`EXISTS (
            SELECT 1 FROM json_each(latest_label_ids) WHERE value = '${folderLabel}'
          )`);
      }

      // Add label conditions (OR logic for multiple labels)
      if (labelIds.length > 0) {
        if (labelIds.length === 1) {
          whereConditions.push(`EXISTS (
              SELECT 1 FROM json_each(latest_label_ids) WHERE value = '${labelIds[0]}'
            )`);
        } else {
          // Multiple labels with OR logic
          const multiLabelCondition = labelIds
            .map(
              (labelId) =>
                `EXISTS (SELECT 1 FROM json_each(latest_label_ids) WHERE value = '${labelId}')`,
            )
            .join(' OR ');
          whereConditions.push(`(${multiLabelCondition})`);
        }
      }

      //   // Add search query condition
      if (q) {
        const searchTerm = q.replace(/'/g, "''"); // Escape single quotes
        whereConditions.push(`(
            latest_subject LIKE '%${searchTerm}%' OR
            latest_sender LIKE '%${searchTerm}%'
          )`);
      }

      // Add cursor condition
      if (pageToken) {
        whereConditions.push(`latest_received_on < '${pageToken}'`);
      }

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
        if (condition.includes('latest_received_on <')) {
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
      return await this.modifyThreadLabelsInDB(threadId, addLabelIds, removeLabelIds);
    } catch (error) {
      console.error('Failed to modify thread labels by name:', error);
      throw error;
    }
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
        await this.queue('syncThread', { threadId: id });
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

      let messages: ParsedMessage[] = storedThread
        ? (JSON.parse(await storedThread.text()) as IGetThreadResponse).messages
        : [];

      const isLatestDraft = messages.some((e) => e.isDraft === true);

      if (!includeDrafts) {
        messages = messages.filter((e) => e.isDraft !== true);
      }

      const latestLabelIds = JSON.parse(row.latest_label_ids || '[]');

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

  //   async get(id: string, includeDrafts: boolean = false) {
  //     if (!this.driver) {
  //       throw new Error('No driver available');
  //     }
  //     return await this.getThreadFromDB(id, includeDrafts);
  //   }
}

export class ZeroAgent extends AIChatAgent<ZeroEnv> {
  private chatMessageAbortControllers: Map<string, AbortController> = new Map();
  private connectionThreadIds: Map<string, string | null> = new Map();

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

  onStart(): void | Promise<void> {
    this.registerThinkingMCP();
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
            ? openai(this.env.OPENAI_MODEL || 'gpt-4o')
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

  async onChatMessageWithContext(
    onFinish: StreamTextOnFinishCallback<{}>,
    currentThreadId: string,
    currentFolder: string,
    currentFilter: string,
  ) {
    return this.getDataStreamResponse(onFinish, currentThreadId, currentFolder, currentFilter);
  }
}
