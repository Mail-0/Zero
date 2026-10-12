import { test, expect, type Page } from '@playwright/test';

/**
 * Thread-open performance benchmark.
 *
 * Opens the first N inbox threads and measures click -> first email body painted.
 *
 * - `external` timing is measured in-page (click dispatch -> a `.mail-content` shadow root
 *   has content -> two frames). It needs no app instrumentation, so it can A/B builds
 *   that predate apps/mail/lib/perf.ts.
 * - When the app is instrumented, `window.__threadOpenPerf` adds the fetch/render split
 *   and content-cache hit rate.
 *
 *   THREAD_OPEN_COUNT=8 THREAD_OPEN_P95_BUDGET_MS=1500 THREAD_OPEN_CPU_THROTTLE=4 \
 *     pnpm --filter @zero/testing test:e2e thread-open-perf
 */

type Sample = {
  threadId: string;
  source: string;
  total: number;
  data: number | null;
  render: number | null;
  contentCacheHit: boolean | null;
};

declare global {
  interface Window {
    __threadOpenPerf?: Sample[];
  }
}

const COUNT = Number(process.env.THREAD_OPEN_COUNT ?? 8);
const ROUNDS = Number(process.env.THREAD_OPEN_ROUNDS ?? 2);
const P95_BUDGET = Number(process.env.THREAD_OPEN_P95_BUDGET_MS ?? 1500);
const CPU_THROTTLE = Number(process.env.THREAD_OPEN_CPU_THROTTLE ?? 1);
const LABEL = process.env.THREAD_OPEN_LABEL ?? '';

// Optional: point at a storageState file instead of running auth.setup (use with --no-deps).
if (process.env.PLAYWRIGHT_STORAGE_STATE) {
  test.use({ storageState: process.env.PLAYWRIGHT_STORAGE_STATE });
}

const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
};

/** Click row i and resolve with ms until an email body is in the DOM and painted. */
const openAndTime = (page: Page, i: number) =>
  page.evaluate(
    (index) =>
      new Promise<number>((resolve, reject) => {
        const row = document.querySelectorAll<HTMLElement>('[data-thread-id]')[index];
        if (!row) return reject(new Error(`row ${index} not found`));
        const hasBody = () =>
          Array.from(document.querySelectorAll('.mail-content')).some(
            (el) => (el.shadowRoot?.childNodes.length ?? 0) > 0,
          );
        const t0 = performance.now();
        row.click();
        const deadline = t0 + 20_000;
        const poll = () => {
          if (hasBody()) {
            requestAnimationFrame(() =>
              requestAnimationFrame(() => resolve(performance.now() - t0)),
            );
          } else if (performance.now() > deadline) {
            reject(new Error('timed out waiting for email body'));
          } else {
            requestAnimationFrame(poll);
          }
        };
        poll();
      }),
    i,
  );

const closeThread = async (page: Page) => {
  await page.keyboard.press('Escape');
  await expect(page.locator('.mail-content')).toHaveCount(0, { timeout: 5_000 });
  await expect(page.locator('[data-thread-id]').first()).toBeVisible();
};

test('thread open: click -> body painted', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP throttling is Chromium-only');
  test.setTimeout(10 * 60_000);

  await page.goto('/mail/inbox');
  const rows = page.locator('[data-thread-id]');
  await expect(rows.first()).toBeVisible({ timeout: 60_000 });
  // Let list-row prefetches (mail.get + processEmailContent) settle, as a real user would.
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(2_000);

  if (CPU_THROTTLE > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  }

  const n = Math.min(COUNT, await rows.count());
  const rounds: number[][] = [];
  for (let r = 0; r < ROUNDS; r++) {
    const times: number[] = [];
    for (let i = 0; i < n; i++) {
      times.push(await openAndTime(page, i));
      await closeThread(page);
    }
    rounds.push(times);
  }

  const samples = await page.evaluate(() => window.__threadOpenPerf ?? []);
  const summarize = (xs: number[]) => ({
    p50: Math.round(pct(xs, 50)),
    p95: Math.round(pct(xs, 95)),
    mean: Math.round(xs.reduce((a, b) => a + b, 0) / (xs.length || 1)),
  });

  const summary = {
    label: LABEL,
    threads: n,
    cpuThrottle: CPU_THROTTLE,
    // round 1 = first open of each thread (prefetch only); later rounds = revisits
    firstOpen: summarize(rounds[0] ?? []),
    revisit: summarize(rounds.slice(1).flat()),
    instrumented: samples.length
      ? {
          fetchP50: Math.round(pct(samples.map((s) => s.data ?? 0), 50)),
          renderP50: Math.round(pct(samples.map((s) => s.render ?? 0), 50)),
          contentCacheHitRate:
            Math.round((samples.filter((s) => s.contentCacheHit).length / samples.length) * 100) /
            100,
        }
      : null,
    raw: rounds.map((r) => r.map(Math.round)),
  };
  console.log('[thread-open-perf]', JSON.stringify(summary));
  test.info().annotations.push({ type: 'thread-open-perf', description: JSON.stringify(summary) });

  expect(summary.firstOpen.p95).toBeLessThan(P95_BUDGET);
});
