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
import { WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';
import { connectionToDriver } from '../lib/server-utils';
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

export class SyncThreadsCoordinatorWorkflow extends WorkflowEntrypoint<
  ZeroEnv,
  SyncThreadsCoordinatorParams
> {
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
      console.info(
        `[SyncThreadsCoordinatorWorkflow] Skipping sync for aggregate instance - folder ${folder}`,
      );
      result.message = 'Skipped aggregate instance';
      return result;
    }

    if (!driver) {
      console.warn(`[SyncThreadsCoordinatorWorkflow] No driver available for folder ${folder}`);
      result.message = 'No driver available';
      return result;
    }

    // Process pages sequentially
    let currentPageToken: string | null = null;
    let pageNumber = 0;

    do {
      pageNumber++;

      // Process this page
      const pageResult = await step.do(
        `process-page-${pageNumber}-${folder}-${connectionId}`,
        async () => {
          console.info(
            `[SyncThreadsCoordinatorWorkflow] Processing page ${pageNumber} for ${folder}`,
          );

          // Create workflow for this page
          const instance = await this.env.SYNC_THREADS_WORKFLOW.create({
            params: {
              connectionId,
              folder,
              pageNumber,
              pageToken: currentPageToken,
              maxCount,
              singlePageMode: true,
            },
          });

          console.info(
            `[SyncThreadsCoordinatorWorkflow] Created workflow ${instance.id} for page ${pageNumber}`,
          );

          // Simple polling to wait for completion
          let attempts = 0;
          const maxAttempts = 60; // 5 minutes

          while (attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 5000));

            try {
              const status = await instance.status();
              if (status.status === 'complete') {
                return { result: status.output, workflowId: instance.id };
              } else if (status.status === 'errored') {
                throw new Error(`Workflow ${instance.id} failed`);
              }
            } catch (error) {
              if (attempts === maxAttempts - 1) {
                throw error;
              }
            }

            attempts++;
          }

          throw new Error(`Workflow ${instance.id} timed out`);
        },
      );

      // Update result with this page's data
      if (pageResult?.result) {
        const workflowResult = pageResult.result as any;
        result.pageWorkflowResults.push({
          pageNumber,
          workflowId: pageResult.workflowId,
          status: 'completed',
          synced: workflowResult.synced || 0,
        });

        result.totalSynced += workflowResult.synced || 0;
        result.totalPagesProcessed += 1;
        result.totalThreads += workflowResult.totalThreads || 0;
        result.totalSuccessfulSyncs += workflowResult.successfulSyncs || 0;
        result.totalFailedSyncs += workflowResult.failedSyncs || 0;

        // Get next page token from workflow result if available
        currentPageToken = workflowResult.nextPageToken || null;
      } else {
        // If no result, we can't continue
        break;
      }

      // If no more pages, stop
      if (!currentPageToken) {
        console.info(`[SyncThreadsCoordinatorWorkflow] No more pages for ${folder}`);
        break;
      }
    } while (currentPageToken && shouldLoop);

    console.info(
      `[SyncThreadsCoordinatorWorkflow] Completed ${folder}: ${result.totalSynced} synced across ${result.totalPagesProcessed} pages`,
    );

    return result;
  }
}
