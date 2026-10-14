import { useInfiniteQuery } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';
import { useCallback, useMemo } from 'react';

/**
 * Inbox threads across every connected account, merged newest-first by the server
 * (see `mail.listUnifiedInbox`). Each thread carries the `connectionId` it belongs to.
 */
export const useUnifiedInbox = () => {
  const trpc = useTRPC();

  const query = useInfiniteQuery(
    trpc.mail.listUnifiedInbox.infiniteQueryOptions(
      {},
      {
        initialCursor: '',
        getNextPageParam: (lastPage) => lastPage?.nextPageToken || null,
        staleTime: 60 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
      },
    ),
  );

  const threads = useMemo(() => {
    if (!query.data) return [];
    const seen = new Set<string>();
    return query.data.pages
      .flatMap((page) => page.threads)
      .filter((thread) => {
        const key = `${thread.connectionId}:${thread.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [query.data]);

  const lastPage = query.data?.pages[query.data.pages.length - 1];
  const connections = useMemo(() => lastPage?.connections ?? [], [lastPage?.connections]);
  const failedConnectionIds = useMemo(
    () => lastPage?.failedConnectionIds ?? [],
    [lastPage?.failedConnectionIds],
  );

  const { isFetching, hasNextPage, fetchNextPage } = query;
  const loadMore = useCallback(() => {
    if (isFetching || !hasNextPage) return;
    void fetchNextPage({ cancelRefetch: false });
  }, [isFetching, hasNextPage, fetchNextPage]);

  return { query, threads, connections, failedConnectionIds, loadMore };
};
