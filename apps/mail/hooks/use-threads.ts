import { backgroundQueueAtom, isThreadInBackgroundQueueAtom } from '@/store/backgroundQueue';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IGetThreadResponse } from '../../server/src/lib/driver/types';
import { useSearchValue } from '@/hooks/use-search-value';
import { useTRPC } from '@/providers/query-provider';
import useSearchLabels from './use-labels-search';
import { useSession } from '@/lib/auth-client';
import { useAtom, useAtomValue } from 'jotai';
import { usePrevious } from './use-previous';
import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router';
import { useQueryState } from 'nuqs';
import { optimisticActionsAtom } from '@/store/optimistic-updates';

export const useThreads = () => {
  const { folder } = useParams<{ folder: string }>();
  const [searchValue] = useSearchValue();
  const { data: session } = useSession();
  const [backgroundQueue] = useAtom(backgroundQueueAtom);
  const isInQueue = useAtomValue(isThreadInBackgroundQueueAtom);
  const optimisticActions = useAtomValue(optimisticActionsAtom);
  const trpc = useTRPC();
  const { labels, setLabels } = useSearchLabels();

  const threadsQuery = useInfiniteQuery(
    trpc.mail.listThreads.infiniteQueryOptions(
      {
        q: searchValue.value,
        folder,
        labelIds: labels,
      },
      {
        initialCursor: '',
        getNextPageParam: (lastPage) => lastPage?.nextPageToken ?? null,
        staleTime: 60 * 1000 * 60, // 1 minute
        refetchOnMount: true,
        refetchIntervalInBackground: true,
      },
    ),
  );

  const shouldHideThread = useMemo(() => {
    const hideSet = new Set<string>();
    
    Object.values(optimisticActions).forEach((action) => {
      if (action.type === 'MOVE' && action.source === folder) {
        action.threadIds.forEach((id) => hideSet.add(id));
      }
    });
    
    return (threadId: string) => hideSet.has(threadId);
  }, [optimisticActions, folder]);

  const threads = useMemo(() => {
    return threadsQuery.data
      ? threadsQuery.data.pages
          .flatMap((e) => e.threads)
          .filter(Boolean)
          .filter((e) => !isInQueue(`thread:${e.id}`))
          .filter((e) => !shouldHideThread(e.id))
      : [];
  }, [threadsQuery.data, threadsQuery.dataUpdatedAt, isInQueue, backgroundQueue, shouldHideThread]);

  const THRESHOLD = 100;
  const PREFETCH_PAGES = 3;

  useEffect(() => {
    if (
      threads.length < THRESHOLD &&
      threadsQuery.hasNextPage &&
      !threadsQuery.isFetchingNextPage &&
      !threadsQuery.isLoading
    ) {
      void threadsQuery.fetchNextPage();
    }
  }, [threads.length, threadsQuery.hasNextPage, threadsQuery.isFetchingNextPage, threadsQuery.isLoading]);

  useEffect(() => {
    const loadedPages = threadsQuery.data?.pages.length ?? 0;
    if (
      loadedPages < PREFETCH_PAGES &&
      threadsQuery.hasNextPage &&
      !threadsQuery.isFetchingNextPage &&
      !threadsQuery.isLoading
    ) {
      void threadsQuery.fetchNextPage();
    }
  }, [threadsQuery.data?.pages.length, threadsQuery.hasNextPage, threadsQuery.isFetchingNextPage, threadsQuery.isLoading]);

  useEffect(() => {
    const optimisticlyRemovedCount = Object.values(optimisticActions).reduce((count, action) => {
      if (action.type === 'MOVE' && action.source === folder) {
        return count + action.threadIds.length;
      }
      return count;
    }, 0);

    if (
      optimisticlyRemovedCount > 20 &&
      threadsQuery.hasNextPage &&
      !threadsQuery.isFetchingNextPage &&
      !threadsQuery.isLoading
    ) {
      void threadsQuery.fetchNextPage();
    }
  }, [optimisticActions, folder, threadsQuery.hasNextPage, threadsQuery.isFetchingNextPage, threadsQuery.isLoading]);

  const isEmpty = useMemo(() => threads.length === 0, [threads]);
  const isReachingEnd =
    isEmpty ||
    (threadsQuery.data &&
      !threadsQuery.data.pages[threadsQuery.data.pages.length - 1]?.nextPageToken);

  const loadMore = async () => {
    if (threadsQuery.isLoading || threadsQuery.isFetching) return;
    await threadsQuery.fetchNextPage();
  };

  return [threadsQuery, threads, isReachingEnd, loadMore] as const;
};

export const useThread = (threadId: string | null, historyId?: string | null) => {
  const { data: session } = useSession();
  const [_threadId] = useQueryState('threadId');
  const id = threadId ? threadId : _threadId;
  const trpc = useTRPC();

  const previousHistoryId = usePrevious(historyId ?? null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!historyId || !previousHistoryId || historyId === previousHistoryId) return;
    queryClient.invalidateQueries({ queryKey: trpc.mail.get.queryKey({ id: id! }) });
  }, [historyId, previousHistoryId, id]);

  const threadQuery = useQuery(
    trpc.mail.get.queryOptions(
      {
        id: id!,
      },
      {
        enabled: !!id && !!session?.user.id,
        staleTime: 1000 * 60 * 60, // 60 minutes
      },
    ),
  );

  const latestDraft = useMemo(() => {
    if (!threadQuery.data?.latest?.id) return undefined;
    return threadQuery.data.messages.findLast((e) => e.isDraft);
  }, [threadQuery]);

  const isGroupThread = useMemo(() => {
    if (!threadQuery.data?.latest?.id) return false;
    const totalRecipients = [
      ...(threadQuery.data.latest.to || []),
      ...(threadQuery.data.latest.cc || []),
      ...(threadQuery.data.latest.bcc || []),
    ].length;
    return totalRecipients > 1;
  }, [threadQuery.data]);

  const finalData: IGetThreadResponse | undefined = useMemo(() => {
    if (!threadQuery.data) return undefined;
    return {
      ...threadQuery.data,
      messages: threadQuery.data?.messages.filter((e) => !e.isDraft),
    };
  }, [threadQuery.data]);

  return { ...threadQuery, data: finalData, isGroupThread, latestDraft };
};
