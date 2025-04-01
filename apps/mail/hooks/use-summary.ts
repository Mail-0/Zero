'use client';
import { GetSummary } from '@/actions/getSummary';
import useSWR from 'swr';

export const useSummary = (threadId: string) => {
  const { data } = useSWR(`ai:summary:${threadId}`, async () => {
    return await GetSummary(threadId);
  });

  return { data };
};
