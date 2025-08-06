import { WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';
import type { WorkflowEvent } from 'cloudflare:workers';
import type { ZeroEnv } from '../env';
import { createDb } from '../db';
import { connection } from '../db/schema';
import { eq } from 'drizzle-orm';
import { getZeroAgent, connectionToDriver } from '../lib/server-utils';

export interface SyncThreadsParams {
  connectionId: string;
  folder: string;
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
}

interface PageProcessingResult {
  threads: { id: string; historyId: string | null }[];
  nextPageToken: string | null;
  processedCount: number;
  successCount: number;
  failureCount: number;
}

export class SyncThreadsWorkflow extends WorkflowEntrypoint<ZeroEnv, SyncThreadsParams> {
  async run(event: WorkflowEvent<SyncThreadsParams>, step: WorkflowStep): Promise<SyncThreadsResult> {
    const { connectionId, folder } = event.payload;
    
    console.log(`[SyncThreadsWorkflow] Starting sync for connection ${connectionId}, folder ${folder}`);

    const result: SyncThreadsResult = {
      synced: 0,
      message: 'Sync completed',
      folder,
      pagesProcessed: 0,
      totalThreads: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      broadcastSent: false,
    };

    const setupResult = await step.do('setup-connection', async () => {
      const { db, conn } = createDb(this.env.HYPERDRIVE.connectionString);
      
      const foundConnection = await db.query.connection.findFirst({
        where: eq(connection.id, connectionId),
      });
      
      await conn.end();
      
      if (!foundConnection) {
        throw new Error(`Connection ${connectionId} not found`);
      }

      const driver = connectionToDriver(foundConnection);
      const maxCount = parseInt(this.env.THREAD_SYNC_MAX_COUNT || '5');
      const shouldLoop = this.env.THREAD_SYNC_LOOP === 'true';

      return { driver, maxCount, shouldLoop, foundConnection };
    });

    const { driver, maxCount, shouldLoop, foundConnection } = setupResult as {
      driver: any;
      maxCount: number;
      shouldLoop: boolean;
      foundConnection: any;
    };

    if (connectionId.includes('aggregate')) {
      console.log(`[SyncThreadsWorkflow] Skipping sync for aggregate instance - folder ${folder}`);
      result.message = 'Skipped aggregate instance';
      return result;
    }

    if (!driver) {
      console.error(`[SyncThreadsWorkflow] No driver available for folder ${folder}`);
      result.message = 'No driver available';
      return result;
    }

    let pageToken: string | null = null;
    let hasMore = true;
    let pageNumber = 0;

    while (hasMore) {
      pageNumber++;
      
      const pageResult = await step.do(`process-page-${pageNumber}`, async () => {
        console.log(`[SyncThreadsWorkflow] Processing page ${pageNumber} for folder ${folder}`);
        
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

        for (const thread of listResult.threads) {
          try {
            const latest = await this.env.THREAD_SYNC_WORKER.get(
              this.env.THREAD_SYNC_WORKER.newUniqueId()
            ).syncThread(foundConnection, thread.id);

            if (latest) {
              const normalizedReceivedOn = new Date(latest.receivedOn).toISOString();

              await agent.storeThreadInDB({
                id: thread.id,
                threadId: thread.id,
                providerId: 'google',
                latestSender: latest.sender,
                latestReceivedOn: normalizedReceivedOn,
                latestSubject: latest.subject,
              }, latest.tags.map((tag) => tag.id));

              pageProcessingResult.processedCount++;
              pageProcessingResult.successCount++;
            } else {
              console.log(`[SyncThreadsWorkflow] Skipping thread ${thread.id} - no latest message`);
              pageProcessingResult.failureCount++;
            }
          } catch (error) {
            console.error(`[SyncThreadsWorkflow] Failed to sync thread ${thread.id}:`, error);
            pageProcessingResult.failureCount++;
          }
        }

        return pageProcessingResult;
      });

      const typedPageResult = pageResult as PageProcessingResult;

      result.pagesProcessed++;
      result.totalThreads += typedPageResult.threads.length;
      result.synced += typedPageResult.processedCount;
      result.successfulSyncs += typedPageResult.successCount;
      result.failedSyncs += typedPageResult.failureCount;

      pageToken = typedPageResult.nextPageToken;
      hasMore = pageToken !== null && shouldLoop;

      console.log(`[SyncThreadsWorkflow] Completed page ${pageNumber}, total synced: ${result.synced}`);

      if (hasMore) {
        await step.sleep(`page-delay-${pageNumber}`, 1000);
      }
    }

    await step.do('broadcast-completion', async () => {
      console.log(`[SyncThreadsWorkflow] Completed sync for folder ${folder}`, {
        synced: result.synced,
        pagesProcessed: result.pagesProcessed,
        totalThreads: result.totalThreads,
        successfulSyncs: result.successfulSyncs,
        failedSyncs: result.failedSyncs,
      });
      result.broadcastSent = true;
      return true;
    });

    console.log(`[SyncThreadsWorkflow] Workflow completed for ${connectionId}/${folder}:`, result);
    return result;
  }
}
