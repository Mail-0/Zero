import { useTRPC } from '@/providers/query-provider';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';

export const useStats = () => {
  const { data: session } = useSession();
  const trpc = useTRPC();

  const statsQuery = useQuery(
    trpc.mail.count.queryOptions(void 0, {
      enabled: !!session?.user.id,
      staleTime: 1000 * 60 * 60, // 1 hour
    }),
  );

  return statsQuery;
};
