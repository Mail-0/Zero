import { useActiveConnection } from '@/hooks/use-connections';
import { useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';
import { usePartySocket } from 'partysocket/react';
import { funnel } from 'remeda';

const DEBOUNCE_DELAY = 10_000; // 10 seconds is appropriate for real-time notifications

export enum IncomingMessageType {
  UseChatRequest = 'cf_agent_use_chat_request',
  ChatClear = 'cf_agent_chat_clear',
  ChatMessages = 'cf_agent_chat_messages',
  ChatRequestCancel = 'cf_agent_chat_request_cancel',
  Mail_List = 'zero_mail_list_threads',
  Mail_Get = 'zero_mail_get_thread',
}

export enum OutgoingMessageType {
  ChatMessages = 'cf_agent_chat_messages',
  UseChatResponse = 'cf_agent_use_chat_response',
  ChatClear = 'cf_agent_chat_clear',
  Mail_List = 'zero_mail_list_threads',
  Mail_Get = 'zero_mail_get_thread',
}

export const NotificationProvider = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: activeConnection } = useActiveConnection();

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
    room: activeConnection?.id ? String(activeConnection.id) : 'general',
    prefix: 'agents',
    maxRetries: 1,
    host: import.meta.env.VITE_PUBLIC_BACKEND_URL!,
    onMessage: async (message: MessageEvent<string>) => {
      try {
        const { threadIds, type } = JSON.parse(message.data);
        if (type === IncomingMessageType.Mail_Get) {
          const { threadId, result } = JSON.parse(message.data);
          //   queryClient.setQueryData(trpc.mail.get.queryKey({ id: threadId }), result);
        }
      } catch (error) {
        console.error('error parsing party message', error);
      }
    },
  });

  return <></>;
};
