import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ZenComposeButton, ZenFolderSelect, ZenNavigation } from './zen-navigation';
import { ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExclamationCircle, GroupPeople, PencilCompose } from '../icons/icons';
import { useOptimisticActions } from '@/hooks/use-optimistic-actions';
import { useOptimisticThreadState } from './optimistic-thread-state';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLoading } from '@/components/context/loading-context';
import { ThreadDisplay } from '@/components/mail/thread-display';
import { PricingDialog } from '@/components/ui/pricing-dialog';
import { useActiveConnection } from '@/hooks/use-connections';
import { useUnifiedInbox } from '@/hooks/use-unified-inbox';
import AIToggleButton from '@/components/ai-toggle-button';
import { EmptyStateIcon } from '../icons/empty-state-svg';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useHotkeysContext } from 'react-hotkeys-hook';
import { useAiEnabled } from '@/hooks/use-ai-enabled';
import { useTRPC } from '@/providers/query-provider';
import AISidebar from '@/components/ui/ai-sidebar';
import { useSettings } from '@/hooks/use-settings';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate, Link } from 'react-router';
import { cn, formatListDate } from '@/lib/utils';
import { VList, type VListHandle } from 'virtua';
import { useSession } from '@/lib/auth-client';
import { BimiAvatar } from '../ui/bimi-avatar';
import { Skeleton } from '../ui/skeleton';
import { m } from '@/paraglide/messages';
import { useQueryState } from 'nuqs';
import { toast } from 'sonner';

/** Distinguishes accounts at a glance; assigned by each account's position in the list. */
const ACCOUNT_COLORS = [
  'bg-[#006FFE]',
  'bg-[#39ae4a]',
  'bg-[#F59E0D]',
  'bg-[#8B5CF6]',
  'bg-[#F43F5E]',
  'bg-[#14B8A6]',
  'bg-[#EC4899]',
  'bg-[#64748B]',
];

const LOAD_MORE_THRESHOLD = 10;

type UnifiedThread = ReturnType<typeof useUnifiedInbox>['threads'][number];
type UnifiedConnection = ReturnType<typeof useUnifiedInbox>['connections'][number];
type AccountInfo = UnifiedConnection & { color: string };

export function UnifiedInboxLayout() {
  const isMobile = useIsMobile();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();
  const { enableScope, disableScope } = useHotkeysContext();
  const [threadId] = useQueryState('threadId');
  const { data: activeConnection } = useActiveConnection();
  const aiEnabled = useAiEnabled();

  useEffect(() => {
    if (!session?.user && !isPending) navigate('/login');
  }, [session?.user, isPending, navigate]);

  // Same hotkey scoping as MailLayout so Escape/arrows target the open thread.
  useEffect(() => {
    if (threadId) {
      enableScope('thread-display');
      disableScope('mail-list');
    } else {
      enableScope('mail-list');
      disableScope('thread-display');
    }
    return () => {
      disableScope('thread-display');
      disableScope('mail-list');
    };
  }, [threadId, enableScope, disableScope]);

  return (
    <TooltipProvider delayDuration={0}>
      <PricingDialog />
      <div className="rounded-inherit relative z-5 flex p-0 md:mr-0.5">
        <ResizablePanelGroup
          direction="horizontal"
          className={cn('rounded-inherit relative overflow-hidden', threadId && 'bg-sidebar')}
        >
          <ResizablePanel
            defaultSize={100}
            minSize={30}
            className={cn(
              'bg-panelLight dark:bg-panelDark h-dvh min-w-0 md:rounded-2xl',
              threadId && 'pointer-events-none absolute inset-0 -z-10 opacity-0',
            )}
            inert={!!threadId}
          >
            <UnifiedInboxList isDesktop={isDesktop} />
          </ResizablePanel>

          {isDesktop && threadId && (
            <ResizablePanel className="bg-sidebar relative z-10 h-dvh min-w-0" defaultSize={100}>
              <div className="relative h-full flex-1">
                <ThreadDisplay />
              </div>
            </ResizablePanel>
          )}

          {isMobile && threadId && (
            <div className="bg-panelLight dark:bg-panelDark fixed inset-0 z-50">
              <div className="flex h-full flex-col">
                <div className="h-full overflow-y-auto outline-none">
                  <ThreadDisplay />
                </div>
              </div>
            </div>
          )}

          {/* Same as MailLayout: both self-gate on the "disable AI" setting. */}
          {activeConnection?.id ? <AISidebar /> : null}
          {activeConnection?.id && aiEnabled ? <AIToggleButton /> : null}
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  );
}

function UnifiedInboxList({ isDesktop }: { isDesktop: boolean }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { setLoading } = useLoading();
  const { data: activeConnection } = useActiveConnection();
  const { data: settingsData } = useSettings();
  const { optimisticMarkAsRead } = useOptimisticActions();
  const [threadId, setThreadId] = useQueryState('threadId');
  const [, setDraftId] = useQueryState('draftId');
  const [, setMode] = useQueryState('mode');
  const [, setActiveReplyId] = useQueryState('activeReplyId');
  const { mutateAsync: setDefaultConnection } = useMutation(
    trpc.connections.setDefault.mutationOptions(),
  );
  const { query, threads, connections, failedConnectionIds, loadMore } = useUnifiedInbox();
  const vListRef = useRef<VListHandle>(null);
  const isSwitchingRef = useRef(false);

  const accounts = useMemo(() => {
    const map = new Map<string, AccountInfo>();
    connections.forEach((connection, i) => {
      map.set(connection.id, {
        ...connection,
        color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
      });
    });
    return map;
  }, [connections]);

  const failedAccounts = useMemo(
    () => failedConnectionIds.map((id) => accounts.get(id)).filter((a) => !!a),
    [failedConnectionIds, accounts],
  );

  /**
   * Every thread action (read, archive, reply...) runs against the default connection, so a
   * thread from another account is opened by making its account the default first. Unlike the
   * account switcher, the unified list itself is kept: it already covers every account.
   */
  const openThread = useCallback(
    async (thread: UnifiedThread) => {
      if (isSwitchingRef.current) return;
      const autoRead = settingsData?.settings?.autoRead ?? true;
      const needsSwitch = !!activeConnection?.id && thread.connectionId !== activeConnection.id;

      if (needsSwitch) {
        isSwitchingRef.current = true;
        try {
          setLoading(true, m['common.navUser.switchingAccounts']());
          setThreadId(null);
          await setDefaultConnection({ connectionId: thread.connectionId });
          const unifiedKey = JSON.stringify(trpc.mail.listUnifiedInbox.pathKey()[0]);
          const notUnified = (q: { queryKey: readonly unknown[] }) =>
            JSON.stringify(q.queryKey[0]) !== unifiedKey;
          await queryClient.cancelQueries({ predicate: notUnified });
          await queryClient.resetQueries({ predicate: notUnified });
        } catch (error) {
          console.error('[UnifiedInbox] Failed to switch account', error);
          toast.error(m['common.navUser.failedToSwitchAccount']());
          return;
        } finally {
          isSwitchingRef.current = false;
          setLoading(false);
        }
      }

      if (thread.summary?.hasUnread && autoRead) optimisticMarkAsRead([thread.id], true);
      setMode(null);
      setActiveReplyId(null);
      setDraftId(null);
      setThreadId(thread.id);
    },
    [
      activeConnection?.id,
      settingsData,
      setLoading,
      setThreadId,
      setDefaultConnection,
      trpc,
      queryClient,
      optimisticMarkAsRead,
      setMode,
      setActiveReplyId,
      setDraftId,
    ],
  );

  const { hasNextPage, isLoading, isFetching } = query;
  const maybeLoadMore = useCallback(() => {
    const vList = vListRef.current;
    if (!vList || !hasNextPage || isLoading || isFetching) return;
    if (threads.length - 1 - vList.findEndIndex() < LOAD_MORE_THRESHOLD) loadMore();
  }, [threads.length, hasNextPage, isLoading, isFetching, loadMore]);

  useEffect(() => {
    maybeLoadMore();
    const frame = requestAnimationFrame(maybeLoadMore);
    return () => cancelAnimationFrame(frame);
  }, [maybeLoadMore]);

  const showAccountBadge = accounts.size > 1;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="sticky top-0 z-15 flex items-center justify-between gap-1.5 p-2 pb-0">
        <div className="w-full">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 md:grid md:grid-cols-[1fr_auto_1fr]">
            <ZenNavigation />
            <div className="bg-muted flex shrink-0 items-center gap-0.5 rounded-lg p-0.5 md:justify-self-center">
              <ZenComposeButton />
              <div className="bg-border mx-1 h-4 w-px" />
              <ZenFolderSelect />
            </div>
            <AccountLegend accounts={[...accounts.values()]} failedIds={failedConnectionIds} />
          </div>
          {failedAccounts.length > 0 && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
              <ExclamationCircle className="h-3.5 w-3.5 shrink-0 fill-amber-500" />
              <span className="min-w-0 flex-1 truncate">
                {m['common.unifiedInbox.accountsUnavailable']({
                  accounts: failedAccounts.map((a) => a.email).join(', '),
                })}
              </span>
              <Link to="/settings/connections" className="shrink-0 underline">
                {m['common.unifiedInbox.manageConnections']()}
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-1 flex min-h-0 flex-1 flex-col overflow-hidden pt-0">
        {isLoading ? (
          <div className="flex flex-col">
            {Array.from({ length: 8 }, (_, i) => (
              <RowSkeleton key={i} />
            ))}
          </div>
        ) : query.isError ? (
          <div className="text-muted-foreground flex h-32 flex-col items-center justify-center gap-2 text-sm">
            <p>{m['common.unifiedInbox.loadFailed']()}</p>
            <button className="underline" onClick={() => void query.refetch()}>
              {m['common.unifiedInbox.retry']()}
            </button>
          </div>
        ) : threads.length === 0 ? (
          <div className="flex w-full flex-1 flex-col items-center justify-center gap-2 text-center">
            <EmptyStateIcon width={200} height={200} />
            <p className="mt-5 text-lg">{m['common.unifiedInbox.empty']()}</p>
          </div>
        ) : (
          <VList
            ref={vListRef}
            count={threads.length}
            overscan={3}
            itemSize={isDesktop ? 48 : 72}
            className="scrollbar-none flex-1 overflow-x-hidden"
            onScroll={maybeLoadMore}
          >
            {(index) => {
              const thread = threads[index];
              return (
                <UnifiedThreadRow
                  key={`${thread.connectionId}:${thread.id}`}
                  thread={thread}
                  account={showAccountBadge ? accounts.get(thread.connectionId) : undefined}
                  isSelected={
                    thread.id === threadId && thread.connectionId === activeConnection?.id
                  }
                  isDesktop={isDesktop}
                  onOpen={openThread}
                />
              );
            }}
          </VList>
        )}
      </div>
    </div>
  );
}

function AccountLegend({ accounts, failedIds }: { accounts: AccountInfo[]; failedIds: string[] }) {
  if (accounts.length <= 1) return <div />;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 md:justify-self-end">
      {accounts.map((account) => (
        <Tooltip key={account.id}>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'bg-muted flex h-6 max-w-[160px] items-center gap-1.5 rounded-md px-2 text-xs',
                failedIds.includes(account.id) && 'opacity-50',
              )}
            >
              <span className={cn('size-2 shrink-0 rounded-full', account.color)} />
              <span className="truncate">{account.email}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {account.name ? `${account.name} <${account.email}>` : account.email}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

const RowSkeleton = () => (
  <div className="my-1 select-none" aria-hidden>
    <div className="mx-1 flex min-h-10 items-center gap-4 rounded-lg px-4 py-2">
      <Skeleton className="size-2 shrink-0 rounded" />
      <Skeleton className="h-4 w-28 shrink-0 lg:w-40" />
      <Skeleton className="h-5 w-5 shrink-0 rounded" />
      <Skeleton className="h-4 max-w-[400px] flex-1" />
    </div>
  </div>
);

type UnifiedThreadRowProps = {
  thread: UnifiedThread;
  account: AccountInfo | undefined;
  isSelected: boolean;
  isDesktop: boolean;
  onOpen: (thread: UnifiedThread) => Promise<void>;
};

const UnifiedThreadRow = memo(function UnifiedThreadRow({
  thread,
  account,
  isSelected,
  isDesktop,
  onOpen,
}: UnifiedThreadRowProps) {
  const summary = thread.summary;
  const latest = summary?.latest;
  // Optimistic read state is keyed by thread id; only meaningful for the active account's
  // threads, but ids are provider-unique so cross-account collisions aren't a concern.
  const optimistic = useOptimisticThreadState(thread.id);
  const [pending, setPending] = useState(false);

  if (!summary || !latest) {
    return <RowSkeleton />;
  }

  const unread =
    optimistic.optimisticRead !== null ? !optimistic.optimisticRead : summary.hasUnread;
  const senderName = latest.sender?.name?.trim().replace(/^['"]|['"]$/g, '') || '';
  const senderText = senderName || latest.sender?.email || '';
  const date = latest.receivedOn ? formatListDate(latest.receivedOn.split('.')[0] || '') : null;

  const handleClick = async () => {
    setPending(true);
    try {
      await onOpen(thread);
    } finally {
      setPending(false);
    }
  };

  const accountBadge = account ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="bg-muted flex h-5 max-w-[140px] shrink-0 items-center gap-1 rounded px-1.5 text-[11px]"
          aria-label={account.email}
        >
          <span className={cn('size-1.5 shrink-0 rounded-full', account.color)} />
          <span className="text-muted-foreground truncate">{account.email}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{account.email}</TooltipContent>
    </Tooltip>
  ) : null;

  const avatar = summary.isGroupThread ? (
    <GroupPeople className={cn('shrink-0', isDesktop ? 'h-5 w-5' : 'h-8 w-8')} />
  ) : (
    <BimiAvatar
      email={latest.sender?.email}
      name={senderText}
      className={cn('shrink-0', isDesktop ? 'h-5 w-5 rounded' : 'h-8 w-8 rounded-full')}
    />
  );

  return (
    <div className="my-1 select-none">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-current={isSelected ? 'true' : undefined}
        className={cn(
          'hover:bg-offsetLight dark:hover:bg-primary/5 mx-1 flex w-[calc(100%-0.5rem)] cursor-pointer items-center rounded-lg py-2 text-left',
          isSelected && 'bg-offsetLight dark:bg-primary/5',
          pending && 'opacity-60',
        )}
      >
        {isDesktop ? (
          <div
            className={cn('flex min-h-8 w-full items-center gap-4 px-4', !unread && 'opacity-70')}
          >
            <span
              className={cn(
                'size-2 shrink-0 rounded',
                unread ? 'bg-[#006FFE]' : 'bg-black/30 dark:bg-[#2C2C2C]',
              )}
            />
            <span
              className={cn(
                'w-28 shrink-0 truncate text-sm lg:w-40',
                unread ? 'font-semibold' : 'font-medium',
              )}
            >
              {senderText}
            </span>
            {avatar}
            <div className="bg-border h-4 w-px shrink-0" />
            <div className="flex min-w-0 flex-1 items-center gap-2 lg:max-w-[400px]">
              <span className={cn('truncate text-sm', unread && 'font-medium')}>
                {latest.subject}
              </span>
              {summary.totalReplies > 1 && (
                <span className="text-muted-foreground shrink-0 text-xs">
                  {summary.totalReplies}
                </span>
              )}
              {summary.hasDraft && (
                <PencilCompose aria-label="Draft" className="h-3 w-3 shrink-0 fill-blue-500" />
              )}
            </div>
            <div className="bg-border hidden h-4 w-px shrink-0 lg:block" />
            <span className="text-muted-foreground hidden min-w-0 flex-1 truncate text-sm lg:block">
              {latest.title || ''}
            </span>
            {accountBadge}
            {date !== null && (
              <time className="text-muted-foreground shrink-0 text-xs">{date}</time>
            )}
          </div>
        ) : (
          <div className={cn('flex w-full items-center gap-3 px-4', !unread && 'opacity-60')}>
            {avatar}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'flex min-w-0 items-center gap-1 text-sm',
                    unread ? 'font-bold' : 'font-medium',
                  )}
                >
                  <span className="truncate">{senderText}</span>
                  {unread && <span className="size-2 shrink-0 rounded-full bg-[#006FFE]" />}
                </span>
                {date !== null && (
                  <time className="text-muted-foreground shrink-0 text-xs opacity-70">{date}</time>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground truncate text-xs">{latest.subject}</p>
                {accountBadge}
              </div>
            </div>
          </div>
        )}
      </button>
    </div>
  );
});
