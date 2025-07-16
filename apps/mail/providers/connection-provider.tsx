import { useQuery } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { trpcClient } from './query-provider';
import { toast } from 'sonner';

// Define the connection query key
export const CONNECTION_KEY = ['connection', 'default'] as const;

export function ConnectionProvider({ children }: PropsWithChildren) {
  return <>{children}</>;
}

// Use this hook to initialize the connection query
export function useConnectionQuery() {
  return useQuery({
    queryKey: CONNECTION_KEY,
    queryFn: async () => {
      const connection = await trpcClient.connections.getDefault.query();
      if (!connection?.id) {
        throw new Error('No default connection found');
      }
      return connection.id;
    },
    retry: (failureCount) => {
      // Calculate exponential backoff delay
      const delay = Math.pow(2, failureCount) * 1000;
      const maxRetries = 5;

      if (failureCount < maxRetries) {
        toast.error(
          `Failed to connect. Retrying in ${delay / 1000}s... (${failureCount + 1}/${maxRetries})`,
        );
        return true;
      }

      toast.error(
        'Could not connect to the server after multiple retries. Please try again later.',
      );
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 30000),
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });
}
