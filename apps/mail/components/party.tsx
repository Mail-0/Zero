import { pruneSettledReadActionsAtom } from '@/store/optimistic-updates';
import { useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { useActiveConnection } from '@/hooks/use-connections';
import { createCoalescedRunner, refreshMailboxQueries } from '@/lib/mail-cache-sync';
import { useSearchValue } from '@/hooks/use-search-value';
import useSearchLabels from '@/hooks/use-labels-search';
import { useTRPC } from '@/providers/query-provider';
import { usePartySocket } from 'partysocket/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';

// 10 seconds is appropriate for real-time notifications

/** Max one mailbox-wide refetch (list, counts, drafts, status) per window during sync bursts. */
const MAILBOX_REFRESH_WINDOW_MS = 2000;

export enum IncomingMessageType {
  UseChatRequest = 'cf_agent_use_chat_request',
  ChatClear = 'cf_agent_chat_clear',
  ChatMessages = 'cf_agent_chat_messages',
  ChatRequestCancel = 'cf_agent_chat_request_cancel',
  Mail_List = 'zero_mail_list_threads',
  Mail_Get = 'zero_mail_get_thread',
  User_Topics = 'zero_user_topics',
  Mail_SyncStatus = 'zero_mail_sync_status',
  Mail_Count = 'zero_mail_count',
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
  const [searchValue] = useSearchValue();
  const { labels } = useSearchLabels();
  const isRestoring = useIsRestoring();
  const pruneSettledReadActions = useSetAtom(pruneSettledReadActionsAtom);
  const catchUp = useCallback(() => {
    if (!activeConnection?.id || isRestoring) return;
    pruneSettledReadActions();
    void refreshMailboxQueries(queryClient, {
      threads: trpc.mail.get.queryKey(),
      lists: trpc.mail.listThreads.infiniteQueryKey(),
      counts: trpc.mail.count.queryKey(),
      draftDetails: trpc.drafts.get.queryKey(),
      draftLists: trpc.drafts.list.queryKey(),
      status: trpc.mail.syncStatus.queryKey(),
    });
  }, [activeConnection?.id, isRestoring, pruneSettledReadActions, queryClient, trpc]);

  useEffect(() => {
    catchUp();
    const onVisible = () => {
      if (document.visibilityState === 'visible') catchUp();
    };
    window.addEventListener('focus', catchUp);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', catchUp);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [catchUp]);

  // Mailbox-wide refresh after per-thread pushes, coalesced (see createCoalescedRunner).
  const refreshMailboxRef = useRef(() => {});
  refreshMailboxRef.current = () => {
    pruneSettledReadActions();
    void refreshMailboxQueries(queryClient, {
      lists: trpc.mail.listThreads.infiniteQueryKey(),
      counts: trpc.mail.count.queryKey(),
      draftDetails: trpc.drafts.get.queryKey(),
      draftLists: trpc.drafts.list.queryKey(),
      status: trpc.mail.syncStatus.queryKey(),
    });
  };
  const [mailboxRefresh] = useState(() =>
    createCoalescedRunner(() => refreshMailboxRef.current(), MAILBOX_REFRESH_WINDOW_MS),
  );
  useEffect(() => () => mailboxRefresh.cancel(), [mailboxRefresh]);

  usePartySocket({
    party: 'zero-agent',
    room: activeConnection?.id ? String(activeConnection.id) : 'general',
    prefix: 'agents',
    maxRetries: 3,
    host: import.meta.env.VITE_PUBLIC_BACKEND_URL!,
    onOpen: catchUp,
    onMessage: async (message: MessageEvent<string>) => {
      try {
        const { type } = JSON.parse(message.data);
        if (type === IncomingMessageType.Mail_Get) {
          const { threadId } = JSON.parse(message.data);
          // The changed thread refreshes immediately; list/counts/drafts are coalesced.
          void queryClient.invalidateQueries({ queryKey: trpc.mail.get.queryKey({ id: threadId }) });
          mailboxRefresh.trigger();
        } else if (type === IncomingMessageType.Mail_Count) {
          await queryClient.invalidateQueries({ queryKey: trpc.mail.count.queryKey() });
        } else if (type === IncomingMessageType.Mail_SyncStatus) {
          await queryClient.invalidateQueries({ queryKey: trpc.mail.syncStatus.queryKey() });
        } else if (type === IncomingMessageType.Mail_List) {
          const { folder } = JSON.parse(message.data);
          queryClient.invalidateQueries({
            queryKey: trpc.mail.listThreads.infiniteQueryKey({
              folder,
              labelIds: labels,
              q: searchValue.value,
            }),
          });
        } else if (type === IncomingMessageType.User_Topics) {
          queryClient.invalidateQueries({
            queryKey: trpc.labels.list.queryKey(),
          });
        }
      } catch (error) {
        console.error('error parsing party message', error);
      }
    },
  });

  return <></>;
};
