import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backgroundQueueAtom, isThreadInBackgroundQueueAtom } from '@/store/backgroundQueue';
import type { IGetThreadResponse } from '../../server/src/lib/driver/types';
import { useSearchValue } from '@/hooks/use-search-value';
import { useTRPC } from '@/providers/query-provider';
import useSearchLabels from './use-labels-search';
import { useSession } from '@/lib/auth-client';
import { useAtom, useAtomValue } from 'jotai';
import { useSettings } from './use-settings';
import { usePrevious } from './use-previous';
import type { ParsedMessage } from '@/types';
import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router';
import { useTheme } from 'next-themes';
import { useQueryState } from 'nuqs';

export const useThreads = () => {
  const { folder } = useParams<{ folder: string }>();
  const [searchValue] = useSearchValue();
  const [backgroundQueue] = useAtom(backgroundQueueAtom);
  const isInQueue = useAtomValue(isThreadInBackgroundQueueAtom);
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

  // Flatten threads from all pages and sort by receivedOn date (newest first)

  const threads = useMemo(() => {
    return threadsQuery.data
      ? threadsQuery.data.pages
          .flatMap((e) => e.threads)
          .filter(Boolean)
          .filter((e) => !isInQueue(`thread:${e.id}`))
      : [];
  }, [threadsQuery.data, threadsQuery.dataUpdatedAt, isInQueue, backgroundQueue]);

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
  //   const { data } = useSettings();
  //   const { resolvedTheme } = useTheme();

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

  //   const isTrustedSender = useMemo(
  //     () =>
  //       !!data?.settings?.externalImages ||
  //       !!data?.settings?.trustedSenders?.includes(threadQuery.data?.latest?.sender.email ?? ''),
  //     [data?.settings, threadQuery.data?.latest?.sender.email],
  //   );

  const latestDraft = useMemo(() => {
    if (!threadQuery.data?.latest?.id) return undefined;
    return threadQuery.data.messages.findLast((e) => e.isDraft);
  }, [threadQuery]);

  //   const { mutateAsync: processEmailContent } = useMutation(
  //     trpc.mail.processEmailContent.mutationOptions(),
  //   );

  //   const prefetchEmailContent = async (message: ParsedMessage) => {
  //     return queryClient.prefetchQuery({
  //       queryKey: ['email-content', message.id, isTrustedSender, resolvedTheme],
  //       queryFn: async () => {
  //         const result = await processEmailContent({
  //           html: message.decodedBody ?? '',
  //           shouldLoadImages: isTrustedSender,
  //           theme: (resolvedTheme as 'light' | 'dark') || 'light',
  //         });

  //         return {
  //           html: result.processedHtml,
  //           hasBlockedImages: result.hasBlockedImages,
  //         };
  //       },
  //     });
  //   };

  //   useEffect(() => {
  //     if (!threadQuery.data?.latest?.id) return;
  //     prefetchEmailContent(threadQuery.data.latest);
  //   }, [threadQuery.data?.latest]);

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
