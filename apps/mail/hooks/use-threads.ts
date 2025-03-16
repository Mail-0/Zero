/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import type { InitialThread, ParsedMessage } from "@/types";
import { getMail, getMails } from "@/actions/mail";
import { useSession } from "@/lib/auth-client";
import useSWRInfinite from "swr/infinite";
import useSWR, { preload } from "swr";
import { useMemo } from "react";

export const preloadThread = async (userId: string, threadId: string, connectionId: string) => {
  console.log(`🔄 Prefetching email ${threadId}...`);
  await preload([userId, threadId, connectionId], fetchThread);
};

type FetchEmailsTuple = [
  folder: string,
  q?: string,
  max?: number,
  labelIds?: string[],
  pageToken?: string,
];

// TODO: improve the filters
const fetchEmails = async ([
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
    const data = await getMail({ id });
    return data;
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
  pageIndex: number,
  previousPageData: RawResponse | null,
  [folder, query, max, labelIds]: FetchEmailsTuple,
): FetchEmailsTuple | null => {
  if (previousPageData && !previousPageData.nextPageToken) return null; // reached the end

  return [folder, query, max, labelIds, previousPageData?.nextPageToken];
};

export const useThreads = (folder: string, labelIds?: string[], query?: string, max?: number) => {
  const { data: session } = useSession();

  const { data, error, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite(
    (pageIndex, previousPageData) => {
      if (!session?.user.id) return null;
      return getKey(pageIndex, previousPageData, [folder, query, max, labelIds]);
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

  const threads = data ? data.flatMap((e) => e.threads) : [];
  const isEmpty = data?.[0]?.threads.length === 0;
  const isReachingEnd = isEmpty || (data && !data[data.length - 1]?.nextPageToken);
  const loadMore = async () => {
    if (isLoading || isValidating) return;
    await setSize(size + 1);
  };

  const optimisticUpdate = (id: string, update: Partial<InitialThread>) => {
    mutate((currentPages) => {
      if (!currentPages) return currentPages;

      return currentPages.map((page) => ({
        ...page,
        threads: page.threads.map((thread) => {
          if (thread.id === id) {
            return {
              ...thread,
              ...update,
            };
          }
          return thread;
        }),
      }));
    }, false);
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
    optimisticUpdate,
  };
};

export const useThread = (id: string) => {
  const { data: session } = useSession();

  const { data, isLoading, error, mutate } = useSWR<ParsedMessage[]>(
    session?.user.id ? [session.user.id, id, session.connectionId] : null,
    fetchThread as any,
  );

  const hasUnread = useMemo(() => data?.some((e) => e.unread), [data]);

  return { data, isLoading, error, hasUnread, mutate };
};
