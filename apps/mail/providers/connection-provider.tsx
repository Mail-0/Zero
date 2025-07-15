import { connectionErrorAtom, connectionIdAtom, connectionLoadingAtom } from '@/store/connection';
import { useEffect, type PropsWithChildren } from 'react';
import { trpcClient } from './query-provider';
import { useAtom } from 'jotai';
import { toast } from 'sonner';

export function ConnectionProvider({ children }: PropsWithChildren) {
  const [connectionId, setConnectionId] = useAtom(connectionIdAtom);
  const [, setLoading] = useAtom(connectionLoadingAtom);
  const [, setError] = useAtom(connectionErrorAtom);

  useEffect(() => {
    let isCancelled = false;
    let timeoutId: NodeJS.Timeout;
    let retries = 0;
    const maxRetries = 5;

    const fetchConnection = async () => {
      if (connectionId) {
        setLoading(false);
        return;
      }
      setLoading(true);

      try {
        const connection = await trpcClient.connections.getDefault.query();
        if (!isCancelled) {
          if (connection?.id) {
            setConnectionId(connection.id);
          } else {
            throw new Error('No default connection found');
          }
          setError(null);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to fetch default connection:', error);
          setError(error as Error);

          if (retries < maxRetries) {
            const delay = Math.pow(2, retries) * 1000;
            retries++;
            toast.error(
              `Failed to connect. Retrying in ${delay / 1000}s... (${retries}/${maxRetries})`,
            );
            timeoutId = setTimeout(fetchConnection, delay);
          } else {
            toast.error(
              'Could not connect to the server after multiple retries. Please try again later.',
            );
          }
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
      }
    };

    fetchConnection();

    return () => {
      isCancelled = true;
    };
  }, [setConnectionId, setLoading, setError, connectionId]);

  return <>{children}</>;
}
