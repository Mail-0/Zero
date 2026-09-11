import { useCombinedThreads } from '@/hooks/use-combined-threads';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cleanNameDisplay, formatDate } from '@/lib/utils';
import { useTRPC } from '@/providers/query-provider';
import { Skeleton } from '@/components/ui/skeleton';
import { authProxy } from '@/lib/auth-proxy';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useQueryState } from 'nuqs';
import { useNavigate } from 'react-router';
import { m } from '@/paraglide/messages';
import type { Route } from './+types/page';

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const session = await authProxy.api.getSession({ headers: request.headers });
  if (!session) return Response.redirect(`${import.meta.env.VITE_PUBLIC_APP_URL}/login`);
  return null;
}

const SKELETON_ROW_KEYS = Array.from({ length: 8 }, (_, i) => `combined-skeleton-${i}`);

export default function CombinedInboxPage() {
  const { data, isLoading } = useCombinedThreads();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [, setThreadId] = useQueryState('threadId');
  const { mutateAsync: setDefaultConnection } = useMutation(
    trpc.connections.setDefault.mutationOptions(),
  );

  const openThread = async (connectionId: string, threadId: string) => {
    setThreadId(null);
    try {
      await setDefaultConnection({ connectionId });
      queryClient.clear();
      navigate(`/mail/inbox?threadId=${threadId}`);
    } catch (error) {
      console.error('[CombinedInboxPage] Failed to switch to account:', error);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b px-6 py-4">
        <h1 className="text-lg font-semibold">{m['navigation.sidebar.combined']()}</h1>
        {data?.accounts?.length ? (
          <span className="text-muted-foreground text-sm">
            {data.accounts.length} {data.accounts.length === 1 ? 'account' : 'accounts'}
          </span>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {SKELETON_ROW_KEYS.map((key) => (
              <div key={key} className="flex items-center gap-3 rounded-lg border p-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
                <div className="flex flex-1 flex-col gap-1">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : !data?.threads?.length ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
            <p className="text-muted-foreground text-sm">No messages across your inboxes.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-3">
            {data.threads.map((thread) => {
              const account = data.accounts.find((a) => a.id === thread.connectionId);
              return (
                <button
                  key={`${thread.connectionId}:${thread.id}`}
                  onClick={() => openThread(thread.connectionId, thread.id)}
                  className="hover:bg-muted/50 flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
                >
                  <Avatar className="h-8 w-8 rounded-full">
                    <AvatarImage src={account?.picture ?? undefined} alt="" />
                    <AvatarFallback className="rounded-full text-xs">
                      {(account?.email ?? thread.accountEmail).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {cleanNameDisplay(thread.sender?.name) || thread.sender?.email || '—'}
                      </span>
                      {thread.receivedOn ? (
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {formatDate(thread.receivedOn.split('.')[0] || '')}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground truncate text-sm">
                        {thread.subject || '(no subject)'}
                      </span>
                      <span className="text-muted-foreground shrink-0 truncate text-xs">
                        {account?.email ?? thread.accountEmail}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
