/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  createDefaultWorkflows,
  type WorkflowContext,
} from './thread-workflow-utils/workflow-engine';
import { getServiceAccount } from './lib/factories/google-subscription.factory';
import { getThread, getZeroAgent } from './lib/server-utils';
import { DurableObject } from 'cloudflare:workers';
import { bulkDeleteKeys } from './lib/bulk-delete';
import { type gmail_v1 } from '@googleapis/gmail';
import { Effect, Console, Logger } from 'effect';
import { connection } from './db/schema';
import { EProviders } from './types';
import type { ZeroEnv } from './env';
import { initTracing } from './lib/tracing';
import { EPrompts } from './types';
import { eq } from 'drizzle-orm';
import { createDb } from './db';

// Configure pretty logger to stderr
export const loggerLayer = Logger.add(Logger.prettyLogger({ stderr: true }));

const isValidUUID = (str: string): boolean => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(str);
};

const validateArguments = (
  params: MainWorkflowParams,
  serviceAccount: { project_id: string },
): Effect.Effect<string, MainWorkflowError> =>
  Effect.gen(function* () {
    yield* Console.log('[MAIN_WORKFLOW] Validating arguments');
    const regex = new RegExp(
      `projects/${serviceAccount.project_id}/subscriptions/notifications__([a-z0-9-]+)`,
    );
    const match = params.subscriptionName.toString().match(regex);
    if (!match) {
      yield* Console.log('[MAIN_WORKFLOW] Invalid subscription name:', params.subscriptionName);
      return yield* Effect.fail({
        _tag: 'InvalidSubscriptionName' as const,
        subscriptionName: params.subscriptionName,
      });
    }
    const [, connectionId] = match;
    yield* Console.log('[MAIN_WORKFLOW] Extracted connectionId:', connectionId);
    return connectionId;
  });

// Helper function for generating prompt names
export const getPromptName = (connectionId: string, prompt: EPrompts) => {
  return `${connectionId}-${prompt}`;
};

export type ZeroWorkflowParams = {
  connectionId: string;
  historyId: string;
  nextHistoryId: string;
};

export type ThreadWorkflowParams = {
  connectionId: string;
  threadId: string;
  providerId: string;
};

export type MainWorkflowParams = {
  providerId: string;
  historyId: string;
  subscriptionName: string;
};

export enum EWorkflowType {
  MAIN = 'main',
  THREAD = 'thread',
  ZERO = 'zero',
}

export type WorkflowParams =
  | { workflowType: 'main'; params: MainWorkflowParams }
  | { workflowType: 'thread'; params: ThreadWorkflowParams }
  | { workflowType: 'zero'; params: ZeroWorkflowParams };

export type MainWorkflowError =
  | { _tag: 'MissingEnvironmentVariable'; variable: string }
  | { _tag: 'InvalidSubscriptionName'; subscriptionName: string }
  | { _tag: 'InvalidConnectionId'; connectionId: string }
  | { _tag: 'UnsupportedProvider'; providerId: string }
  | { _tag: 'WorkflowCreationFailed'; error: unknown };

export type ZeroWorkflowError =
  | { _tag: 'HistoryAlreadyProcessing'; connectionId: string; historyId: string }
  | { _tag: 'ConnectionNotFound'; connectionId: string }
  | { _tag: 'ConnectionNotAuthorized'; connectionId: string }
  | { _tag: 'HistoryNotFound'; historyId: string; connectionId: string }
  | { _tag: 'UnsupportedProvider'; providerId: string }
  | { _tag: 'DatabaseError'; error: unknown }
  | { _tag: 'GmailApiError'; error: unknown }
  | { _tag: 'WorkflowCreationFailed'; error: unknown }
  | { _tag: 'LabelModificationFailed'; error: unknown; threadId: string };

export type ThreadWorkflowError =
  | { _tag: 'ConnectionNotFound'; connectionId: string }
  | { _tag: 'ConnectionNotAuthorized'; connectionId: string }
  | { _tag: 'ThreadNotFound'; threadId: string }
  | { _tag: 'UnsupportedProvider'; providerId: string }
  | { _tag: 'DatabaseError'; error: unknown }
  | { _tag: 'GmailApiError'; error: unknown }
  | { _tag: 'VectorizationError'; error: unknown }
  | { _tag: 'WorkflowCreationFailed'; error: unknown };

export type UnsupportedWorkflowError = { _tag: 'UnsupportedWorkflow'; workflowType: never };

export type WorkflowError =
  | MainWorkflowError
  | ZeroWorkflowError
  | ThreadWorkflowError
  | UnsupportedWorkflowError;

export class WorkflowRunner extends DurableObject<ZeroEnv> {
  constructor(state: DurableObjectState, env: ZeroEnv) {
    super(state, env);
  }

  /**
   * This function runs the main workflow. The main workflow is responsible for processing incoming messages from a Pub/Sub subscription and passing them to the appropriate pipeline.
   * It validates the subscription name and extracts the connection ID.
   * @param params
   * @returns
   */
  public runMainWorkflow(params: MainWorkflowParams) {
    const tracer = initTracing();
    const span = tracer.startSpan('workflow_main', {
      attributes: {
        'provider.id': params.providerId,
        'history.id': params.historyId,
        'subscription.name': params.subscriptionName
      }
    });

    return Effect.gen(this, function* () {
      yield* Console.log('[MAIN_WORKFLOW] Starting workflow with payload:', params);

      const { providerId, historyId } = params;

      const serviceAccount = getServiceAccount();

      const connectionId = yield* validateArguments(params, serviceAccount);
      span.setAttributes({ 'connection.id': connectionId });

      if (!isValidUUID(connectionId)) {
        yield* Console.log('[MAIN_WORKFLOW] Invalid connection id format:', connectionId);
        span.setAttributes({ 'error.type': 'invalid_connection_id' });
        return yield* Effect.fail({
          _tag: 'InvalidConnectionId' as const,
          connectionId,
        });
      }

      const previousHistoryId = yield* Effect.tryPromise({
        try: () => this.env.gmail_history_id.get(connectionId),
        catch: () => ({
          _tag: 'WorkflowCreationFailed' as const,
          error: 'Failed to get history ID',
        }),
      }).pipe(Effect.orElse(() => Effect.succeed(null)));

      span.setAttributes({ 'history.previous_id': previousHistoryId || 'none' });

      if (providerId === EProviders.google) {
        yield* Console.log('[MAIN_WORKFLOW] Processing Google provider workflow');
        yield* Console.log('[MAIN_WORKFLOW] Previous history ID:', previousHistoryId);

        const zeroWorkflowParams = {
          connectionId,
          historyId: previousHistoryId || historyId,
          nextHistoryId: historyId,
        };

        const result = yield* Effect.tryPromise({
          try: () => this.runZeroWorkflow(zeroWorkflowParams),
          catch: (error) => ({ _tag: 'WorkflowCreationFailed' as const, error }),
        });

        yield* Console.log('[MAIN_WORKFLOW] Zero workflow result:', result);
        span.setAttributes({ 'workflow.result': typeof result === 'string' ? result : JSON.stringify(result) });
      } else {
        yield* Console.log('[MAIN_WORKFLOW] Unsupported provider:', providerId);
        span.setAttributes({ 'error.type': 'unsupported_provider' });
        return yield* Effect.fail({
          _tag: 'UnsupportedProvider' as const,
          providerId,
        });
      }

      yield* Console.log('[MAIN_WORKFLOW] Workflow completed successfully');
      span.setAttributes({ 'workflow.success': true });
      return 'Workflow completed successfully';
    }).pipe(
      Effect.tap(() => Effect.sync(() => span.end())),
      Effect.tapError((error) => Effect.sync(() => {
        span.recordException(error as unknown as Error);
        span.setStatus({ code: 2, message: String(error) });
        span.end();
      })),
      Effect.tapError((error) => Console.log('[MAIN_WORKFLOW] Error in workflow:', error)),
      Effect.provide(loggerLayer),
      Effect.runPromise,
    );
  }

  public runZeroWorkflow(params: ZeroWorkflowParams) {
    return Effect.gen(this, function* () {
      yield* Console.log('[ZERO_WORKFLOW] Starting workflow with payload:', params);
      const { connectionId, historyId, nextHistoryId } = params;

      const historyProcessingKey = `history_${connectionId}__${historyId}`;
      const keysToDelete: string[] = [];

      // Atomic lock acquisition to prevent race conditions
      const lockAcquired = yield* Effect.tryPromise({
        try: async () => {
          const response = await this.env.gmail_processing_threads.put(
            historyProcessingKey,
            'true',
            {
              expirationTtl: 3600,
            },
          );
          return response !== null; // null means key already existed
        },
        catch: (error) => ({ _tag: 'WorkflowCreationFailed' as const, error }),
      });

      if (!lockAcquired) {
        yield* Console.log('[ZERO_WORKFLOW] History already being processed:', {
          connectionId,
          historyId,
        });
        return yield* Effect.fail({
          _tag: 'HistoryAlreadyProcessing' as const,
          connectionId,
          historyId,
        });
      }

      yield* Console.log(
        '[ZERO_WORKFLOW] Acquired processing lock for history:',
        historyProcessingKey,
      );

      const { db, conn } = createDb(this.env.HYPERDRIVE.connectionString);

      const foundConnection = yield* Effect.tryPromise({
        try: async () => {
          console.log('[ZERO_WORKFLOW] Finding connection:', connectionId);
          const [foundConnection] = await db
            .select()
            .from(connection)
            .where(eq(connection.id, connectionId.toString()));
          await conn.end();
          if (!foundConnection) {
            throw new Error(`Connection not found ${connectionId}`);
          }
          if (!foundConnection.accessToken || !foundConnection.refreshToken) {
            throw new Error(`Connection is not authorized ${connectionId}`);
          }
          console.log('[ZERO_WORKFLOW] Found connection:', foundConnection.id);
          return foundConnection;
        },
        catch: (error) => ({ _tag: 'DatabaseError' as const, error }),
      });

      yield* Effect.tryPromise({
        try: async () => conn.end(),
        catch: (error) => ({ _tag: 'DatabaseError' as const, error }),
      });

      const agent = yield* Effect.tryPromise({
        try: async () => {
          const { stub: agent } = await getZeroAgent(foundConnection.id);
          return agent;
        },
        catch: (error) => ({ _tag: 'DatabaseError' as const, error }),
      });

      if (foundConnection.providerId === EProviders.google) {
        yield* Console.log('[ZERO_WORKFLOW] Processing Google provider workflow');

        const history = yield* Effect.tryPromise({
          try: async () => {
            console.log('[ZERO_WORKFLOW] Getting Gmail history with ID:', historyId);
            const { history } = (await agent.listHistory(historyId.toString())) as {
              history: gmail_v1.Schema$History[];
            };
            console.log('[ZERO_WORKFLOW] Found history entries:', history);
            return history;
          },
          catch: (error) => ({ _tag: 'GmailApiError' as const, error }),
        });

        yield* Effect.tryPromise({
          try: () => {
            console.log('[ZERO_WORKFLOW] Updating next history ID:', nextHistoryId);
            return this.env.gmail_history_id.put(connectionId.toString(), nextHistoryId.toString());
          },
          catch: (error) => ({ _tag: 'WorkflowCreationFailed' as const, error }),
        });

        if (!history.length) {
          yield* Console.log('[ZERO_WORKFLOW] No history found, skipping');
          // Add the history processing key to cleanup list
          keysToDelete.push(historyProcessingKey);
          return 'No history found';
        }

        // Extract thread IDs from history and track label changes
        const threadsAdded = new Set<string>();
        const threadLabelChanges = new Map<
          string,
          { addLabels: Set<string>; removeLabels: Set<string> }
        >();

        // Optimal single-pass functional processing
        const processLabelChange = (
          labelChange: { message?: gmail_v1.Schema$Message; labelIds?: string[] | null },
          isAddition: boolean,
        ) => {
          const threadId = labelChange.message?.threadId;
          if (!threadId || !labelChange.labelIds?.length) return;

          let changes = threadLabelChanges.get(threadId);
          if (!changes) {
            changes = { addLabels: new Set<string>(), removeLabels: new Set<string>() };
            threadLabelChanges.set(threadId, changes);
          }

          const targetSet = isAddition ? changes.addLabels : changes.removeLabels;
          labelChange.labelIds.forEach((labelId) => targetSet.add(labelId));
        };

        history.forEach((historyItem) => {
          // Extract thread IDs from messages
          historyItem.messagesAdded?.forEach((msg) => {
            if (msg.message?.labelIds?.includes('DRAFT')) return;
            // if (msg.message?.labelIds?.includes('SPAM')) return;
            if (msg.message?.threadId) {
              threadsAdded.add(msg.message.threadId);
            }
          });

          // Process label changes using shared helper
          historyItem.labelsAdded?.forEach((labelAdded) => processLabelChange(labelAdded, true));
          historyItem.labelsRemoved?.forEach((labelRemoved) =>
            processLabelChange(labelRemoved, false),
          );
        });

        yield* Console.log(
          '[ZERO_WORKFLOW] Found unique thread IDs:',
          Array.from(threadLabelChanges.keys()),
          Array.from(threadsAdded),
        );

        if (threadsAdded.size > 0) {
          const threadWorkflowParams = Array.from(threadsAdded);

          // Sync threads with proper error handling - use allSuccesses to collect successful syncs
          const syncResults = yield* Effect.allSuccesses(
            threadWorkflowParams.map((threadId) =>
              Effect.tryPromise({
                try: async () => {
                  const result = await agent.syncThread({ threadId });
                  console.log(`[ZERO_WORKFLOW] Successfully synced thread ${threadId}`);
                  return { threadId, result };
                },
                catch: (error) => {
                  console.error(`[ZERO_WORKFLOW] Failed to sync thread ${threadId}:`, error);
                  // Let this effect fail so allSuccesses will exclude it
                  throw new Error(
                    `Failed to sync thread ${threadId}: ${error instanceof Error ? error.message : String(error)}`,
                  );
                },
              }),
            ),
            { concurrency: 6 }, // Limit concurrency to avoid rate limits
          );

          const syncedCount = syncResults.filter((result) => result.result.success).length;
          const failedCount = threadWorkflowParams.length - syncedCount;

          if (failedCount > 0) {
            yield* Console.log(
              `[ZERO_WORKFLOW] Warning: ${failedCount}/${threadWorkflowParams.length} thread syncs failed. Successfully synced: ${syncedCount}`,
            );
            // Continue with processing - sync failures shouldn't stop the entire workflow
            // The thread processing will continue with whatever data is available
          } else {
            yield* Console.log(`[ZERO_WORKFLOW] Successfully synced all ${syncedCount} threads`);
          }

          yield* Console.log('[ZERO_WORKFLOW] Synced threads:', syncResults);

          // Run thread workflow for each successfully synced thread
          if (syncedCount > 0) {
            yield* Effect.tryPromise({
              try: () => agent.reloadFolder('inbox'),
              catch: (error) => ({ _tag: 'GmailApiError' as const, error }),
            }).pipe(
              Effect.tap(() => Console.log('[ZERO_WORKFLOW] Successfully reloaded inbox folder')),
              Effect.orElse(() =>
                Effect.gen(function* () {
                  yield* Console.log('[ZERO_WORKFLOW] Failed to reload inbox folder');
                  return undefined;
                }),
              ),
            );

            yield* Console.log(
              `[ZERO_WORKFLOW] Running thread workflows for ${syncedCount} synced threads`,
            );

            const threadWorkflowResults = yield* Effect.allSuccesses(
              syncResults.map(({ threadId }) =>
                this.runThreadWorkflow({
                  connectionId,
                  threadId,
                  providerId: foundConnection.providerId,
                }).pipe(
                  Effect.tap(() =>
                    Console.log(`[ZERO_WORKFLOW] Successfully ran thread workflow for ${threadId}`),
                  ),
                  Effect.tapError((error) =>
                    Console.log(
                      `[ZERO_WORKFLOW] Failed to run thread workflow for ${threadId}:`,
                      error,
                    ),
                  ),
                ),
              ),
              { concurrency: 6 }, // Limit concurrency to avoid overwhelming the system
            );

            const threadWorkflowSuccessCount = threadWorkflowResults.length;
            const threadWorkflowFailedCount = syncedCount - threadWorkflowSuccessCount;

            if (threadWorkflowFailedCount > 0) {
              yield* Console.log(
                `[ZERO_WORKFLOW] Warning: ${threadWorkflowFailedCount}/${syncedCount} thread workflows failed. Successfully processed: ${threadWorkflowSuccessCount}`,
              );
            } else {
              yield* Console.log(
                `[ZERO_WORKFLOW] Successfully ran all ${threadWorkflowSuccessCount} thread workflows`,
              );
            }
          }
        } else {
          yield* Console.log('[ZERO_WORKFLOW] No new threads to process');
        }

        // Process label changes for threads
        if (threadLabelChanges.size > 0) {
          yield* Console.log(
            `[ZERO_WORKFLOW] Processing label changes for ${threadLabelChanges.size} threads`,
          );

          // Process each thread's label changes
          for (const [threadId, changes] of threadLabelChanges) {
            const addLabels = Array.from(changes.addLabels);
            const removeLabels = Array.from(changes.removeLabels);

            // Only call if there are actual changes to make
            if (addLabels.length > 0 || removeLabels.length > 0) {
              yield* Console.log(
                `[ZERO_WORKFLOW] Modifying labels for thread ${threadId}: +${addLabels.length} -${removeLabels.length}`,
              );
              yield* Effect.tryPromise({
                try: () => agent.modifyThreadLabelsInDB(threadId, addLabels, removeLabels),
                catch: (error) => ({ _tag: 'LabelModificationFailed' as const, error, threadId }),
              }).pipe(
                Effect.orElse(() =>
                  Effect.gen(function* () {
                    yield* Console.log(
                      `[ZERO_WORKFLOW] Failed to modify labels for thread ${threadId}`,
                    );
                    return undefined;
                  }),
                ),
              );
            }
          }

          yield* Console.log('[ZERO_WORKFLOW] Completed label modifications');
        } else {
          yield* Console.log('[ZERO_WORKFLOW] No threads with label changes to process');
        }

        // Add history processing key to cleanup list
        keysToDelete.push(historyProcessingKey);

        // Bulk delete all collected keys
        if (keysToDelete.length > 0) {
          yield* Effect.tryPromise({
            try: async () => {
              console.log('[ZERO_WORKFLOW] Bulk deleting keys:', keysToDelete);
              const result = await bulkDeleteKeys(keysToDelete);
              console.log('[ZERO_WORKFLOW] Bulk delete result:', result);
              return result;
            },
            catch: (error) => ({ _tag: 'WorkflowCreationFailed' as const, error }),
          }).pipe(
            Effect.orElse(() => Effect.succeed({ successful: 0, failed: keysToDelete.length })),
          );
        }

        yield* Console.log('[ZERO_WORKFLOW] Processing complete');
        return 'Zero workflow completed successfully';
      } else {
        yield* Console.log('[ZERO_WORKFLOW] Unsupported provider:', foundConnection.providerId);
        return yield* Effect.fail({
          _tag: 'UnsupportedProvider' as const,
          providerId: foundConnection.providerId,
        });
      }
    }).pipe(
      Effect.tapError((error) => Console.log('[ZERO_WORKFLOW] Error in workflow:', error)),
      Effect.catchAll((error) => {
        // Clean up processing flag on error using bulk delete
        return Effect.tryPromise({
          try: async () => {
            const errorCleanupKey = `history_${params.connectionId}__${params.historyId}`;
            console.log(
              '[ZERO_WORKFLOW] Clearing processing flag for history after error:',
              errorCleanupKey,
            );
            const result = await bulkDeleteKeys([errorCleanupKey]);
            console.log('[ZERO_WORKFLOW] Error cleanup result:', result);
            return result;
          },
          catch: () => ({
            _tag: 'WorkflowCreationFailed' as const,
            error: 'Failed to cleanup processing flag',
          }),
        }).pipe(
          Effect.orElse(() => Effect.succeed({ successful: 0, failed: 1 })),
          Effect.flatMap(() => Effect.fail(error)),
        );
      }),
      Effect.provide(loggerLayer),
      Effect.runPromise,
    );
  }

  public runThreadWorkflow(params: ThreadWorkflowParams) {
    return Effect.gen(this, function* () {
      yield* Console.log('[THREAD_WORKFLOW] Starting workflow with payload:', params);
      const { connectionId, threadId, providerId } = params;
      const keysToDelete: string[] = [];

      if (providerId === EProviders.google) {
        yield* Console.log('[THREAD_WORKFLOW] Processing Google provider workflow');
        const { db, conn } = createDb(this.env.HYPERDRIVE.connectionString);

        const foundConnection = yield* Effect.tryPromise({
          try: async () => {
            console.log('[THREAD_WORKFLOW] Finding connection:', connectionId);
            const [foundConnection] = await db
              .select()
              .from(connection)
              .where(eq(connection.id, connectionId.toString()));
            if (!foundConnection) {
              throw new Error(`Connection not found ${connectionId}`);
            }
            if (!foundConnection.accessToken || !foundConnection.refreshToken) {
              throw new Error(`Connection is not authorized ${connectionId}`);
            }
            console.log('[THREAD_WORKFLOW] Found connection:', foundConnection.id);
            return foundConnection;
          },
          catch: (error) => ({ _tag: 'DatabaseError' as const, error }),
        });

        yield* Effect.tryPromise({
          try: async () => conn.end(),
          catch: (error) => ({ _tag: 'DatabaseError' as const, error }),
        });

        const thread = yield* Effect.tryPromise({
          try: async () => {
            console.log('[THREAD_WORKFLOW] Getting thread:', threadId);
            const { result: thread } = await getThread(foundConnection.id, threadId.toString());
            console.log('[THREAD_WORKFLOW] Found thread with messages:', thread.messages.length);
            return thread;
          },
          catch: (error) => ({ _tag: 'GmailApiError' as const, error }),
        });

        if (!thread.messages || thread.messages.length === 0) {
          yield* Console.log('[THREAD_WORKFLOW] Thread has no messages, skipping processing');
          // Add thread processing key to cleanup list
          keysToDelete.push(threadId.toString());
          return 'Thread has no messages';
        }

        // Initialize workflow engine with default workflows
        const workflowEngine = createDefaultWorkflows();

        // Create workflow context
        const workflowContext: WorkflowContext = {
          connectionId: connectionId.toString(),
          threadId: threadId.toString(),
          thread,
          foundConnection,
          results: new Map<string, unknown>(),
          env: this.env,
        };

        // Execute configured workflows using the workflow engine
        const workflowResults = yield* Effect.tryPromise({
          try: async () => {
            // Execute all workflows registered in the engine
            const workflowNames = workflowEngine.getWorkflowNames();

            const { results, errors } = await workflowEngine.executeWorkflowChain(
              workflowNames,
              workflowContext,
            );

            return { results, errors };
          },
          catch: (error) => ({ _tag: 'WorkflowCreationFailed' as const, error }),
        });

        // Clear workflow context after execution
        workflowEngine.clearContext(workflowContext);

        // Log workflow results
        const successfulSteps = Array.from(workflowResults.results.keys());
        const failedSteps = Array.from(workflowResults.errors.keys());

        if (successfulSteps.length > 0) {
          yield* Console.log('[THREAD_WORKFLOW] Successfully executed steps:', successfulSteps);
        }

        if (failedSteps.length > 0) {
          yield* Console.log('[THREAD_WORKFLOW] Failed steps:', failedSteps);
          // Log errors efficiently using forEach to avoid nested iteration
          workflowResults.errors.forEach((error, stepId) => {
            console.log(`[THREAD_WORKFLOW] Error in step ${stepId}:`, error.message);
          });
        }

        // Add thread processing key to cleanup list
        keysToDelete.push(threadId.toString());

        // Bulk delete all collected keys
        if (keysToDelete.length > 0) {
          yield* Effect.tryPromise({
            try: async () => {
              console.log('[THREAD_WORKFLOW] Bulk deleting keys:', keysToDelete);
              const result = await bulkDeleteKeys(keysToDelete);
              console.log('[THREAD_WORKFLOW] Bulk delete result:', result);
              return result;
            },
            catch: (error) => ({ _tag: 'DatabaseError' as const, error }),
          }).pipe(
            Effect.orElse(() => Effect.succeed({ successful: 0, failed: keysToDelete.length })),
          );
        }

        yield* Console.log('[THREAD_WORKFLOW] Thread processing complete');
        return 'Thread workflow completed successfully';
      } else {
        yield* Console.log('[THREAD_WORKFLOW] Unsupported provider:', providerId);
        return yield* Effect.fail({
          _tag: 'UnsupportedProvider' as const,
          providerId,
        });
      }
    }).pipe(
      Effect.tapError((error) => Console.log('[THREAD_WORKFLOW] Error in workflow:', error)),
      Effect.catchAll((error) => {
        // Clean up thread processing flag on error using bulk delete
        return Effect.tryPromise({
          try: async () => {
            console.log(
              '[THREAD_WORKFLOW] Clearing processing flag for thread after error:',
              params.threadId,
            );
            const result = await bulkDeleteKeys([params.threadId.toString()]);
            console.log('[THREAD_WORKFLOW] Error cleanup result:', result);
            return result;
          },
          catch: () => ({
            _tag: 'DatabaseError' as const,
            error: 'Failed to cleanup thread processing flag',
          }),
        }).pipe(
          Effect.orElse(() => Effect.succeed({ successful: 0, failed: 1 })),
          Effect.flatMap(() => Effect.fail(error)),
        );
      }),
      Effect.provide(loggerLayer),
    );
  }

  /** Testing workflows without Effect */
  public runThreadWorkflowWithoutEffect(params: ThreadWorkflowParams): Promise<string> {
    return this.runThreadWorkflowWithoutEffectImpl(params);
  }

  private async runThreadWorkflowWithoutEffectImpl(params: ThreadWorkflowParams): Promise<string> {
    try {
      console.log('[THREAD_WORKFLOW] Starting workflow with payload:', params);
      const { connectionId, threadId, providerId } = params;
      const keysToDelete: string[] = [];

      if (providerId === EProviders.google) {
        console.log('[THREAD_WORKFLOW] Processing Google provider workflow');
        const { db, conn } = createDb(this.env.HYPERDRIVE.connectionString);

        let foundConnection;
        try {
          console.log('[THREAD_WORKFLOW] Finding connection:', connectionId);
          const [connectionRecord] = await db
            .select()
            .from(connection)
            .where(eq(connection.id, connectionId.toString()));

          if (!connectionRecord) {
            throw new Error(`Connection not found ${connectionId}`);
          }
          if (!connectionRecord.accessToken || !connectionRecord.refreshToken) {
            throw new Error(`Connection is not authorized ${connectionId}`);
          }
          console.log('[THREAD_WORKFLOW] Found connection:', connectionRecord.id);
          foundConnection = connectionRecord;
        } catch (error) {
          console.error('[THREAD_WORKFLOW] Database error:', error);
          throw { _tag: 'DatabaseError' as const, error };
        } finally {
          try {
            await conn.end();
          } catch (error) {
            console.error('[THREAD_WORKFLOW] Failed to close connection:', error);
          }
        }

        let thread;
        try {
          console.log('[THREAD_WORKFLOW] Getting thread:', threadId);
          const { result } = await getThread(connectionId.toString(), threadId.toString());
          console.log('[THREAD_WORKFLOW] Found thread with messages:', result.messages.length);
          thread = result;
        } catch (error) {
          console.error('[THREAD_WORKFLOW] Gmail API error:', error);
          throw { _tag: 'GmailApiError' as const, error };
        }

        if (!thread.messages || thread.messages.length === 0) {
          console.log('[THREAD_WORKFLOW] Thread has no messages, skipping processing');
          keysToDelete.push(threadId.toString());
          return 'Thread has no messages';
        }

        const workflowEngine = createDefaultWorkflows();

        const workflowContext: WorkflowContext = {
          connectionId: connectionId.toString(),
          threadId: threadId.toString(),
          thread,
          foundConnection,
          results: new Map<string, unknown>(),
          env: this.env,
        };

        let workflowResults;
        try {
          const allResults = new Map<string, unknown>();
          const allErrors = new Map<string, Error>();

          const workflowNames = workflowEngine.getWorkflowNames();

          for (const workflowName of workflowNames) {
            console.log(`[THREAD_WORKFLOW] Executing workflow: ${workflowName}`);

            try {
              const { results, errors } = await workflowEngine.executeWorkflow(
                workflowName,
                workflowContext,
              );

              results.forEach((value, key) => allResults.set(key, value));
              errors.forEach((value, key) => allErrors.set(key, value));

              console.log(`[THREAD_WORKFLOW] Completed workflow: ${workflowName}`);
            } catch (error) {
              console.error(`[THREAD_WORKFLOW] Failed to execute workflow ${workflowName}:`, error);
              const errorObj = error instanceof Error ? error : new Error(String(error));
              allErrors.set(workflowName, errorObj);
            }
          }

          workflowResults = { results: allResults, errors: allErrors };
        } catch (error) {
          console.error('[THREAD_WORKFLOW] Workflow creation failed:', error);
          throw { _tag: 'WorkflowCreationFailed' as const, error };
        }

        workflowEngine.clearContext(workflowContext);

        const successfulSteps = Array.from(workflowResults.results.keys());
        const failedSteps = Array.from(workflowResults.errors.keys());

        if (successfulSteps.length > 0) {
          console.log('[THREAD_WORKFLOW] Successfully executed steps:', successfulSteps);
        }

        if (failedSteps.length > 0) {
          console.log('[THREAD_WORKFLOW] Failed steps:', failedSteps);
          workflowResults.errors.forEach((error, stepId) => {
            console.log(`[THREAD_WORKFLOW] Error in step ${stepId}:`, error.message);
          });
        }

        keysToDelete.push(threadId.toString());

        if (keysToDelete.length > 0) {
          try {
            console.log('[THREAD_WORKFLOW] Bulk deleting keys:', keysToDelete);
            const result = await bulkDeleteKeys(keysToDelete);
            console.log('[THREAD_WORKFLOW] Bulk delete result:', result);
          } catch (error) {
            console.error('[THREAD_WORKFLOW] Failed to bulk delete keys:', error);
          }
        }

        console.log('[THREAD_WORKFLOW] Thread processing complete');
        return 'Thread workflow completed successfully';
      } else {
        console.log('[THREAD_WORKFLOW] Unsupported provider:', providerId);
        throw { _tag: 'UnsupportedProvider' as const, providerId };
      }
    } catch (error) {
      console.error('[THREAD_WORKFLOW] Error in workflow:', error);

      try {
        console.log(
          '[THREAD_WORKFLOW] Clearing processing flag for thread after error:',
          params.threadId,
        );
        const result = await bulkDeleteKeys([params.threadId.toString()]);
        console.log('[THREAD_WORKFLOW] Error cleanup result:', result);
      } catch (cleanupError) {
        console.error('[THREAD_WORKFLOW] Failed to cleanup thread processing flag:', cleanupError);
      }

      throw error;
    }
  }
}
