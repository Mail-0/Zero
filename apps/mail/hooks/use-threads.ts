"use client";

import type { InitialThread, ParsedMessage } from '@/types';
import { getMail, getMails } from '@/actions/mail';
import { useSession } from '@/lib/auth-client';
import useSWRInfinite from 'swr/infinite';
import useSWR, { preload } from 'swr';
import { useMemo } from 'react';

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
    const data = await getMails({ folder, q, max, labelIds, pageToken });
    return data as RawResponse;
  } catch (error) {
    console.error("Error fetching emails:", error);
    throw error;
  }
};

const fetchThread = async (args: any[]) => {
  const [_, id] = args;
  try {
		return await getMail({ id });
  } catch (error) {
    console.error("Error fetching email:", error);
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
  if (previousPageData && !previousPageData.nextPageToken) return null; // reached the end

  return [connectionId, folder, query, max, labelIds, previousPageData?.nextPageToken];
};

export const useThreads = (folder: string, labelIds?: string[], query?: string, max?: number) => {
  const { data: session } = useSession();

  const { data, error, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite(
    (_, previousPageData) => {
      if (!session?.user.id || !session.connectionId) return null;
      return getKey(previousPageData, [session.connectionId, folder, query, max, labelIds]);
    },
    fetchEmails,
    {
      persistSize: false,
      revalidateIfStale: true,
      revalidateAll: false,
      revalidateOnMount: true,
      revalidateFirstPage: true,
    },
  );

  // Flatten threads from all pages and sort by receivedOn date (newest first)
  const threads = data ? data.flatMap((e) => e.threads).sort((a, b) => {
    // Parse dates and compare them (newest first)
    const dateA = new Date(a.receivedOn || '');
    const dateB = new Date(b.receivedOn || '');
    return dateB.getTime() - dateA.getTime();
  }) : [];
  const isEmpty = data?.[0]?.threads.length === 0;
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

export const useThread = (id: string | null) => {
  const { data: session } = useSession();

  const { data, isLoading, error, mutate } = useSWR<ParsedMessage[]>(
    session?.user.id && id ? [session.user.id, id, session.connectionId] : null,
    fetchThread as any,
  );

  const hasUnread = useMemo(() => data?.some((e) => e.unread), [data]);

  return { data, isLoading, error, hasUnread, mutate };
};
