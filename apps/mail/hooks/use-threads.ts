/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { getMail, getMails, markAsRead as markAsReadAction } from "@/actions/mail";
import { InitialThread, ParsedMessage } from "@/types";
import { useSession } from "@/lib/auth-client";
import useSWR, { preload } from "swr";

export const preloadThread = (userId: string, threadId: string, connectionId: string) => {
  console.log(`🔄 Prefetching email ${threadId}...`);
  preload([userId, threadId, connectionId], fetchThread);
};

// TODO: improve the filters
const fetchEmails = async (args: any[]) => {
  const [_, folder, query, max, labelIds, pageToken] = args;

  const searchParams = new URLSearchParams();
  if (max) searchParams.set("max", max.toString());
  if (query) searchParams.set("q", query);
  if (folder) searchParams.set("folder", folder.toString());
  if (labelIds) searchParams.set("labelIds", labelIds.join(","));
  if (pageToken) searchParams.set("pageToken", pageToken);

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

export const useThreads = (
  folder: string,
  labelIds?: string[],
  query?: string,
  max?: number,
  pageToken?: string,
) => {
  const { data: session } = useSession();
  const { data, isLoading, error, isValidating } = useSWR<RawResponse>(
    session?.user.id
      ? [session?.user.id, folder, query, max, labelIds, pageToken, session.connectionId]
      : null,
    fetchEmails,
  );

  return {
    data: data,
    isLoading: isLoading,
    isValidating: isValidating,
    error,
  };
};

export const useThread = (id: string) => {
  const { data: session } = useSession();

  const { data, isLoading, error } = useSWR<ParsedMessage[]>(
    session?.user.id ? [session.user.id, id, session.connectionId] : null,
    fetchThread,
  );

  return { data, isLoading, error };
};
