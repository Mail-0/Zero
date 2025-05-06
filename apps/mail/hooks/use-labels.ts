import { useTRPC } from '@/providers/query-provider';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

export function useLabels() {
  const trpc = useTRPC();
  const labelQuery = useQuery(
    trpc.labels.list.queryOptions(void 0, {
      staleTime: 1000 * 60 * 60, // 1 hour
    }),
  );
  return labelQuery;
}

export function useThreadLabels(ids: string[]) {
  const { data: labels = [] } = useLabels();

  const threadLabels = useMemo(() => {
    if (!labels) return [];
    return labels.filter((label) => (label.id ? ids.includes(label.id) : false));
  }, [labels, ids]);

  return { labels: threadLabels };
}
