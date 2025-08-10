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
import { getZeroAgent, connectionToDriver } from '../lib/server-utils';
import { WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';
import type { WorkflowEvent } from 'cloudflare:workers';
import { connection } from '../db/schema';
import type { ZeroEnv } from '../env';
import { eq } from 'drizzle-orm';
import { createDb } from '../db';

export interface SyncThreadsParams {
  connectionId: string;
  folder: string;
  pageNumber?: number;
  pageToken?: string | null;
  maxCount?: number;
  singlePageMode?: boolean;
}

export interface SyncThreadsResult {
  synced: number;
  message: string;
  folder: string;
  pagesProcessed: number;
  totalThreads: number;
  successfulSyncs: number;
  failedSyncs: number;
  broadcastSent: boolean;
  nextPageToken: string | null;
}

interface PageProcessingResult {
  threads: { id: string; historyId: string | null }[];
  nextPageToken: string | null;
  processedCount: number;
  successCount: number;
  failureCount: number;
}

export class SyncThreadsWorkflow extends WorkflowEntrypoint<ZeroEnv, SyncThreadsParams> {
  async run(
    event: WorkflowEvent<SyncThreadsParams>,
    step: WorkflowStep,
  ): Promise<SyncThreadsResult> {
    const { connectionId, folder } = event.payload;

    console.info(
      `[SyncThreadsWorkflow] Starting sync for connection ${connectionId}, folder ${folder}`,
    );

    const result: SyncThreadsResult = {
      synced: 0,
      message: 'Sync completed',
      folder,
      pagesProcessed: 0,
      totalThreads: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      broadcastSent: false,
      nextPageToken: null,
    };

    const setupResult = await step.do(`setup-connection-${connectionId}-${folder}`, async () => {
      const { db, conn } = createDb(this.env.HYPERDRIVE.connectionString);

      const foundConnection = await db.query.connection.findFirst({
        where: eq(connection.id, connectionId),
      });

      await conn.end();

      if (!foundConnection) {
        throw new Error(`Connection ${connectionId} not found`);
      }

      const maxCount = parseInt(this.env.THREAD_SYNC_MAX_COUNT || '20');
      const shouldLoop = this.env.THREAD_SYNC_LOOP === 'true';

      return { maxCount, shouldLoop, foundConnection };
    });

    const { maxCount, foundConnection } = setupResult as {
      driver: any;
      maxCount: number;
      shouldLoop: boolean;
      foundConnection: any;
    };
    const driver = connectionToDriver(foundConnection);

    if (connectionId.includes('aggregate')) {
      console.info(`[SyncThreadsWorkflow] Skipping sync for aggregate instance - folder ${folder}`);
      result.message = 'Skipped aggregate instance';
      return result;
    }

    if (!driver) {
      console.warn(`[SyncThreadsWorkflow] No driver available for folder ${folder}`);
      result.message = 'No driver available';
      return result;
    }

    const { pageNumber = 1, pageToken, maxCount: paramMaxCount } = event.payload;
    const effectiveMaxCount = paramMaxCount || maxCount;

    console.info(`[SyncThreadsWorkflow] Running in single-page mode for page ${pageNumber}`);

    const pageResult = await step.do(
      `process-single-page-${pageNumber}-${folder}-${connectionId}`,
      async () => {
        console.info(
          `[SyncThreadsWorkflow] Processing single page ${pageNumber} for folder ${folder}`,
        );

        const listResult = await driver.list({
          folder,
          maxResults: effectiveMaxCount,
          pageToken: pageToken || undefined,
        });

        const pageProcessingResult: PageProcessingResult = {
          threads: listResult.threads,
          nextPageToken: listResult.nextPageToken,
          processedCount: 0,
          successCount: 0,
          failureCount: 0,
        };

        const { stub: agent } = await getZeroAgent(connectionId);

        const syncSingleThread = async (thread: { id: string; historyId: string | null }) => {
          try {
            const latest = await this.env.THREAD_SYNC_WORKER.get(
              this.env.THREAD_SYNC_WORKER.newUniqueId(),
            ).syncThread(foundConnection, thread.id);

            if (latest) {
              const normalizedReceivedOn = new Date(latest.receivedOn).toISOString();

              await agent.storeThreadInDB(
                {
                  id: thread.id,
                  threadId: thread.id,
                  providerId: 'google',
                  latestSender: latest.sender,
                  latestReceivedOn: normalizedReceivedOn,
                  latestSubject: latest.subject,
                },
                latest.tags.map((tag) => tag.id),
              );

              pageProcessingResult.processedCount++;
              pageProcessingResult.successCount++;
              console.log(`[SyncThreadsWorkflow] Successfully synced thread ${thread.id}`);
            } else {
              console.info(
                `[SyncThreadsWorkflow] Skipping thread ${thread.id} - no latest message`,
              );
              pageProcessingResult.failureCount++;
            }
          } catch (error) {
            console.error(`[SyncThreadsWorkflow] Failed to sync thread ${thread.id}:`, error);
            pageProcessingResult.failureCount++;
          }
        };

        const syncEffects = listResult.threads.map(syncSingleThread);
        await Promise.allSettled(syncEffects);

        // await agent.invalidateDoStateCache();
        // await sendDoState(connectionId);
        await agent.reloadFolder(folder);

        console.log(`[SyncThreadsWorkflow] Completed single page ${pageNumber}`);
        return pageProcessingResult;
      },
    );

    const typedPageResult = pageResult as PageProcessingResult;
    result.pagesProcessed = 1;
    result.totalThreads = typedPageResult.threads.length;
    result.synced = typedPageResult.processedCount;
    result.successfulSyncs = typedPageResult.successCount;
    result.failedSyncs = typedPageResult.failureCount;
    result.nextPageToken = typedPageResult.nextPageToken;

    console.info(
      `[SyncThreadsWorkflow] Single-page workflow completed for ${connectionId}/${folder}:`,
      result,
    );
    return result;
  }
}
