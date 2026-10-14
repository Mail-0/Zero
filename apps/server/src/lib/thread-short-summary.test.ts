import { getShortThreadSummary, type ShortSummaryDeps } from './thread-short-summary';
import { describe, expect, it, vi } from 'vitest';

function fixture(metadata: Record<string, { summary?: string; connection?: string }>) {
  const objects = new Map<string, string>();
  const deps = {
    getMetadata: vi.fn(async (threadId: string) => metadata[threadId]),
    bucket: {
      get: vi.fn(async (key: string) =>
        objects.has(key) ? { text: async () => objects.get(key)! } : null,
      ),
      put: vi.fn(async (key: string, value: string) => {
        objects.set(key, value);
      }),
    },
    summarize: vi.fn(async (text: string): Promise<string | undefined> => `short(${text})`),
  } satisfies ShortSummaryDeps;
  return { deps, objects };
}

describe('thread short summary cache', () => {
  it('runs the model once per stored summary and serves repeats from storage', async () => {
    const { deps } = fixture({ t1: { summary: 'long', connection: 'c1' } });
    expect(await getShortThreadSummary(deps, 't1', 'c1')).toBe('short(long)');
    expect(await getShortThreadSummary(deps, 't1', 'c1')).toBe('short(long)');
    expect(deps.summarize).toHaveBeenCalledTimes(1);
  });

  it('recomputes when the thread is re-summarized', async () => {
    const meta = { t1: { summary: 'v1', connection: 'c1' } };
    const { deps } = fixture(meta);
    await getShortThreadSummary(deps, 't1', 'c1');
    meta.t1.summary = 'v2';
    expect(await getShortThreadSummary(deps, 't1', 'c1')).toBe('short(v2)');
    expect(deps.summarize).toHaveBeenCalledTimes(2);
  });

  it('returns null for missing summaries or another connection without calling the model', async () => {
    const { deps } = fixture({ t1: { summary: 'long', connection: 'c1' }, t2: {} });
    expect(await getShortThreadSummary(deps, 't1', 'other')).toBeNull();
    expect(await getShortThreadSummary(deps, 't2', 'c1')).toBeNull();
    expect(await getShortThreadSummary(deps, 'missing', 'c1')).toBeNull();
    expect(deps.summarize).not.toHaveBeenCalled();
  });

  it('does not cache a failed model result', async () => {
    const { deps, objects } = fixture({ t1: { summary: 'long', connection: 'c1' } });
    deps.summarize.mockResolvedValueOnce(undefined);
    expect(await getShortThreadSummary(deps, 't1', 'c1')).toBeNull();
    expect(objects.size).toBe(0);
    expect(await getShortThreadSummary(deps, 't1', 'c1')).toBe('short(long)');
  });
});
