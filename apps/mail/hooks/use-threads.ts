import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import {
  emailContentQueryOptions,
  resolveEmailContentTheme,
  shouldLoadEmailImages,
} from '@/lib/email-content-query';
import { backgroundQueueAtom, isThreadInBackgroundQueueAtom } from '@/store/backgroundQueue';
import type { ThreadListSummary } from '../../server/src/lib/thread-list-summary';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { IGetThreadResponse } from '../../server/src/lib/driver/types';
import { useTRPC, useTRPCClient } from '@/providers/query-provider';
import { useSearchValue } from '@/hooks/use-search-value';
import useSearchLabels from './use-labels-search';
import { useSession } from '@/lib/auth-client';
import { useAtom, useAtomValue } from 'jotai';
import { useSettings } from './use-settings';
import type { ParsedMessage } from '@/types';
import { useParams } from 'react-router';
import { useTheme } from 'next-themes';
import { useQueryState } from 'nuqs';

/** mail.get freshness; socket/focus events invalidate cached threads. */
export const THREAD_STALE_TIME = 1000 * 60 * 60;

/** When each list summary object was received (see useThreads / useThreadRowData). */
const summaryStamps = new WeakMap<ThreadListSummary, number>();

export const useThreads = () => {
  const { folder } = useParams<{ folder: string }>();
  const [searchValue] = useSearchValue();
  const [backgroundQueue] = useAtom(backgroundQueueAtom);
  const isInQueue = useAtomValue(isThreadInBackgroundQueueAtom);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { labels } = useSearchLabels();

  const listInput = useMemo(
    () => ({ q: searchValue.value, folder, labelIds: labels }),
    [searchValue.value, folder, labels],
  );

  const threadsQuery = useInfiniteQuery(
    trpc.mail.listThreads.infiniteQueryOptions(listInput, {
      initialCursor: '',
      getNextPageParam: (lastPage) => lastPage?.nextPageToken ?? null,
      staleTime: 60 * 1000 * 1, // 1 minute
      refetchOnMount: true,
      refetchInterval: false, // Updates arrive through mailbox notifications and reconnect/focus catch-up.
    }),
  );

  // Flatten threads from all pages and sort by receivedOn date (newest first)

  const threads = useMemo(() => {
    if (!threadsQuery.data) return [];
    const items = threadsQuery.data.pages.flatMap((e) => e.threads).filter(Boolean);
    // Structural sharing keeps unchanged summaries' identity across refetches, so a summary
    // seen for the first time arrived with this dataUpdatedAt.
    for (const item of items) {
      if (item.summary && !summaryStamps.has(item.summary))
        summaryStamps.set(item.summary, threadsQuery.dataUpdatedAt);
    }
    return items.filter((e) => !isInQueue(`thread:${e.id}`));
  }, [threadsQuery.data, threadsQuery.dataUpdatedAt, isInQueue, backgroundQueue]);

  const isEmpty = useMemo(() => threads.length === 0, [threads]);
  const isReachingEnd =
    isEmpty ||
    (threadsQuery.data &&
      !threadsQuery.data.pages[threadsQuery.data.pages.length - 1]?.nextPageToken);

  const queryRef = useRef(threadsQuery);
  useLayoutEffect(() => {
    queryRef.current = threadsQuery;
  });

  const loadMore = useCallback(async () => {
    const query = queryRef.current;
    if (query.isLoading || query.isFetching || !query.hasNextPage) return;
    // Never cancel an in-flight refresh to append a page; the list re-checks once it settles.
    await query.fetchNextPage({ cancelRefetch: false });
  }, []);

  /**
   * Infinite queries refetch every loaded page sequentially, so a deep list makes every
   * socket/focus refresh N round trips. When the user is back at the top, drop pages they
   * can no longer see; scrolling down loads them again on demand.
   */
  const trimPages = useCallback(
    (keep: number) => {
      const query = queryRef.current;
      if (query.isFetching || (query.data?.pages.length ?? 0) <= keep) return;
      queryClient.setQueryData<InfiniteData<unknown, unknown>>(
        trpc.mail.listThreads.infiniteQueryKey(listInput),
        (data) =>
          data && {
            pages: data.pages.slice(0, keep),
            pageParams: data.pageParams.slice(0, keep),
          },
      );
    },
    [queryClient, trpc, listInput],
  );

  return [threadsQuery, threads, isReachingEnd, loadMore, trimPages] as const;
};

/** Row-level view of a thread: what the mail list renders, no bodies. */
export type ThreadRowData = ThreadListSummary;

const toRowData = (data: IGetThreadResponse | undefined): ThreadRowData | undefined => {
  const latest = data?.latest;
  if (!data || !latest?.id) return undefined;
  const recipients =
    (latest.to?.length ?? 0) + (latest.cc?.length ?? 0) + (latest.bcc?.length ?? 0);
  return {
    latest,
    labels: data.labels,
    hasUnread: data.hasUnread,
    totalReplies: data.totalReplies,
    hasDraft: data.messages.some((message) => message.isDraft),
    isGroupThread: recipients > 1,
  };
};

/**
 * Data for one mail-list row. Prefers the summary that arrived with the list page (no extra
 * request); only fetches `mail.get` when the page had no summary for this thread. A cached
 * `mail.get` that is newer than the page (e.g. the open thread refreshed by a socket push
 * before the coalesced list refresh) wins so the row never lags the open thread.
 */
export const useThreadRowData = (id: string, summary: ThreadListSummary | null | undefined) => {
  const trpc = useTRPC();
  const detail = useQuery(
    trpc.mail.get.queryOptions({ id }, { enabled: !summary, staleTime: THREAD_STALE_TIME }),
  );
  const detailRow = useMemo(() => toRowData(detail.data), [detail.data]);
  // Per-summary stamp (not the list's dataUpdatedAt) so loading another page doesn't
  // re-render every mounted row.
  const summaryUpdatedAt = summary ? (summaryStamps.get(summary) ?? 0) : 0;
  const useDetail = !!detailRow && (!summary || detail.dataUpdatedAt > summaryUpdatedAt);
  return useDetail ? detailRow : (summary ?? undefined);
};

/**
 * Warms `mail.get` and the latest message's processed body so opening a thread paints
 * without waiting. Called on hover/press intent rather than for every rendered row; the
 * keys MUST match ThreadDisplay/MailContent (see email-content-query.ts).
 */
export const useThreadPrefetch = () => {
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const { resolvedTheme } = useTheme();
  const latest = useRef({ settings: settings?.settings, resolvedTheme });
  useEffect(() => {
    latest.current = { settings: settings?.settings, resolvedTheme };
  });

  return useCallback(
    async (id: string) => {
      const options = trpc.mail.get.queryOptions({ id }, { staleTime: THREAD_STALE_TIME });
      try {
        await queryClient.prefetchQuery(options);
      } catch {
        return;
      }
      const thread = queryClient.getQueryData(options.queryKey);
      const message = thread?.messages.findLast((m: ParsedMessage) => !m.isDraft);
      const { settings: userSettings, resolvedTheme: theme } = latest.current;
      if (!message?.decodedBody || !userSettings) return;
      void queryClient.prefetchQuery(
        emailContentQueryOptions({
          messageId: message.id,
          html: message.decodedBody,
          shouldLoadImages: shouldLoadEmailImages(userSettings, message.sender?.email),
          theme: resolveEmailContentTheme(theme),
          process: (input) => trpcClient.mail.processEmailContent.mutate(input),
        }),
      );
    },
    [queryClient, trpc, trpcClient],
  );
};

/**
 * Thread for the given id, falling back to the `?threadId=` URL param.
 * Subscribes to URL state – prefer `useThreadById` when the id is always known
 * (list rows, message views) so search-param changes don't re-render the caller.
 */
export const useThread = (threadId: string | null) => {
  const [_threadId] = useQueryState('threadId');
  return useThreadById(threadId ? threadId : _threadId);
};

export const useThreadById = (id: string | null) => {
  const { data: session } = useSession();
  const trpc = useTRPC();
  const { data: settings } = useSettings();
  const { resolvedTheme } = useTheme();

  const threadQuery = useQuery(
    trpc.mail.get.queryOptions(
      {
        id: id!,
      },
      {
        enabled: !!id && !!session?.user.id,
        staleTime: THREAD_STALE_TIME,
      },
    ),
  );

  const { latestDraft, drafts, isGroupThread, finalData, latestMessage } = useMemo(() => {
    if (!threadQuery.data) {
      return {
        latestDraft: undefined,
        drafts: [] as ParsedMessage[],
        isGroupThread: false,
        finalData: undefined,
        latestMessage: undefined,
      };
    }

    const latestDraft = threadQuery.data.latest?.id
      ? threadQuery.data.messages.findLast((e) => e.isDraft)
      : undefined;

    const isGroupThread = threadQuery.data.latest?.id
      ? (() => {
          const totalRecipients = [
            ...(threadQuery.data.latest.to || []),
            ...(threadQuery.data.latest.cc || []),
            ...(threadQuery.data.latest.bcc || []),
          ].length;
          return totalRecipients > 1;
        })()
      : false;

    const nonDraftMessages = threadQuery.data.messages.filter((e) => !e.isDraft);
    const latestMessage = nonDraftMessages[nonDraftMessages.length - 1];

    const finalData: IGetThreadResponse = {
      ...threadQuery.data,
      messages: nonDraftMessages,
    };

    const drafts = threadQuery.data.messages.filter((e) => e.isDraft);

    return { latestDraft, drafts, isGroupThread, finalData, latestMessage };
  }, [threadQuery.data]);

  const { mutateAsync: processEmailContent } = useMutation(
    trpc.mail.processEmailContent.mutationOptions(),
  );

  // Prefetch the latest message's processed body so opening the thread can paint
  // without another round trip. Key MUST match MailContent – see email-content-query.ts.
  useQuery(
    emailContentQueryOptions({
      messageId: latestMessage?.id,
      html: latestMessage?.decodedBody,
      shouldLoadImages: shouldLoadEmailImages(settings?.settings, latestMessage?.sender?.email),
      theme: resolveEmailContentTheme(resolvedTheme),
      process: processEmailContent,
      enabled: !!latestMessage?.decodedBody && !!settings?.settings,
    }),
  );

  return { ...threadQuery, data: finalData, isGroupThread, latestDraft, drafts };
};
