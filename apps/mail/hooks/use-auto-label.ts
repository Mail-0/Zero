import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';
import { toast } from 'sonner';

export function useAutoLabel(threadId?: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const classification = useQuery(
    trpc.autoLabel.classify.queryOptions(
      { threadId: threadId ?? '' },
      {
        enabled: Boolean(threadId),
        staleTime: 5 * 60 * 1000,
      },
    ),
  );
  const applyMutation = useMutation(
    trpc.autoLabel.apply.mutationOptions({
      onSuccess: async (result) => {
        if (result.applied) {
          toast.success(`${result.labelName} label applied`);
        } else {
          toast.info(result.reason);
        }
        await Promise.all([
          queryClient.invalidateQueries(trpc.autoLabel.classify.queryFilter()),
          queryClient.invalidateQueries(trpc.labels.list.queryFilter()),
          queryClient.invalidateQueries(trpc.mail.get.queryFilter()),
          queryClient.invalidateQueries(trpc.mail.listThreads.infiniteQueryFilter()),
        ]);
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to apply the suggested label');
      },
    }),
  );

  return {
    ...classification,
    applySuggestion: () => {
      if (!threadId) return;
      applyMutation.mutate({ threadId });
    },
    isApplying: applyMutation.isPending,
  };
}
