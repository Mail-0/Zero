import type { PersistedClient } from '@tanstack/react-query-persist-client';

/** Infinite list pages kept in the IndexedDB snapshot; deeper pages reload on scroll. */
const PERSISTED_LIST_PAGES = 2;

type DehydratedInfinite = { pages: unknown[]; pageParams: unknown[] };

const isInfiniteData = (data: unknown): data is DehydratedInfinite =>
  !!data &&
  typeof data === 'object' &&
  Array.isArray((data as DehydratedInfinite).pages) &&
  Array.isArray((data as DehydratedInfinite).pageParams);

/**
 * Deep-scrolled lists would otherwise grow the snapshot (structured-cloned on the main
 * thread on every write) with every page loaded. Dehydrated state shares references with
 * the live cache, so build new objects rather than mutating.
 */
export function trimPersistedClient(client: PersistedClient): PersistedClient {
  let changed = false;
  const queries = client.clientState.queries.map((query) => {
    const data = query.state.data;
    if (!isInfiniteData(data) || data.pages.length <= PERSISTED_LIST_PAGES) return query;
    changed = true;
    return {
      ...query,
      state: {
        ...query.state,
        data: {
          pages: data.pages.slice(0, PERSISTED_LIST_PAGES),
          pageParams: data.pageParams.slice(0, PERSISTED_LIST_PAGES),
        },
      },
    };
  });
  return changed ? { ...client, clientState: { ...client.clientState, queries } } : client;
}
