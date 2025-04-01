'use client';

import { getMail, getMails, markAsRead } from '@/actions/mail';
import { useParams, useSearchParams } from 'next/navigation';
import type { InitialThread, ParsedMessage } from '@/types';
import { useSearchValue } from '@/hooks/use-search-value';
import { useSession } from '@/lib/auth-client';
import { defaultPageSize } from '@/lib/utils';
import useSWRInfinite from 'swr/infinite';
import useSWR, { preload } from 'swr';
import { useMemo } from 'react';

export const preloadThread = async (userId: string, threadId: string, connectionId: string) => {
  console.log(`🔄 Prefetching email ${threadId}...`);
  await preload([userId, threadId, connectionId], fetchThread(undefined));
};

type FetchEmailsTuple = [
  connectionId: string,
  folder: string,
  q?: string,
  max?: number,
  labelIds?: string[],
  pageToken?: string,
];

// TODO: improve the filters
const fetchEmails = async ([
  _,
  folder,
  q,
  max,
  labelIds,
  pageToken,
]: FetchEmailsTuple): Promise<RawResponse> => {
  try {
    const data = (await getMails({ folder, q, max, labelIds, pageToken })) as RawResponse;
    return data;
  } catch (error) {
    console.error('Error fetching emails:', error);
    throw error;
  }
};

const fetchThread = (cb: any) => async (args: any[]) => {
  const [_, id] = args;
  try {
    return await getMail({ id }).then((response) => {
      if (response) {
        if (cb) {
          const unreadMessages = response.filter((e) => e.unread).map((e) => e.id);
          if (unreadMessages.length) {
            markAsRead({ ids: unreadMessages }).then(() => {
              if (cb && typeof cb === 'function') cb();
            });
          }
        }
        return response;
      }
    });
  } catch (error) {
    console.error('Error fetching email:', error);
    throw error;
  }
};

// Based on gmail
interface RawResponse {
  nextPageToken: string | undefined;
  threads: InitialThread[];
  resultSizeEstimate: number;
}

const getKey = (
  previousPageData: RawResponse | null,
  [connectionId, folder, query, max, labelIds]: FetchEmailsTuple,
): FetchEmailsTuple | null => {
  if (previousPageData && !previousPageData.nextPageToken) return null; // reached the end);
  return [connectionId, folder, query, max, labelIds, previousPageData?.nextPageToken];
};

export const useThreads = () => {
  const { folder } = useParams<{ folder: string }>();
  const [searchValue] = useSearchValue();
  const { data: session } = useSession();

  const { data, error, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite(
    (_, previousPageData) => {
      if (!session?.user.id || !session.connectionId) return null;
      return getKey(previousPageData, [
        session.connectionId,
        folder,
        searchValue.value,
        defaultPageSize,
      ]);
    },
    fetchEmails,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateOnMount: true,
      refreshInterval: 30000 * 2,
    },
  );

  // Flatten threads from all pages and sort by receivedOn date (newest first)
  const threads = useMemo(() => (data ? data.flatMap((e) => e.threads) : []), [data]);
  const isEmpty = useMemo(() => threads.length === 0, [threads]);
  const isReachingEnd = isEmpty || (data && !data[data.length - 1]?.nextPageToken);
  const loadMore = async () => {
    if (isLoading || isValidating) return;
    await setSize(size + 1);
  };

  // Create a new mutate function that resets the pagination state
  const refresh = async () => {
    await mutate(undefined, { revalidate: true });
    // Reset the size to 1 to clear pagination
    await setSize(1);
  };

  return {
    data: {
      threads,
      nextPageToken: data?.[data.length - 1]?.nextPageToken,
    },
    isLoading,
    isValidating,
    error,
    loadMore,
    isReachingEnd,
    mutate: refresh,
  };
};

export const useThread = (threadId?: string) => {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const id = threadId ? threadId : searchParams.get('threadId');

  const { data, isLoading, error, mutate } = useSWR<ParsedMessage[]>(
    session?.user.id && id ? [session.user.id, id, session.connectionId] : null,
    fetchThread(undefined) as any,
  );

  const hasUnread = useMemo(() => data?.some((e) => e.unread), [data]);

  return { data, isLoading, error, hasUnread, mutate };
};
