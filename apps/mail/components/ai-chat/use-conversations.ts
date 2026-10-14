import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type ConversationSummary = { id: string; title: string; updatedAt: number };
type ConversationList = { currentId: string; conversations: ConversationSummary[] };

const agentUrl = (connectionId: string) =>
  `${import.meta.env.VITE_PUBLIC_BACKEND_URL}/agents/zero-agent/${connectionId}`;

async function call<T>(connectionId: string, path: string, method = 'GET'): Promise<T> {
  const res = await fetch(`${agentUrl(connectionId)}${path}`, { method, credentials: 'include' });
  if (!res.ok) throw new Error(`Chat history request failed (${res.status})`);
  return (await res.json()) as T;
}

/** The open chat's saved messages, for `useAgentChat`'s `getInitialMessages`. */
export async function fetchCurrentChatMessages(connectionId: string | undefined) {
  if (!connectionId) return [];
  try {
    return await call<unknown[]>(connectionId, '/get-messages');
  } catch {
    return [];
  }
}

export const conversationsQueryKey = (connectionId?: string) => [
  'ai-chat-conversations',
  connectionId,
];

/**
 * Past AI chat conversations for the active mailbox. Opening or starting a chat
 * happens on the agent, which broadcasts the new messages to every open tab.
 */
export function useChatConversations(connectionId: string | undefined, enabled: boolean) {
  const queryClient = useQueryClient();
  const queryKey = conversationsQueryKey(connectionId);
  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const list = useQuery({
    queryKey,
    queryFn: () => call<ConversationList>(connectionId!, '/conversations'),
    enabled: enabled && !!connectionId,
  });

  const startNew = useMutation({
    mutationFn: () => call(connectionId!, '/conversations/new', 'POST'),
    onSettled: invalidate,
  });
  const open = useMutation({
    mutationFn: (id: string) => call(connectionId!, `/conversations/${id}/open`, 'POST'),
    onSettled: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => call(connectionId!, `/conversations/${id}`, 'DELETE'),
    onSettled: invalidate,
  });

  return { list, startNew, open, remove };
}
