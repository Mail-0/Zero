import { useActiveConnection } from '@/hooks/use-connections';
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
  //   const { refetch: refetchLabels } = useLabels();
  const queryClient = useQueryClient();
  //   const [{ refetch: refetchThreads }] = useThreads();
  const { data: activeConnection } = useActiveConnection();

  //   const handleRefetchLabels = useCallback(async () => {
  //     await refetchLabels();
  //   }, [refetchLabels]);

  //   const handleRefetchThreads = useCallback(async () => {
  //     await refetchThreads();
  //   }, [refetchThreads]);

  const labelsDebouncer = funnel(
    () => queryClient.invalidateQueries({ queryKey: trpc.labels.list.queryKey() }),
    { minQuietPeriodMs: DEBOUNCE_DELAY },
  );
  const threadsDebouncer = funnel(
    () => queryClient.invalidateQueries({ queryKey: trpc.mail.listThreads.queryKey() }),
    { minQuietPeriodMs: DEBOUNCE_DELAY },
  );

  usePartySocket({
    party: 'zero-agent',
    room: activeConnection?.id ? `${activeConnection.id}` : 'general',
    prefix: 'agents',
    maxRetries: 1,
    query: {
      token: headers['cookie'],
    },
    host: import.meta.env.VITE_PUBLIC_BACKEND_URL!,
    onMessage: async (message: MessageEvent<string>) => {
      try {
        console.warn('party message', message);
        const { threadIds, type } = JSON.parse(message.data);
        if (type === 'refresh') {
          labelsDebouncer.call();
          await Promise.all(
            threadIds.map(async (threadId: string) => {
              await queryClient.invalidateQueries({
                queryKey: trpc.mail.get.queryKey({ id: threadId }),
              });
            }),
          );
          console.warn('refetched labels & threads', threadIds);
        } else if (type === 'list') {
          threadsDebouncer.call();
          labelsDebouncer.call();
          await Promise.all(
            threadIds.map(async (threadId: string) => {
              await queryClient.invalidateQueries({
                queryKey: trpc.mail.get.queryKey({ id: threadId }),
              });
            }),
          );
          console.warn('refetched threads, added', threadIds);
        }
      } catch (error) {
        console.error('error parsing party message', error);
      }
    },
  });

  return <></>;
};
