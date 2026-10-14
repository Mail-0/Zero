import { useTRPC } from '@/providers/query-provider';
import { useQuery } from '@tanstack/react-query';

export const useConnections = () => {
  const trpc = useTRPC();
  const connectionsQuery = useQuery(trpc.connections.list.queryOptions());
  return connectionsQuery;
};

/**
 * The server resolves every mail query against the user's default connection, so this must
 * always agree with it. It's cheap, so revalidate on mount/focus (another tab may have
 * switched accounts) and never restore it from the IndexedDB snapshot (see query-provider).
 */
export const useActiveConnection = () => {
  const trpc = useTRPC();
  const connectionsQuery = useQuery(
    trpc.connections.getDefault.queryOptions(void 0, {
      staleTime: 1000 * 30,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    }),
  );
  return connectionsQuery;
};
