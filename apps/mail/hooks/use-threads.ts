'use client';
import { backgroundQueueAtom, isThreadInBackgroundQueueAtom } from '@/store/backgroundQueue';
import { useParams, useSearchParams } from 'next/navigation';
import { IGetThreadResponse } from '@/app/api/driver/types';
import type { InitialThread, ParsedMessage } from '@/types';
import { useSearchValue } from '@/hooks/use-search-value';
import { useSession } from '@/lib/auth-client';
import { defaultPageSize } from '@/lib/utils';
import { useAtom, useAtomValue } from 'jotai';
import { Label } from '@/hooks/use-labels';
import useSWRInfinite from 'swr/infinite';
import useSWR, { preload } from 'swr';
import { useQueryState } from 'nuqs';
import { useMemo } from 'react';
import { toast } from 'sonner';
import axios from 'axios';

export const preloadThread = async (userId: string, threadId: string, connectionId: string) => {
  console.log(`🔄 Prefetching email ${threadId}...`);
  await preload([userId, threadId, connectionId], fetchThread);
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
    const searchParams = new URLSearchParams({
      folder,
      q,
      max: max?.toString() ?? defaultPageSize.toString(),
      pageToken: pageToken ?? '',
    } as Record<string, string>);
    const response = await axios.get<RawResponse>(`/api/driver?${searchParams.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching emails:', error);
    throw error;
  }
};

const fetchThread = async (args: any[]) => {
  const [_, id] = args;
  try {
    const response = await axios.get<IGetThreadResponse>(`/api/driver/${id}`);
    return response.data;
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

// Deprecated, we move this to be prefetched on the server
export const useThreads = () => {
  const { folder } = useParams<{ folder: string }>();
  const [searchValue] = useSearchValue();
  const { data: session } = useSession();
  const [backgroundQueue] = useAtom(backgroundQueueAtom);
  const isInQueue = useAtomValue(isThreadInBackgroundQueueAtom);

  const { data, error, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite(
    (_, previousPageData) => {
      if (!session?.user.id || !session.connectionId) return null;
      return getKey(previousPageData, [
        session.connectionId,
        folder,
        searchValue.value, // Always apply search filter
        defaultPageSize,
      ]);
    },
    async (key) => {
      const [, folder, query, max, , pageToken] = key;
      const searchParams = new URLSearchParams({
        q: query,
        folder,
        max: max?.toString() ?? defaultPageSize.toString(),
        pageToken: pageToken ?? '',
      } as Record<string, string>);
      console.log('Fetching emails with params:', {
        q: query,
        folder,
        max: max?.toString() ?? defaultPageSize.toString(),
        pageToken: pageToken ?? '',
      });
      const res = await axios.get<RawResponse>(`/api/driver?${searchParams.toString()}`);
      return res.data;
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateOnMount: true,
      refreshInterval: 30000 * 2,
    },
  );

  // Flatten threads from all pages and sort by receivedOn date (newest first)
  const threads = useMemo(
    () =>
      data
        ? data
            .flatMap((e) => e.threads)
            .filter(Boolean)
            .filter((e) => !isInQueue(`thread:${e.id}`))
        : [],
    [data, session, backgroundQueue, isInQueue],
  );
  const isEmpty = useMemo(() => threads.length === 0, [threads]);
  const isReachingEnd = isEmpty || (data && !data[data.length - 1]?.nextPageToken);
  const loadMore = async () => {
    if (isLoading || isValidating) return;
    await setSize(size + 1);
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
    mutate,
  };
};

export const useThread = (threadId: string | null) => {
  const { data: session } = useSession();
  const [_threadId] = useQueryState('threadId');
  const id = threadId ? threadId : _threadId;

  const { data, isLoading, error, mutate } = useSWR<IGetThreadResponse>(
    session?.user.id && id ? [session.user.id, id, session.connectionId] : null,
    () => axios.get<IGetThreadResponse>(`/api/driver/${id}`).then((res) => res.data),
  );

  const hasUnread = useMemo(() => data?.messages.some((e) => e.unread), [data]);

  return { data, isLoading, error, hasUnread, mutate };
};
