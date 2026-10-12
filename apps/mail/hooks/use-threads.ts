import { backgroundQueueAtom, isThreadInBackgroundQueueAtom } from '@/store/backgroundQueue';
import {
  emailContentQueryOptions,
  resolveEmailContentTheme,
  shouldLoadEmailImages,
} from '@/lib/email-content-query';
import { useInfiniteQuery, useQuery, useMutation } from '@tanstack/react-query';
import type { IGetThreadResponse } from '../../server/src/lib/driver/types';
import { useSearchValue } from '@/hooks/use-search-value';
import { useTRPC } from '@/providers/query-provider';
import useSearchLabels from './use-labels-search';
import { useSession } from '@/lib/auth-client';
import { useAtom, useAtomValue } from 'jotai';
import { useSettings } from './use-settings';
import { useParams } from 'react-router';
import { useTheme } from 'next-themes';
import { useQueryState } from 'nuqs';
import { useMemo } from 'react';

export const useThreads = () => {
  const { folder } = useParams<{ folder: string }>();
  const [searchValue] = useSearchValue();
  const [backgroundQueue] = useAtom(backgroundQueueAtom);
  const isInQueue = useAtomValue(isThreadInBackgroundQueueAtom);
  const trpc = useTRPC();
  const { labels } = useSearchLabels();

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
        staleTime: 60 * 1000 * 1, // 1 minute
        refetchOnMount: true,
        refetchInterval: false, // Updates arrive through mailbox notifications and reconnect/focus catch-up.
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
        staleTime: 1000 * 60 * 60, // 1 hour; socket/focus events invalidate cached threads
      },
    ),
  );

  const { latestDraft, isGroupThread, finalData, latestMessage } = useMemo(() => {
    if (!threadQuery.data) {
      return {
        latestDraft: undefined,
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

    return { latestDraft, isGroupThread, finalData, latestMessage };
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

  return { ...threadQuery, data: finalData, isGroupThread, latestDraft };
};
