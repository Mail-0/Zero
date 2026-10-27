import { getMailLoadState } from './mail-load-state';
import { describe, expect, it } from 'vitest';

describe('mail loading states', () => {
  const idle = { hasData: false, isPending: false, isFetching: false, isError: false };

  it('shows a skeleton only while waiting for data', () => {
    expect(getMailLoadState({ ...idle, isPending: true })).toBe('loading');
    expect(getMailLoadState({ ...idle, isFetching: true })).toBe('loading');
  });

  it('shows failures instead of leaving a permanent skeleton', () => {
    expect(getMailLoadState({ ...idle, isError: true })).toBe('error');
  });

  it('allows retrying successful reads whose thread has not been imported yet', () => {
    expect(getMailLoadState(idle)).toBe('unavailable');
  });

  it('shows loading again during a retry, even if the previous read failed', () => {
    expect(getMailLoadState({ ...idle, isError: true, isFetching: true })).toBe('loading');
  });

  it('keeps existing data visible during refreshes and refresh failures', () => {
    expect(getMailLoadState({ ...idle, hasData: true, isFetching: true })).toBe('ready');
    expect(getMailLoadState({ ...idle, hasData: true, isError: true })).toBe('ready');
  });
});
