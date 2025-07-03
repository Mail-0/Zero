import { useTRPC } from '@/providers/query-provider';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';
import { useAtomValue } from 'jotai';
import { optimisticActionsAtom } from '@/store/optimistic-updates';
import { useMemo } from 'react';

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

export const useAdjustedStats = () => {
  const { data: session } = useSession();
  const trpc = useTRPC();
  const optimisticActions = useAtomValue(optimisticActionsAtom);

  const statsQuery = useQuery(
    trpc.mail.count.queryOptions(void 0, {
      enabled: !!session?.user.id,
      staleTime: 1000 * 60 * 60, 
    }),
  );

  const adjustedStats = useMemo(() => {
    if (!statsQuery.data) return statsQuery.data;

    const deltas: Record<string, number> = {};

    Object.values(optimisticActions).forEach((action) => {
      if (action.type !== 'MOVE') return;
      
      const source = action.source.toLowerCase();
      const destination = action.destination?.toLowerCase();
      
      if (source) {
        deltas[source] = (deltas[source] ?? 0) - action.threadIds.length;
      }
      if (destination && destination !== source) {
        deltas[destination] = (deltas[destination] ?? 0) + action.threadIds.length;
      }
    });

    return statsQuery.data.map((stat) => {
      const delta = deltas[stat.label?.toLowerCase() ?? ''] ?? 0;
      return {
        ...stat,
        count: Math.max(0, (stat.count ?? 0) + delta),
      };
    });
  }, [statsQuery.data, optimisticActions]);

  return {
    ...statsQuery,
    data: adjustedStats,
  };
};
