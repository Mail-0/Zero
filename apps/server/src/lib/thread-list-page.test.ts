import { withThreadListSummaries } from './thread-list-page';
import { toThreadListSummary } from './thread-list-summary';
import type { IGetThreadsResponse } from './driver/types';
import { describe, expect, it, vi } from 'vitest';
import type { ParsedMessage } from '../types';

describe('thread list page', () => {
  const page: IGetThreadsResponse = {
    threads: [
      { id: 'a', historyId: null },
      { id: 'b', historyId: null },
    ],
    nextPageToken: 'next',
  };

  it('reads all summaries together and preserves membership, order and cursor', async () => {
    const latest = { id: 'm', to: [], tags: [], body: 'private body' } as unknown as ParsedMessage;
    const summary = toThreadListSummary({
      latest,
      messages: [latest],
      labels: [],
      hasUnread: false,
      totalReplies: 1,
    });
    const read = vi.fn(async () => [summary, null]);
    const result = await withThreadListSummaries(page, read);
    expect(read).toHaveBeenCalledExactlyOnceWith(['a', 'b']);
    expect(result).toEqual({
      threads: [
        { ...page.threads[0], summary },
        { ...page.threads[1], summary: null },
      ],
      nextPageToken: 'next',
    });
    expect(JSON.stringify(result)).not.toContain('private body');
    expect(page.threads[0]).not.toHaveProperty('summary');
  });

  it('preserves membership for row-level retries when the summary read fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await withThreadListSummaries(page, async () => {
        throw new Error('R2 unavailable');
      });
      expect(result.threads.map((thread) => thread.summary)).toEqual([null, null]);
      expect(result.nextPageToken).toBe('next');
    } finally {
      warn.mockRestore();
    }
  });

  it('does not perform another read for an empty page', async () => {
    const empty = { threads: [], nextPageToken: null };
    const read = vi.fn();
    expect(await withThreadListSummaries(empty, read)).toBe(empty);
    expect(read).not.toHaveBeenCalled();
  });
});
