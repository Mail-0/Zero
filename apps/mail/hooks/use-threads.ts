/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { getMail, getMails } from "@/actions/mail";
import { InitialThread, ParsedMessage } from "@/types";
import { useSession } from "@/lib/auth-client";
import useSWR, { preload } from "swr";
import useSWRInfinite from 'swr/infinite'
import { useMemo } from "react";

export const preloadThread = (userId: string, threadId: string, connectionId: string) => {
  console.log(`🔄 Prefetching email ${threadId}...`);
  preload([userId, threadId, connectionId], fetchThread);
};

// TODO: improve the filters
const fetchEmails = async (args: any[]) => {
  const [_, folder, query, max, labelIds, pageToken] = args;

  const data = await getMails({ folder, q: query, max, labelIds, pageToken });

  return data;
};

const fetchThread = async (args: any[]) => {
  const [_, id] = args;
  const data = await getMail({ id });
  return data;
};

// Based on gmail
interface RawResponse {
  nextPageToken: string | undefined;
  threads: InitialThread[];
  resultSizeEstimate: number;
}

const getKey = (
  pageIndex: number,
  previousPageData: RawResponse | null,
  userId: string,
  folder: string,
  query?: string,
  max?: number,
  labelIds?: string[],
  connectionId?: string
) => {
  // reached the end
  if (previousPageData && !previousPageData.nextPageToken) return null;

  // first page, we don't have previousPageData
  if (pageIndex === 0) {
    return [userId, folder, query, max, labelIds, undefined, connectionId];
  }

  // add the pageToken to the API endpoint
  return [userId, folder, query, max, labelIds, previousPageData?.nextPageToken, connectionId];
};

export const useThreads = (
  folder: string,
  labelIds?: string[],
  query?: string,
  max?: number,
) => {
  const { data: session } = useSession();

  const { data, error, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite<RawResponse>(
    (pageIndex, previousPageData) =>
      session?.user.id 
        ? getKey(
          pageIndex,
          previousPageData,
          session.user.id,
          folder,
          query,
          max,
          labelIds,
          session.connectionId ?? undefined
        )
        : null,
    fetchEmails as any,
    { revalidateAll: true, revalidateOnMount: true, parallel: true }
  );

  const threads = data ? data.flatMap(page => page.threads) : [];
  const isEmpty = data?.[0]?.threads.length === 0;
  const isReachingEnd = isEmpty || (data && !data[data.length - 1]?.nextPageToken);
  const loadMore = () => setSize(size + 1);

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
    mutate
  };
};

export const useThread = (id: string) => {
  const { data: session } = useSession();

  const { data, isLoading, error, mutate } = useSWR<ParsedMessage[]>(
    session?.user.id ? [session.user.id, id, session.connectionId] : null,
    fetchThread as any,
  );

  const hasUnread = useMemo(() => data?.some(e => e.unread), [data]);

  return { data, isLoading, error, hasUnread, mutate };
};
