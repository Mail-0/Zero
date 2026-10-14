import { useTRPC } from '@/providers/query-provider';
import { useQuery } from '@tanstack/react-query';
import { useAiEnabled } from './use-ai-enabled';

export const useSummary = (threadId: string | null) => {
  const trpc = useTRPC();
  const aiEnabled = useAiEnabled();
  const summaryQuery = useQuery(
    trpc.brain.generateSummary.queryOptions(
      { threadId: threadId! },
      {
        enabled: !!threadId && aiEnabled,
        // Summaries only change when the thread is re-indexed; don't refetch on every open.
        staleTime: 1000 * 60 * 60, // 1 hour
        gcTime: 1000 * 60 * 60,
        refetchOnWindowFocus: false,
      },
    ),
  );

  return summaryQuery;
};
