import type { PersistedClient } from '@tanstack/react-query-persist-client';
import { trimPersistedClient } from './persist-trim';
import { describe, expect, it } from 'vitest';

const query = (data: unknown) =>
  ({
    queryKey: ['k'],
    queryHash: 'k',
    state: { data },
  }) as unknown as PersistedClient['clientState']['queries'][number];

const client = (queries: PersistedClient['clientState']['queries']): PersistedClient => ({
  timestamp: 0,
  buster: '',
  clientState: { queries, mutations: [] },
});

describe('trimPersistedClient', () => {
  it('keeps only the first list pages without mutating the live cache data', () => {
    const data = { pages: [1, 2, 3, 4], pageParams: ['', 'a', 'b', 'c'] };
    const input = client([query(data), query({ messages: [] })]);
    const out = trimPersistedClient(input);

    expect(out.clientState.queries[0]!.state.data).toEqual({
      pages: [1, 2],
      pageParams: ['', 'a'],
    });
    expect(out.clientState.queries[1]).toBe(input.clientState.queries[1]);
    expect(data.pages).toHaveLength(4);
  });

  it('returns the same object when nothing needs trimming', () => {
    const input = client([query({ pages: [1], pageParams: [''] })]);
    expect(trimPersistedClient(input)).toBe(input);
  });
});
