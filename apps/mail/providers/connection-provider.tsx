import { useEffect, type PropsWithChildren } from 'react';
import { connectionIdAtom } from '@/store/connection';
// REMOVED: import { useTRPC } from './query-provider';
// ADDED: Import the raw client
import { trpcClient } from './query-provider';
import { useSetAtom } from 'jotai';

export function ConnectionProvider({ children }: PropsWithChildren) {
  const setConnectionId = useSetAtom(connectionIdAtom);

  // REMOVED: const trpc = useTRPC();
  /*
  // REMOVED: Hook-based fetching which caused the circular dependency
  const { data: defaultConnection } = trpc.connections.getDefault.useQuery(
    undefined,
    {
      staleTime: Infinity,
      gcTime: Infinity,
    },
  );
  */

  // ADDED: Client-side fetch using the raw tRPC client inside useEffect
  useEffect(() => {
    let isCancelled = false;

    const fetchConnection = async () => {
      try {
        const connection = await trpcClient.connections.getDefault.query();
        if (!isCancelled && connection?.id) {
          setConnectionId(connection.id);
        }
      } catch (error) {
        console.error('Failed to fetch default connection:', error);
      }
    };

    fetchConnection();

    return () => {
      isCancelled = true;
    };
  }, [setConnectionId]);

  // This provider renders its children immediately, without waiting for the query.
  return <>{children}</>;
}
