import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';

export const useCombinedThreads = () => {
  const trpc = useTRPC();

  return useQuery(
    trpc.mail.listAllThreads.queryOptions(
      { folder: 'inbox', maxResultsPerAccount: 20 },
      {
        staleTime: 60 * 1000,
        refetchOnMount: true,
        refetchIntervalInBackground: true,
      },
    ),
  );
};
