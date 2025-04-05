/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { getDrafts, getDraft } from "@/actions/drafts";
import { InitialThread, ParsedMessage } from "@/types";
import { useSession } from "@/lib/auth-client";
import useSWRInfinite from "swr/infinite";
import useSWR, { preload } from "swr";
import { useMemo } from "react";

export const preloadDraft = (userId: string, draftId: string, connectionId: string) => {
  console.log(`🔄 Prefetching draft ${draftId}...`);
  preload([userId, draftId, connectionId], fetchDraft);
};

const fetchDrafts = async (args: any[]) => {
  const [_, query, max, pageToken] = args;

  const data = await getDrafts({ q: query, max, pageToken });
  return data;
};

const fetchDraft = async (args: any[]) => {
  const [_, id] = args;
  const data = await getDraft(id);
  return data;
};

interface RawResponse {
  nextPageToken: string | undefined;
  drafts: InitialThread[];
  resultSizeEstimate: number;
}

const getKey = (
  pageIndex: number,
  previousPageData: RawResponse | null,
  userId: string,
  query?: string,
  max?: number,
  connectionId?: string,
) => {
  if (previousPageData && !previousPageData.nextPageToken) return null;

  if (pageIndex === 0) {
    return [userId, query, max, undefined, connectionId];
  }

  return [userId, query, max, previousPageData?.nextPageToken, connectionId];
};

export const useDrafts = (query?: string, max?: number) => {
  const { data: session } = useSession();

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<RawResponse>(
      (pageIndex, previousPageData) =>
        session?.user.id
          ? getKey(
              pageIndex,
              previousPageData,
              session.user.id,
              query,
              max,
              session.connectionId ?? undefined,
            )
          : null,
      fetchDrafts,
      {
        revalidateOnMount: true,
        revalidateIfStale: true,
        revalidateAll: false,
        revalidateFirstPage: true,
      },
    );

  console.log("DATA:", data);

  const drafts = data
    ? data.flatMap((page) =>
        page.drafts.map((draft) => {
          console.log("DRAFT:", draft);
          return {
            ...draft,
            id: draft.id,
            threadId: draft.threadId,
            title: draft.title,
            subject: draft.subject,
            receivedOn: new Date().toISOString(),
            unread: false,
            totalReplies: 0,
          } as InitialThread;
        }),
      )
    : [];

  const isEmpty = data?.[0]?.drafts.length === 0;
  const isReachingEnd = isEmpty || (data && !data[data.length - 1]?.nextPageToken);
  const loadMore = () => setSize(size + 1);

  return {
    data: {
      drafts,
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

export const useDraft = (id: string) => {
  const { data: session } = useSession();

  const { data, isLoading, error, mutate } = useSWR<ParsedMessage[]>(
    session?.user.id ? [session.user.id, id, session.connectionId] : null,
    fetchDraft,
  );

  const hasUnread = useMemo(() => false, [data]);

  return { data, isLoading, error, hasUnread, mutate };
};
