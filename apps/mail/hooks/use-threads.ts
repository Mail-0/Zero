'use client';

import { getMail, getMails, markAsRead } from '@/actions/mail';
import { useParams, useSearchParams } from 'next/navigation';
import type { InitialThread, ParsedMessage } from '@/types';
import { useSearchValue } from '@/hooks/use-search-value';
import { useConnections } from '@/hooks/use-connections';
import { useMail } from '@/components/mail/use-mail';
import { useSession } from '@/lib/auth-client';
import { defaultPageSize } from '@/lib/utils';
import { useMemo, useEffect } from 'react';
import useSWRInfinite from 'swr/infinite';
import useSWR, { preload } from 'swr';

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
  unifiedInbox?: boolean,
];

// TODO: improve the filters
const fetchEmails = async ([
  connectionId,
  folder,
  q,
  max,
  labelIds,
  pageToken,
  unifiedInbox = false,
]: FetchEmailsTuple): Promise<RawResponse> => {
  try {
    const data = await getMails({
      folder,
      q,
      max,
      labelIds,
      pageToken,
      connectionId,
      unifiedInbox,
    });
    return data as RawResponse;
  } catch (error) {
    console.error('Error fetching emails:', error);
    throw error;
  }
};

const fetchThread = (cb: any) => async (args: any[]) => {
  const [_, id, connectionId] = args;
  try {
    return await getMail({ id, connectionId }).then((response) => {
      if (response) {
        if (cb) {
          const unreadMessages = response.filter((e) => e.unread).map((e) => e.id);
          if (unreadMessages.length) {
            markAsRead({ ids: unreadMessages, connectionId }).then(() => {
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
  connectionId?: string;
}

const getKey = (
  previousPageData: RawResponse | null,
  [connectionId, folder, query, max, labelIds, unifiedInbox]: FetchEmailsTuple,
): FetchEmailsTuple | null => {
  if (previousPageData && !previousPageData.nextPageToken) return null; // reached the end

  return [
    connectionId,
    folder,
    query,
    max,
    labelIds,
    previousPageData?.nextPageToken,
    unifiedInbox,
  ];
};

export const useThreads = () => {
  const { folder } = useParams<{ folder: string }>();
  const [searchValue] = useSearchValue();
  const { data: session } = useSession();
  const [mail] = useMail();
  const { data: connections } = useConnections();

  const isUnified = mail.unifiedInbox && connections && connections.length > 1;

  const { data, error, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite(
    (_, previousPageData) => {
      if (!session?.user.id) return null;

      if (!session.connectionId) return null;
      return getKey(previousPageData, [
        session.connectionId,
        folder,
        searchValue.value,
        defaultPageSize,
        [],
        isUnified,
      ]);
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
  const threads = data
    ? data
        .flatMap((e) => e.threads)
        .sort((a, b) => {
          // Parse dates and compare them (newest first)
          const dateA = new Date(a.receivedOn || '');
          const dateB = new Date(b.receivedOn || '');
          return dateB.getTime() - dateA.getTime();
        })
    : [];

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
    isUnified,
  };
};

export const useThread = () => {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const id = searchParams.get('threadId');
  const threadConnectionId = searchParams.get('connectionId');
  const { mutate: mutateThreads } = useThreads();
  const { data: threads } = useThreads();

  // Find the thread in the list to get its connectionId if not directly provided
  const specificThread = useMemo(() => {
    if (!id || !threads?.threads) return null;
    return threads.threads.find((thread) => (thread.threadId || thread.id) === id);
  }, [id, threads]);

  // Use either the connectionId from URL params, from the thread itself, or fall back to session
  const connectionIdToUse =
    threadConnectionId || specificThread?.connectionId || session?.connectionId;

  const { data, isLoading, error, mutate } = useSWR<ParsedMessage[]>(
    session?.user.id && id ? [session.user.id, id, connectionIdToUse] : null,
    fetchThread(mutateThreads) as any,
  );

  const hasUnread = useMemo(() => data?.some((e) => e.unread), [data]);
  return { data, isLoading, error, hasUnread, mutate };
};
