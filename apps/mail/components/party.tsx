'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';
import { usePartySocket } from 'partysocket/react';
import { useThreads } from '@/hooks/use-threads';
import { useLabels } from '@/hooks/use-labels';
import { useSession } from '@/lib/auth-client';
import { funnel } from 'remeda';

const DEBOUNCE_DELAY = 10_000; // 10 seconds is appropriate for real-time notifications

export const NotificationProvider = ({ headers }: { headers: Record<string, string> }) => {
  const trpc = useTRPC();
  const { data: session } = useSession();
  const { refetch: refetchLabels } = useLabels();
  const queryClient = useQueryClient();
  const [{ refetch: refetchThreads }] = useThreads();

  //   const handleRefetchLabels = useCallback(async () => {
  //     await refetchLabels();
  //   }, [refetchLabels]);

  //   const handleRefetchThreads = useCallback(async () => {
  //     await refetchThreads();
  //   }, [refetchThreads]);

  const labelsDebouncer = funnel(refetchLabels, { minQuietPeriodMs: DEBOUNCE_DELAY });
  const threadsDebouncer = funnel(refetchThreads, { minQuietPeriodMs: DEBOUNCE_DELAY });

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
        labelsDebouncer.call();
        await queryClient.invalidateQueries({
          queryKey: trpc.mail.get.queryKey({ id: threadId }),
        });
        threadsDebouncer.call();
        console.warn('refetched threads');
      } else if (type === 'start') {
        threadsDebouncer.call();
        console.warn('refetched threads');
      }
    },
  });

  return <></>;
};
