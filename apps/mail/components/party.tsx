'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';
import { useDebounce } from '@/hooks/use-debounce';
import { usePartySocket } from 'partysocket/react';
import { useThreads } from '@/hooks/use-threads';
import { useLabels } from '@/hooks/use-labels';
import { useSession } from '@/lib/auth-client';
import { useCallback } from 'react';

const DEBOUNCE_DELAY = 1000; // 1 second is more appropriate for real-time notifications

export const NotificationProvider = ({ headers }: { headers: Record<string, string> }) => {
  const trpc = useTRPC();
  const { data: session } = useSession();
  const { refetch: refetchLabels } = useLabels();
  const queryClient = useQueryClient();
  const [{ refetch: refetchThreads }] = useThreads();

  const handleRefetchLabels = useCallback(async () => {
    await refetchLabels();
  }, [refetchLabels]);

  const handleRefetchThreads = useCallback(async () => {
    await refetchThreads();
  }, [refetchThreads]);

  const debouncedRefetchLabels = useDebounce(handleRefetchLabels, DEBOUNCE_DELAY);
  const debouncedRefetchThreads = useDebounce(handleRefetchThreads, DEBOUNCE_DELAY);

  usePartySocket({
    party: 'durable-mailbox',
    room: session?.activeConnection?.id ? `${session.activeConnection.id}` : 'general',
    prefix: 'zero',
    debug: true,
    maxRetries: 1,
    query: {
      token: headers['cookie'],
    },
    host: process.env.NEXT_PUBLIC_BACKEND_URL!,
    onMessage: async (message: MessageEvent<string>) => {
      console.warn('party message', message);
      const [threadId, type] = message.data.split(':');
      if (type === 'end') {
        debouncedRefetchLabels();
        await queryClient.invalidateQueries({
          queryKey: trpc.mail.get.queryKey({ id: threadId }),
        });
        debouncedRefetchThreads();
        console.warn('refetched threads');
      } else if (type === 'start') {
        debouncedRefetchThreads();
        console.warn('refetched threads');
      }
    },
  });

  return <></>;
};
