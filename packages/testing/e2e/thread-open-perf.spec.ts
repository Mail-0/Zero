import { test, expect, type Page } from '@playwright/test';

/**
 * Thread-open performance benchmark.
 *
 * Opens the first N inbox threads (click -> body painted) and reads the
 * `window.__threadOpenPerf` samples emitted by apps/mail/lib/perf.ts.
 *
 *   THREAD_OPEN_COUNT=8 THREAD_OPEN_P95_BUDGET_MS=1200 pnpm --filter @zero/testing test:e2e thread-open-perf
 *
 * Add `--project=chromium` and Chrome CPU throttling (below) to approximate low-end devices.
 */

type Sample = {
  threadId: string;
  source: string;
  total: number;
  data: number;
  render: number | null;
  contentCacheHit: boolean | null;
};

const COUNT = Number(process.env.THREAD_OPEN_COUNT ?? 8);
const P95_BUDGET = Number(process.env.THREAD_OPEN_P95_BUDGET_MS ?? 1500);
const CPU_THROTTLE = Number(process.env.THREAD_OPEN_CPU_THROTTLE ?? 1);

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? NaN;
};

const sampleCount = (page: Page) => page.evaluate(() => window.__threadOpenPerf?.length ?? 0);

declare global {
  interface Window {
    __threadOpenPerf?: Sample[];
  }
}

test('thread open: click -> body painted', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP throttling + perf marks benchmarked on Chromium');

  if (CPU_THROTTLE > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  }

  await page.goto('/mail/inbox');
  const rows = page.locator('[data-thread-id]');
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  // Let list-row prefetches (mail.get + processEmailContent) settle, as a real user would.
  await page.waitForLoadState('networkidle').catch(() => {});

  const n = Math.min(COUNT, await rows.count());
  for (let i = 0; i < n; i++) {
    const before = await sampleCount(page);
    await rows.nth(i).click();
    await expect.poll(() => sampleCount(page), { timeout: 15_000 }).toBeGreaterThan(before);
    await page.keyboard.press('Escape');
    await expect(rows.nth(Math.min(i + 1, n - 1))).toBeVisible();
  }

  const samples = await page.evaluate(() => window.__threadOpenPerf ?? []);
  const totals = samples.map((s) => s.total);
  const hits = samples.filter((s) => s.contentCacheHit).length;

  const summary = {
    n: samples.length,
    p50: Math.round(pct(totals, 50)),
    p95: Math.round(pct(totals, 95)),
    fetchP50: Math.round(pct(samples.map((s) => s.data ?? 0), 50)),
    renderP50: Math.round(pct(samples.map((s) => s.render ?? 0), 50)),
    contentCacheHitRate: samples.length ? hits / samples.length : 0,
  };
  console.log('[thread-open-perf]', JSON.stringify(summary));
  test.info().annotations.push({ type: 'thread-open-perf', description: JSON.stringify(summary) });

  expect(samples.length).toBe(n);
  expect(summary.p95).toBeLessThan(P95_BUDGET);
});
