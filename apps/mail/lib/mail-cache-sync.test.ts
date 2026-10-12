import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCoalescedRunner } from './mail-cache-sync';

describe('createCoalescedRunner', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs the first trigger immediately', () => {
    const run = vi.fn();
    createCoalescedRunner(run, 2000).trigger();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('coalesces a burst into one trailing run and never drops the last update', () => {
    const run = vi.fn();
    const r = createCoalescedRunner(run, 2000);
    for (let i = 0; i < 10; i++) {
      r.trigger();
      vi.advanceTimersByTime(100);
    }
    expect(run).toHaveBeenCalledTimes(1); // leading
    vi.advanceTimersByTime(2000);
    expect(run).toHaveBeenCalledTimes(2); // trailing covers the burst
    vi.advanceTimersByTime(10_000);
    expect(run).toHaveBeenCalledTimes(2); // nothing pending, timer stops
  });

  it('caps a sustained stream at one run per window', () => {
    const run = vi.fn();
    const r = createCoalescedRunner(run, 2000);
    for (let i = 0; i < 100; i++) {
      r.trigger();
      vi.advanceTimersByTime(100); // 10s of 10 msgs/s
    }
    vi.advanceTimersByTime(2000);
    expect(run.mock.calls.length).toBeGreaterThanOrEqual(5);
    expect(run.mock.calls.length).toBeLessThanOrEqual(7);
  });

  it('runs immediately again after a quiet window', () => {
    const run = vi.fn();
    const r = createCoalescedRunner(run, 2000);
    r.trigger();
    vi.advanceTimersByTime(2500);
    r.trigger();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('cancel drops a pending trailing run', () => {
    const run = vi.fn();
    const r = createCoalescedRunner(run, 2000);
    r.trigger();
    r.trigger();
    r.cancel();
    vi.advanceTimersByTime(5000);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
