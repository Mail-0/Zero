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

    const { maxCount, shouldLoop, foundConnection } = setupResult as {
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

    if (event.payload.singlePageMode) {
      const { pageNumber = 1, pageToken, maxCount: paramMaxCount } = event.payload;
      const effectiveMaxCount = paramMaxCount || maxCount;

      console.info(`[SyncThreadsWorkflow] Running in single-page mode for page ${pageNumber}`);

      const pageResult = await step.do(
        `process-single-page-${pageNumber}-${folder}-${connectionId}`,
        async () => {
          console.info(`[SyncThreadsWorkflow] Processing single page ${pageNumber} for folder ${folder}`);

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

          await agent.sendDoState();
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

      console.info(`[SyncThreadsWorkflow] Single-page workflow completed for ${connectionId}/${folder}:`, result);
      return result;
    }

    let pageToken: string | null = null;
    let hasMore = true;
    let pageNumber = 0;

    while (hasMore) {
      pageNumber++;

      const pageResult = await step.do(
        `process-page-${pageNumber}-${folder}-${connectionId}`,
        async () => {
          console.info(`[SyncThreadsWorkflow] Processing page ${pageNumber} for folder ${folder}`);

          const listResult = await driver.list({
            folder,
            maxResults: maxCount,
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

          await agent.sendDoState();
          await agent.reloadFolder(folder);

          console.log(`[SyncThreadsWorkflow] Completed page ${pageNumber}`);

          return pageProcessingResult;
        },
      );

      const typedPageResult = pageResult as PageProcessingResult;

      result.pagesProcessed++;
      result.totalThreads += typedPageResult.threads.length;
      result.synced += typedPageResult.processedCount;
      result.successfulSyncs += typedPageResult.successCount;
      result.failedSyncs += typedPageResult.failureCount;

      pageToken = typedPageResult.nextPageToken;
      hasMore = pageToken !== null && shouldLoop;

      console.info(
        `[SyncThreadsWorkflow] Completed page ${pageNumber}, total synced: ${result.synced}`,
      );
      if (hasMore) {
        await step.sleep(`page-delay-${pageNumber}-${folder}-${connectionId}`, 1000);
      }
    }

    await step.do(`broadcast-completion-${folder}-${connectionId}`, async () => {
      console.info(`[SyncThreadsWorkflow] Completed sync for folder ${folder}`, {
        synced: result.synced,
        pagesProcessed: result.pagesProcessed,
        totalThreads: result.totalThreads,
        successfulSyncs: result.successfulSyncs,
        failedSyncs: result.failedSyncs,
      });
      result.broadcastSent = true;
      return true;
    });

    result.nextPageToken = pageToken;
    console.info(`[SyncThreadsWorkflow] Workflow completed for ${connectionId}/${folder}:`, result);
    return result;
  }
}
