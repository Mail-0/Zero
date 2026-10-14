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
  RunCoalescer,
  hasBrainEntitlement,
  localDevBilling,
  trackBrainActivity,
  type BrainBilling,
  type LiveRunResult,
} from './lib/thread-ai-dispatch';
import {
  createDefaultWorkflows,
  type WorkflowContext,
} from './thread-workflow-utils/workflow-engine';
import { AI_WORKFLOWS, planLiveRun, summariesEnabled } from './lib/ai-settings';
import { isConnectionActive } from './lib/connection-status';
import { getConnectionAiSettings } from './lib/ai-access';
import { DurableObject } from 'cloudflare:workers';
import { getZeroAgent } from './lib/server-utils';
import type { AiSettings } from './lib/schemas';
import { connection } from './db/schema';
import type { EPrompts } from './types';
import { EProviders } from './types';
import type { ZeroEnv } from './env';
import { Autumn } from 'autumn-js';
import { eq } from 'drizzle-orm';
import { createDb } from './db';

export const getPromptName = (connectionId: string, prompt: EPrompts) => {
  return `${connectionId}-${prompt}`;
};

export type ThreadWorkflowParams = {
  connectionId: string;
  threadId: string;
  providerId: string;
};

type SummaryStep = { summary?: string | null } | undefined;

/**
 * Runs the AI thread workflows (auto-draft, message vectors, thread summary, labels).
 * Addressed per `${connectionId}:${threadId}`, so one instance owns one thread and
 * the coalescer keeps runs for that thread from overlapping.
 */
export class WorkflowRunner extends DurableObject<ZeroEnv> {
  private runs = new RunCoalescer();

  /**
   * Entry point for live mail from mailbox sync. Only runs for users entitled to
   * `brain-activity`, and records one unit of usage per run. `skipDraft` is set on
   * retries so a reply draft is never created twice.
   */
  public runLiveThreadWorkflow(
    params: ThreadWorkflowParams,
    runKey: string,
    options: { skipDraft?: boolean } = {},
  ): Promise<LiveRunResult> {
    const skipDraft = Boolean(options.skipDraft);
    return this.runs.run(`live:${skipDraft}`, async () => {
      if (this.workflowsDisabled())
        return { status: 'skipped', draftAttempted: false, reason: 'workflows_disabled' };
      const user = await this.loadUser(params.connectionId);
      if (!user) return { status: 'skipped', draftAttempted: false, reason: 'no_connection' };
      const plan = planLiveRun(user.settings, { skipDraft });
      if (!plan) return { status: 'skipped', draftAttempted: false, reason: 'features_off' };
      if (!(await hasBrainEntitlement(this.billing(), user.userId)))
        return { status: 'skipped', draftAttempted: false, reason: 'not_entitled' };

      const outcome = await this.execute(params, plan.workflows, user.settings);
      if (!outcome) return { status: 'skipped', draftAttempted: false, reason: 'no_messages' };

      await trackBrainActivity(this.billing(), user.userId, runKey);
      const summary = outcome.results.get('generate-thread-summary') as SummaryStep;
      const summaryFailed =
        plan.summary &&
        (outcome.errors.has('generate-thread-summary') ||
          outcome.errors.has('upsert-thread-summary') ||
          !summary?.summary);
      return {
        status: summaryFailed ? 'retry' : 'done',
        draftAttempted: plan.draft,
        reason: summaryFailed ? 'summary_failed' : undefined,
      };
    });
  }

  /**
   * Summarizes a thread on demand (opened thread with no stored summary). Runs only
   * the summary workflow, never drafts or labels. Returns the long summary so the
   * caller doesn't depend on the Vectorize write being readable yet.
   */
  public generateThreadSummary(params: ThreadWorkflowParams): Promise<string | null> {
    return this.runs.run('summary', async () => {
      if (this.workflowsDisabled()) return null;
      const user = await this.loadUser(params.connectionId);
      if (!user || !summariesEnabled(user.settings)) return null;
      if (!(await hasBrainEntitlement(this.billing(), user.userId))) return null;
      const outcome = await this.execute(params, [AI_WORKFLOWS.summary], user.settings);
      const summary = (outcome?.results.get('generate-thread-summary') as SummaryStep)?.summary;
      if (!outcome || !summary) return null;
      const lastMsg = outcome.lastMessageId ?? 'none';
      await trackBrainActivity(
        this.billing(),
        user.userId,
        `summary:${params.connectionId}:${params.threadId}:${lastMsg}`,
      );
      return summary;
    });
  }

  /** `DISABLE_WORKFLOWS=true` is the kill switch for every AI thread workflow. */
  private workflowsDisabled() {
    return this.env.DISABLE_WORKFLOWS === 'true';
  }

  /** Local dev (`NODE_ENV=local`) treats every user as paid. */
  private billing(): BrainBilling {
    if (this.env.NODE_ENV === 'local') return localDevBilling;
    return new Autumn({ secretKey: this.env.AUTUMN_SECRET_KEY });
  }

  /** The connection's owner and their AI settings. */
  private loadUser(connectionId: string) {
    return getConnectionAiSettings(connectionId);
  }

  /** Loads the thread and runs the named workflows as one chain (shared results). */
  private async execute(
    params: ThreadWorkflowParams,
    workflowNames: string[],
    settings: AiSettings,
  ) {
    // Every provider is read through its mailbox DO (agent.getThread, createDraft, labels),
    // so the workflows themselves are provider-agnostic.
    if (!Object.values<string>(EProviders).includes(params.providerId))
      throw new Error(`Unsupported provider ${params.providerId}`);

    const { db, conn } = createDb(this.env.HYPERDRIVE.connectionString);
    let foundConnection: typeof connection.$inferSelect | undefined;
    try {
      [foundConnection] = await db
        .select()
        .from(connection)
        .where(eq(connection.id, params.connectionId));
    } finally {
      await conn.end().catch(() => {});
    }
    if (!foundConnection) throw new Error(`Connection not found ${params.connectionId}`);
    if (!isConnectionActive(foundConnection))
      throw new Error(`Connection is not authorized ${params.connectionId}`);

    const agent = await getZeroAgent(foundConnection.id);
    const thread = await agent.getThread(params.threadId);
    if (!thread.messages?.length) return null;

    const engine = createDefaultWorkflows();
    const context: WorkflowContext = {
      connectionId: params.connectionId,
      threadId: params.threadId,
      thread,
      foundConnection,
      results: new Map<string, unknown>(),
      aiLabels: settings.labels,
    };
    // A chain, not separate executeWorkflow calls: label generation reads the
    // summary step's result, which only a shared result map carries over.
    const { results, errors } = await engine.executeWorkflowChain(workflowNames, context);
    engine.clearContext(context);
    errors.forEach((error, step) =>
      console.warn('[THREAD_WORKFLOW] step failed', {
        threadId: params.threadId,
        step,
        error: error.message,
      }),
    );
    return { results, errors, lastMessageId: thread.messages.at(-1)?.id };
  }
}
