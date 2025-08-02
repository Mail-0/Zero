import { useTRPC } from '@/providers/query-provider';
import { useQuery } from '@tanstack/react-query';

export const useTemplates = () => {
  const trpc = useTRPC();
  return useQuery(
    trpc.templates.list.queryOptions(void 0, {
      staleTime: 1000 * 60 * 5,
    }),
  );
}; 