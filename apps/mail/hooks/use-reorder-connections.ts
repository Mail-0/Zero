import { useTRPC } from '@/providers/query-provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const useReorderConnections = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { mutateAsync: reorderConnections } = useMutation({
    ...trpc.connections.reorder.mutationOptions(),
    onSuccess: () => {
      // Invalidate connections queries to refetch updated order
      queryClient.invalidateQueries({
        queryKey: trpc.connections.list.getQueryKey(),
      });
      toast.success('Account order updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to reorder accounts: ${error.message}`);
    },
  });

  return {
    reorderConnections,
  };
};
