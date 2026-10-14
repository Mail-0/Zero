import type { gmail_v1 } from '@googleapis/gmail';

/** Autumn feature that gates the AI thread workflow (Pro: auto labeling, summaries). */
export const BRAIN_FEATURE_ID = 'brain-activity';

/**
 * A single history delta adding more threads than this is treated as a backfill
 * (reconnect, bulk import, filter replay) and skips the AI workflow.
 */
export const LIVE_AI_THREAD_LIMIT = 50;

const SKIPPED_LABELS = new Set([
  'SENT',
  'DRAFT',
  'SPAM',
  'TRASH',
  'CATEGORY_PROMOTIONS',
  'CATEGORY_SOCIAL',
]);

/** Outcome of a live AI run, reported back to the mailbox that dispatched it. */
export type LiveRunResult = {
  status: 'done' | 'retry' | 'skipped';
  /** The auto-draft workflow ran (successfully or not); retries must not repeat it. */
  draftAttempted: boolean;
  reason?: string;
};

/**
 * Serializes work on one runner instance and coalesces callers that arrive while an
 * equivalent task is still waiting to start: they share that task's result instead
 * of queueing a duplicate run.
 */
export class RunCoalescer {
  private tail: Promise<unknown> = Promise.resolve();
  private waiting = new Map<string, Promise<unknown>>();

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const existing = this.waiting.get(key);
    if (existing) return existing as Promise<T>;
    const next = this.tail.then(() => {
      this.waiting.delete(key);
      return task();
    });
    this.waiting.set(key, next);
    this.tail = next.catch(() => {});
    return next;
  }
}

/**
 * Picks the threads from a Gmail history delta that should run the AI workflow:
 * threads that received a message from someone else. Mail the user sent, drafts,
 * spam, trash, promotions and social updates are skipped. Returns none when the
 * delta looks like a backfill.
 */
export function selectAiThreads(
  history: Pick<gmail_v1.Schema$History, 'messagesAdded'>[],
  limit = LIVE_AI_THREAD_LIMIT,
): string[] {
  const threads = new Set<string>();
  for (const entry of history) {
    for (const added of entry.messagesAdded ?? []) {
      const threadId = added.message?.threadId;
      if (!threadId) continue;
      if (added.message?.labelIds?.some((id) => SKIPPED_LABELS.has(id))) continue;
      threads.add(threadId);
    }
  }
  return threads.size > limit ? [] : [...threads];
}

type AutumnResult<T> = { data?: T | null; error?: { message?: string } | null };

export interface BrainBilling {
  check(params: {
    customer_id: string;
    feature_id: string;
  }): Promise<AutumnResult<{ allowed: boolean }>>;
  track(params: {
    customer_id: string;
    feature_id: string;
    value: number;
    idempotency_key: string;
  }): Promise<AutumnResult<unknown>>;
}

/** Billing for local dev: every user is treated as paid and usage is not recorded. */
export const localDevBilling: BrainBilling = {
  check: async () => ({ data: { allowed: true }, error: null }),
  track: async () => ({ data: null, error: null }),
};

/** Fails closed: no billing answer means no AI run. */
export async function hasBrainEntitlement(billing: BrainBilling, userId: string) {
  try {
    const result = await billing.check({ customer_id: userId, feature_id: BRAIN_FEATURE_ID });
    if (result.error) {
      console.warn('[brain-entitlement] check failed', { userId, error: result.error.message });
      return false;
    }
    return Boolean(result.data?.allowed);
  } catch (error) {
    console.warn('[brain-entitlement] check threw', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/** Records one AI workflow run. Usage tracking must never fail the workflow. */
export async function trackBrainActivity(
  billing: BrainBilling,
  userId: string,
  idempotencyKey: string,
) {
  try {
    const result = await billing.track({
      customer_id: userId,
      feature_id: BRAIN_FEATURE_ID,
      value: 1,
      idempotency_key: idempotencyKey,
    });
    if (result.error)
      console.warn('[brain-entitlement] track failed', { userId, error: result.error.message });
  } catch (error) {
    console.warn('[brain-entitlement] track threw', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
