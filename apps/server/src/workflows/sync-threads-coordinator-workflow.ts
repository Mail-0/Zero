import { connectionToDriver } from '../lib/server-utils';
import { WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';
import type { WorkflowEvent } from 'cloudflare:workers';
import { connection } from '../db/schema';
import type { ZeroEnv } from '../env';
import { eq } from 'drizzle-orm';
import { createDb } from '../db';

export interface SyncThreadsCoordinatorParams {
  connectionId: string;
  folder: string;
}

export interface SyncThreadsCoordinatorResult {
  totalSynced: number;
  message: string;
  folder: string;
  totalPagesProcessed: number;
  totalThreads: number;
  totalSuccessfulSyncs: number;
  totalFailedSyncs: number;
  pageWorkflowResults: Array<{
    pageNumber: number;
    workflowId: string;
    status: 'completed' | 'failed';
    synced: number;
    error?: string;
  }>;
}

export class SyncThreadsCoordinatorWorkflow extends WorkflowEntrypoint<ZeroEnv, SyncThreadsCoordinatorParams> {
  async run(
    event: WorkflowEvent<SyncThreadsCoordinatorParams>,
    step: WorkflowStep,
  ): Promise<SyncThreadsCoordinatorResult> {
    const { connectionId, folder } = event.payload;

    console.info(
      `[SyncThreadsCoordinatorWorkflow] Starting coordination for connection ${connectionId}, folder ${folder}`,
    );

    const result: SyncThreadsCoordinatorResult = {
      totalSynced: 0,
      message: 'Coordination completed',
      folder,
      totalPagesProcessed: 0,
      totalThreads: 0,
      totalSuccessfulSyncs: 0,
      totalFailedSyncs: 0,
      pageWorkflowResults: [],
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
      maxCount: number;
      shouldLoop: boolean;
      foundConnection: any;
    };
    const driver = connectionToDriver(foundConnection);

    if (connectionId.includes('aggregate')) {
      console.info(`[SyncThreadsCoordinatorWorkflow] Skipping sync for aggregate instance - folder ${folder}`);
      result.message = 'Skipped aggregate instance';
      return result;
    }

    if (!driver) {
      console.warn(`[SyncThreadsCoordinatorWorkflow] No driver available for folder ${folder}`);
      result.message = 'No driver available';
      return result;
    }

    const pageTokens = await step.do(`discover-pages-${connectionId}-${folder}`, async () => {
      const tokens: Array<{ pageNumber: number; pageToken: string | null }> = [];
      let currentPageToken: string | null = null;
      let pageNumber = 0;

      do {
        pageNumber++;
        const listResult = await driver.list({
          folder,
          maxResults: maxCount,
          pageToken: currentPageToken || undefined,
        });

        tokens.push({
          pageNumber,
          pageToken: currentPageToken,
        });

        currentPageToken = listResult.nextPageToken;
      } while (currentPageToken && shouldLoop && pageNumber < 50);

      console.info(`[SyncThreadsCoordinatorWorkflow] Discovered ${tokens.length} pages for ${folder}`);
      return tokens;
    });

    const pageWorkflows = await step.do(`spawn-page-workflows-${connectionId}-${folder}`, async () => {
      const workflows: Array<{ pageNumber: number; workflowId: string; instance: any }> = [];

      for (const pageInfo of pageTokens) {
        const workflowId = `${connectionId}-${folder}-page-${pageInfo.pageNumber}`;
        
        try {
          const instance = await this.env.SYNC_THREADS_WORKFLOW.create({
            id: workflowId,
            params: {
              connectionId,
              folder,
              pageNumber: pageInfo.pageNumber,
              pageToken: pageInfo.pageToken,
              maxCount,
              singlePageMode: true,
            },
          });

          workflows.push({
            pageNumber: pageInfo.pageNumber,
            workflowId,
            instance,
          });

          console.info(`[SyncThreadsCoordinatorWorkflow] Spawned workflow ${workflowId}`);
        } catch (error) {
          console.error(`[SyncThreadsCoordinatorWorkflow] Failed to spawn workflow for page ${pageInfo.pageNumber}:`, error);
          result.pageWorkflowResults.push({
            pageNumber: pageInfo.pageNumber,
            workflowId,
            status: 'failed',
            synced: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return workflows;
    });

    for (const workflow of pageWorkflows) {
      await step.do(`wait-for-page-${workflow.pageNumber}-${connectionId}-${folder}`, async () => {
        try {
          const workflowResult = await workflow.instance.result();
          
          result.totalSynced += workflowResult.synced || 0;
          result.totalPagesProcessed += 1;
          result.totalThreads += workflowResult.totalThreads || 0;
          result.totalSuccessfulSyncs += workflowResult.successfulSyncs || 0;
          result.totalFailedSyncs += workflowResult.failedSyncs || 0;

          result.pageWorkflowResults.push({
            pageNumber: workflow.pageNumber,
            workflowId: workflow.workflowId,
            status: 'completed',
            synced: workflowResult.synced || 0,
          });

          console.info(`[SyncThreadsCoordinatorWorkflow] Page ${workflow.pageNumber} completed: ${workflowResult.synced} synced`);
          return workflowResult;
        } catch (error) {
          console.error(`[SyncThreadsCoordinatorWorkflow] Page ${workflow.pageNumber} failed:`, error);
          result.pageWorkflowResults.push({
            pageNumber: workflow.pageNumber,
            workflowId: workflow.workflowId,
            status: 'failed',
            synced: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          return null;
        }
      });
    }

    await step.do(`broadcast-completion-${folder}-${connectionId}`, async () => {
      console.info(`[SyncThreadsCoordinatorWorkflow] Completed coordination for folder ${folder}`, {
        totalSynced: result.totalSynced,
        totalPagesProcessed: result.totalPagesProcessed,
        totalThreads: result.totalThreads,
        totalSuccessfulSyncs: result.totalSuccessfulSyncs,
        totalFailedSyncs: result.totalFailedSyncs,
      });
      return true;
    });

    console.info(`[SyncThreadsCoordinatorWorkflow] Coordination completed for ${connectionId}/${folder}:`, result);
    return result;
  }
}
