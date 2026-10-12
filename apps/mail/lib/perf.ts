/**
 * Thread-open performance instrumentation.
 *
 * Timeline for a single "open thread" interaction:
 *   thread-open:start   – user clicked / keyboard-navigated (or URL changed)
 *   thread-open:data    – mail.get resolved and ThreadDisplay has the thread
 *   thread-open:painted – first message body HTML is in the shadow DOM and a frame painted
 *
 * Results are emitted as `performance.measure` entries (visible in the DevTools
 * Performance panel "Timings" track), pushed to `window.__threadOpenPerf` for
 * e2e benchmarks, and sampled to PostHog in production.
 */

export type ThreadOpenSource = 'click' | 'keyboard' | 'url';

export interface ThreadOpenSample {
  threadId: string;
  source: ThreadOpenSource;
  /** start -> painted */
  total: number;
  /** start -> thread data available in ThreadDisplay (~0 when mail.get was cached) */
  data: number | null;
  /** data -> painted */
  render: number | null;
  /** whether the processed email body was already in the query cache */
  contentCacheHit: boolean | null;
}

interface Pending {
  threadId: string;
  source: ThreadOpenSource;
  start: number;
  dataAt: number | null;
  contentCacheHit: boolean | null;
}

declare global {
  interface Window {
    __threadOpenPerf?: ThreadOpenSample[];
  }
}

const POSTHOG_SAMPLE_RATE = 0.1;
const MAX_SAMPLES = 200;
// Abandon measurements that never complete (e.g. thread closed before paint).
const STALE_AFTER_MS = 30_000;

let pending: Pending | null = null;

const now = () => performance.now();
const hasPerf = () => typeof performance !== 'undefined' && typeof performance.mark === 'function';

export function markThreadOpenStart(threadId: string | null, source: ThreadOpenSource) {
  if (!threadId || !hasPerf()) return;
  // Opening the same thread again while it is still pending: keep the earlier start.
  if (pending?.threadId === threadId && now() - pending.start < STALE_AFTER_MS) return;
  pending = { threadId, source, start: now(), dataAt: null, contentCacheHit: null };
  performance.mark('thread-open:start', { detail: { threadId, source } });
}

/** Called by ThreadDisplay whenever it renders a thread; starts a 'url' measurement if none is pending. */
export function ensureThreadOpenStarted(threadId: string | null) {
  if (!threadId || pending?.threadId === threadId) return;
  markThreadOpenStart(threadId, 'url');
}

export function markThreadDataReady(threadId: string) {
  if (!pending || pending.threadId !== threadId || pending.dataAt !== null) return;
  pending.dataAt = now();
  performance.mark('thread-open:data', { detail: { threadId } });
}

export function markThreadContentCache(threadId: string | undefined, hit: boolean) {
  if (!pending || pending.threadId !== threadId || pending.contentCacheHit !== null) return;
  pending.contentCacheHit = hit;
}

export function markThreadBodyPainted(threadId: string | undefined) {
  if (!pending || pending.threadId !== threadId) return;
  const current = pending;
  // Wait for the frame containing the new HTML to actually be painted.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (pending !== current) return;
      pending = null;
      finish(current);
    });
  });
}

function finish(p: Pending) {
  const end = now();
  if (end - p.start > STALE_AFTER_MS) return;

  const sample: ThreadOpenSample = {
    threadId: p.threadId,
    source: p.source,
    total: end - p.start,
    data: p.dataAt !== null ? p.dataAt - p.start : null,
    render: p.dataAt !== null ? end - p.dataAt : null,
    contentCacheHit: p.contentCacheHit,
  };

  try {
    performance.mark('thread-open:painted', { detail: { threadId: p.threadId } });
    performance.measure('thread-open', {
      start: p.start,
      end,
      detail: sample,
    });
    if (p.dataAt !== null) {
      performance.measure('thread-open:fetch', { start: p.start, end: p.dataAt });
      performance.measure('thread-open:render', { start: p.dataAt, end });
    }
  } catch {
    // older browsers without mark/measure options – ignore
  }

  const samples = (window.__threadOpenPerf ??= []);
  samples.push(sample);
  if (samples.length > MAX_SAMPLES) samples.shift();

  if (import.meta.env.DEV) {
    console.debug(
      `[perf] thread-open ${sample.total.toFixed(0)}ms` +
        ` (fetch ${sample.data?.toFixed(0) ?? 'cached'}, render ${sample.render?.toFixed(0) ?? '-'},` +
        ` content cache ${sample.contentCacheHit ? 'hit' : 'miss'}, ${sample.source})`,
    );
  } else if (Math.random() < POSTHOG_SAMPLE_RATE) {
    void import('posthog-js')
      .then(({ default: posthog }) => {
        if (posthog.__loaded) posthog.capture('thread_open_perf', { ...sample });
      })
      .catch(() => {});
  }
}
