'use client';

import {
  AlertTriangle,
  Bell,
  Briefcase,
  ChevronDown,
  Star,
  StickyNote,
  Tag,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  type ComponentProps,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ConditionalThreadProps, InitialThread, MailListProps, MailSelectMode } from '@/types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EmptyState, type FolderType } from '@/components/mail/empty-state';
import { ThreadContextMenu } from '@/components/context/thread-context';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { cn, FOLDERS, formatDate, getEmailLogo } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { useMailNavigation } from '@/hooks/use-mail-navigation';
import { preloadThread, useThreads } from '@/hooks/use-threads';
import { useHotKey, useKeyState } from '@/hooks/use-hot-key';
import { useSearchValue } from '@/hooks/use-search-value';
import { markAsRead, markAsUnread } from '@/actions/mail';
import { ScrollArea } from '@/components/ui/scroll-area';
import { highlightText } from '@/lib/email-utils.client';
import { useMail } from '@/components/mail/use-mail';
import type { VirtuosoHandle } from 'react-virtuoso';
import { useSession } from '@/lib/auth-client';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import { Button } from '../ui/button';
import { useQueryState } from 'nuqs';
import items from './demo.json';
import { toast } from 'sonner';
const HOVER_DELAY = 1000; // ms before prefetching

const ThreadWrapper = ({
  children,
  emailId,
  threadId,
  isFolderInbox,
  isFolderSpam,
  isFolderSent,
  refreshCallback,
}: {
  children: React.ReactNode;
  emailId: string;
  threadId: string;
  isFolderInbox: boolean;
  isFolderSpam: boolean;
  isFolderSent: boolean;
  refreshCallback: () => void;
}) => {
  return (
    <ThreadContextMenu
      emailId={emailId}
      threadId={threadId}
      isInbox={isFolderInbox}
      isSpam={isFolderSpam}
      isSent={isFolderSent}
      refreshCallback={refreshCallback}
    >
      {children}
    </ThreadContextMenu>
  );
};

const Thread = memo(
  ({
    message,
    selectMode,
    demo,
    onMouseDown,
    sessionData,
    isKeyboardFocused,
    isInQuickActionMode,
    selectedQuickActionIndex,
    resetNavigation,
    setHoveredMailId,
  }: ConditionalThreadProps & {
    folder?: string;
    isKeyboardFocused?: boolean;
    isInQuickActionMode?: boolean;
    selectedQuickActionIndex?: number;
    resetNavigation?: () => void;
    setHoveredMailId?: (index: string | null) => void;
  }) => {
    const [mail, setEmail] = useMail();
    const [searchValue] = useSearchValue();
    const t = useTranslations();
    const searchParams = useSearchParams();
    const { folder } = useParams<{ folder: string }>();
    const { mutate } = useThreads();
    const threadIdParam = searchParams.get('threadId');
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const isHovering = useRef<boolean>(false);
    const hasPrefetched = useRef<boolean>(false);
    const isMailSelected = useMemo(() => {
      const threadId = message.threadId ?? message.id;
      return threadId === threadIdParam || threadId === mail.selected;
    }, [message.id, message.threadId, threadIdParam, mail.selected]);

    const isMailBulkSelected = mail.bulkSelected.includes(message.id);

    const threadLabels = useMemo(() => {
      return [...(message.tags || [])];
    }, [message.tags]);

    const isFolderInbox = folder === FOLDERS.INBOX || !folder;
    const isFolderSpam = folder === FOLDERS.SPAM;
    const isFolderSent = folder === FOLDERS.SENT;

    const handleMouseEnter = () => {
      if (demo) return;
      isHovering.current = true;
      setHoveredMailId?.(message?.id || null);
      // Prefetch only in single select mode
      if (selectMode === 'single' && sessionData?.userId && !hasPrefetched.current) {
        // Clear any existing timeout
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }

        // Set new timeout for prefetch
        hoverTimeoutRef.current = setTimeout(() => {
          if (isHovering.current) {
            const messageId = message.threadId ?? message.id;
            // Only prefetch if still hovering and hasn't been prefetched
            console.log(
              `🕒 Hover threshold reached for email ${messageId}, initiating prefetch...`,
            );
            void preloadThread(sessionData.userId, messageId, sessionData.connectionId ?? '');
            hasPrefetched.current = true;
          }
        }, HOVER_DELAY);
      }
    };

    const handleMouseLeave = () => {
      isHovering.current = false;
      setHoveredMailId?.(null);

      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };

    // Reset prefetch flag when message changes
    useEffect(() => {
      hasPrefetched.current = false;
    }, [message.id]);

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
      };
    }, []);

    const content = (
      <div className="p-1 px-3" onMouseDown={onMouseDown ? onMouseDown(message) : undefined}>
        {demo ? (
          <div
            data-thread-id={message.threadId ?? message.id}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            key={message.threadId ?? message.id}
            className={cn(
              'hover:bg-offsetLight hover:bg-primary/5 group relative flex cursor-pointer flex-col items-start overflow-clip rounded-lg border border-transparent px-4 py-3 text-left text-sm transition-all hover:opacity-100',
              isMailSelected || (!message.unread && 'opacity-50'),
              (isMailSelected || isMailBulkSelected || isKeyboardFocused) &&
                'border-border bg-primary/5 opacity-100',
              isKeyboardFocused && 'ring-primary/50 ring-2',
            )}
          >
            <div
              className={cn(
                'bg-primary absolute inset-y-0 left-0 w-1 -translate-x-2 transition-transform ease-out',
                isMailBulkSelected && 'translate-x-0',
              )}
            />
            <div className="flex w-full items-center justify-between gap-4">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  className="bg-muted-foreground/50 dark:bg-muted/50 p-2"
                  src={getEmailLogo(message.sender.email)}
                />
                <AvatarFallback className="bg-muted-foreground/50 dark:bg-muted/50">
                  {message?.sender?.name[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex w-full justify-between">
                <div className="w-full">
                  <div className="flex w-full flex-row items-center justify-between">
                    <div className="flex flex-row items-center gap-1">
                      <p
                        className={cn(
                          message.unread && !isMailSelected ? 'font-bold' : 'font-medium',
                          'text-md flex items-baseline gap-1 group-hover:opacity-100',
                        )}
                      >
                        <span className={cn(threadIdParam ? 'max-w-[3ch] truncate' : '')}>
                          {highlightText(message.sender.name, searchValue.highlight)}
                        </span>{' '}
                        {message.unread && !isMailSelected ? (
                          <span className="size-2 rounded bg-[#006FFE]" />
                        ) : null}
                      </p>
                      <MailLabels labels={threadLabels} />
                      {message.totalReplies > 1 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="rounded-md border border-dotted px-[5px] py-[1px] text-xs opacity-70">
                              {message.totalReplies}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="px-1 py-0 text-xs">
                            {t('common.mail.replies', { count: message.totalReplies })}
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                    {message.receivedOn ? (
                      <p
                        className={cn(
                          'text-nowrap text-xs font-normal opacity-70 transition-opacity group-hover:opacity-100',
                          isMailSelected && 'opacity-100',
                        )}
                      >
                        {formatDate(message.receivedOn.split('.')[0] || '')}
                      </p>
                    ) : null}
                  </div>
                  <p
                    className={cn(
                      'mt-1 line-clamp-1 text-xs opacity-70 transition-opacity',
                      mail.selected
                        ? 'max-w-[3ch] overflow-hidden text-ellipsis whitespace-nowrap'
                        : 'line-clamp-2',
                      isMailSelected &&
                        'max-w-[3ch] overflow-hidden text-ellipsis whitespace-nowrap opacity-100',
                    )}
                  >
                    {highlightText(message.subject, searchValue.highlight)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            data-thread-id={message.threadId ?? message.id}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            key={message.threadId ?? message.id}
            className={cn(
              'hover:bg-offsetLight hover:bg-primary/5 group relative flex cursor-pointer flex-col items-start overflow-clip rounded-lg border border-transparent px-4 py-3 text-left text-sm transition-all hover:opacity-100',
              isMailSelected || (!message.unread && 'opacity-50'),
              (isMailSelected || isMailBulkSelected || isKeyboardFocused) &&
                'border-border bg-primary/5 opacity-100',
              isKeyboardFocused && 'ring-primary/50 ring-2',
            )}
          >
            <div
              className={cn(
                'bg-primary absolute inset-y-0 left-0 w-1 -translate-x-2 transition-transform ease-out',
                isMailBulkSelected && 'translate-x-0',
              )}
            />
            <div className="flex w-full items-center justify-between gap-4">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  className="bg-muted-foreground/50 dark:bg-muted/50 p-2"
                  src={getEmailLogo(message.sender.email)}
                />
                <AvatarFallback className="bg-muted-foreground/50 dark:bg-muted/50">
                  {message?.sender?.name[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex w-full justify-between">
                <div className="w-full">
                  <div className="flex w-full flex-row items-center justify-between">
                    <div className="flex flex-row items-center gap-1">
                      <p
                        className={cn(
                          message.unread && !isMailSelected ? 'font-bold' : 'font-medium',
                          'text-md flex items-baseline gap-1 group-hover:opacity-100',
                        )}
                      >
                        <span className={cn(threadIdParam ? 'max-w-[5ch] truncate' : '')}>
                          {highlightText(message.sender.name, searchValue.highlight)}
                        </span>{' '}
                        {message.unread && !isMailSelected ? (
                          <span className="size-2 rounded bg-[#006FFE]" />
                        ) : null}
                      </p>
                      <MailLabels labels={threadLabels} />
                      {message.totalReplies > 1 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="rounded-md border border-dotted px-[5px] py-[1px] text-xs opacity-70">
                              {message.totalReplies}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="px-1 py-0 text-xs">
                            {t('common.mail.replies', { count: message.totalReplies })}
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                    {isMailBulkSelected && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground absolute right-0 top-0 ml-1.5 h-7 w-fit px-2"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setEmail({
                                ...mail,
                                bulkSelected: mail.bulkSelected.filter((id) => id !== message.id),
                              });
                            }}
                          >
                            <X />
                          </Button>
                        </TooltipTrigger>

                        <TooltipContent>{t('common.mail.clearSelection')}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={cn('mt-1 line-clamp-1 text-xs opacity-70 transition-opacity')}>
                      {highlightText(message.subject, searchValue.highlight)}
                    </p>
                    {message.receivedOn ? (
                      <p
                        className={cn(
                          'text-nowrap text-xs font-normal opacity-70 transition-opacity group-hover:opacity-100',
                          isMailSelected && 'opacity-100',
                        )}
                      >
                        {formatDate(message.receivedOn.split('.')[0] || '')}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );

    return (
      <ThreadWrapper
        emailId={message.id}
        threadId={message.threadId ?? message.id}
        isFolderInbox={isFolderInbox}
        isFolderSpam={isFolderSpam}
        isFolderSent={isFolderSent}
        refreshCallback={() => mutate()}
      >
        {content}
      </ThreadWrapper>
    );
  },
);

Thread.displayName = 'Thread';

export function MailListDemo({
  items: filteredItems = items,
  onSelectMail,
}: {
  items?: typeof items;
  onSelectMail?: (message: any) => void;
}) {
  return (
    <ScrollArea className="h-full pb-2" type="scroll">
      <div className={cn('relative min-h-[calc(100vh-4rem)] w-full')}>
        <div className="absolute left-0 top-0 w-full p-[8px]">
          {filteredItems.map((item) => {
            return item ? (
              <Thread
                demo
                key={item.id}
                message={item}
                selectMode={'single'}
                onMouseDown={(message) => () => onSelectMail && onSelectMail(message)}
              />
            ) : null;
          })}
        </div>
      </div>
    </ScrollArea>
  );
}

export const MailList = memo(({ isCompact }: MailListProps) => {
  const { folder } = useParams<{ folder: string }>();
  const [mail, setMail] = useMail();
  const { data: session } = useSession();
  const t = useTranslations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [threadId, setThreadId] = useQueryState('threadId');

  const sessionData = useMemo(
    () => ({
      userId: session?.user?.id ?? '',
      connectionId: session?.connectionId ?? null,
    }),
    [session],
  );

  const [searchValue, setSearchValue] = useSearchValue();

  const {
    data: { threads: items, nextPageToken },
    isValidating,
    isLoading,
    loadMore,
    mutate,
  } = useThreads();

  // Add event listener for refresh
  useEffect(() => {
    const handleRefresh = () => {
      void mutate();
    };

    window.addEventListener('refreshMailList', handleRefresh);
    return () => window.removeEventListener('refreshMailList', handleRefresh);
  }, [mutate]);

  const parentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<VirtuosoHandle>(null);

  const handleNavigateToThread = useCallback(
    (threadId: string) => {
      const currentParams = new URLSearchParams(searchParams.toString());
      currentParams.set('threadId', threadId);
      router.push(`/mail/${folder}?${currentParams.toString()}`);
    },
    [folder, router, searchParams],
  );

  const {
    focusedIndex,
    isQuickActionMode,
    quickActionIndex,
    handleMouseEnter,
    keyboardActive,
    resetNavigation,
  } = useMailNavigation({
    items,
    containerRef: parentRef,
    onNavigate: handleNavigateToThread,
  });

  const handleScroll = useCallback(() => {
    if (isLoading || isValidating || !nextPageToken) return;
    console.log('Loading more items...');
    void loadMore();
  }, [isLoading, isValidating, loadMore, nextPageToken]);

  const isKeyPressed = useKeyState();

  const [hoveredMailId, setHoveredMailId] = useState<string | null>(null);

  const selectHoveredAndBelow = useCallback(() => {
    // If there are items selected and no mail hovered, deselect them all
    if (mail.bulkSelected.length > 0 && !hoveredMailId) {
      setMail((prev) => ({
        ...prev,
        bulkSelected: [],
      }));
      // toast.success(t('common.mail.deselectAll'));
    }
    // Otherwise select all items
    else if (items.length > 0) {
      const allIds = items.map((item) => item.id);
      const allIdsFromHoveredAndBelow = allIds.slice(allIds.indexOf(hoveredMailId ?? ''));

      setMail((prev) => ({
        ...prev,
        bulkSelected: hoveredMailId ? allIdsFromHoveredAndBelow : allIds,
      }));
    } else {
      toast.info(t('common.mail.noEmailsToSelect'));
    }
  }, [items, setMail, mail.bulkSelected, t, hoveredMailId]);

  useHotKey('Meta+Shift+u', () => {
    markAsUnread({ ids: mail.bulkSelected }).then((result) => {
      if (result.success) {
        toast.success(t('common.mail.markedAsUnread'));
        setMail((prev) => ({
          ...prev,
          bulkSelected: [],
        }));
      } else toast.error(t('common.mail.failedToMarkAsUnread'));
    });
  });

  useHotKey('Control+Shift+u', () => {
    markAsUnread({ ids: mail.bulkSelected }).then((response) => {
      if (response.success) {
        toast.success(t('common.mail.markedAsUnread'));
        setMail((prev) => ({
          ...prev,
          bulkSelected: [],
        }));
      } else toast.error(t('common.mail.failedToMarkAsUnread'));
    });
  });

  useHotKey('Meta+Shift+i', () => {
    markAsRead({ ids: mail.bulkSelected }).then((data) => {
      if (data.success) {
        toast.success(t('common.mail.markedAsRead'));
        setMail((prev) => ({
          ...prev,
          bulkSelected: [],
        }));
      } else toast.error(t('common.mail.failedToMarkAsRead'));
    });
  });

  useHotKey('Control+Shift+i', () => {
    markAsRead({ ids: mail.bulkSelected }).then((response) => {
      if (response.success) {
        toast.success(t('common.mail.markedAsRead'));
        setMail((prev) => ({
          ...prev,
          bulkSelected: [],
        }));
      } else toast.error(t('common.mail.failedToMarkAsRead'));
    });
  });

  useHotKey('Meta+a', (event) => {
    event?.preventDefault();
    selectHoveredAndBelow();
  });

  useHotKey('Control+a', (event) => {
    event?.preventDefault();
    selectHoveredAndBelow();
  });

  useHotKey('Meta+n', (event) => {
    event?.preventDefault();
    selectHoveredAndBelow();
  });

  useHotKey('Control+n', (event) => {
    event?.preventDefault();
    selectHoveredAndBelow();
  });

  const getSelectMode = useCallback((): MailSelectMode => {
    if (isKeyPressed('Control') || isKeyPressed('Meta')) {
      return 'mass';
    }
    if (isKeyPressed('Shift')) {
      return 'range';
    }
    if (isKeyPressed('Alt') && isKeyPressed('Shift')) {
      return 'selectAllBelow';
    }
    return 'single';
  }, [isKeyPressed]);

  const isNotSelectedWhenBulk = useCallback(
    (id: string) => {
      let isTrue = false;
      setMail((prev) => {
        const isBulkMode = prev.bulkSelected.length > 0;
        const alreadySelected = prev.bulkSelected.includes(id);

        if (isBulkMode && !alreadySelected) {
          isTrue = true;
          return {
            ...prev,
            bulkSelected: [...prev.bulkSelected, id],
          };
        }

        return prev;
      });
      return isTrue;
    },
    [setMail],
  );

  const handleMailMouseDown = useCallback(
    (message: InitialThread) => () => {
      if (isNotSelectedWhenBulk(message.id)) return;

      handleMouseEnter(message.id);

      const messageThreadId = message.threadId ?? message.id;

      // Update local state immediately for optimistic UI
      setMail((prev) => ({
        ...prev,
        selected: messageThreadId,
        replyComposerOpen: false,
        forwardComposerOpen: false,
      }));

      // Update URL param without navigation
      void setThreadId(messageThreadId);

      // Mark as read in background
      markAsRead({ ids: [messageThreadId] }).catch((error) => {
        console.error('Failed to mark email as read:', error);
        toast.error(t('common.mail.failedToMarkAsRead'));
      });
    },
    [handleMouseEnter, setThreadId, t, setMail],
  );

  const isEmpty = items.length === 0;
  const isFiltering = searchValue.value.trim().length > 0;

  // Add effect to handle search loading state
  useEffect(() => {
    if (isFiltering && !isLoading) {
      // Reset the search value when loading is complete
      setSearchValue((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }
  }, [isLoading, isFiltering, setSearchValue]);

  if (isEmpty && session) {
    if (isFiltering) {
      return (
        <div className="flex min-h-[90vh] flex-col items-center justify-center md:min-h-[90vh]">
          {isLoading || searchValue.isLoading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
              <p className="text-muted-foreground text-sm">
                {searchValue.isAISearching
                  ? t('common.searchBar.aiSearching')
                  : t('common.searchBar.searching')}
              </p>
            </div>
          ) : (
            <EmptyState folder="search" className="min-h-[90vh] md:min-h-[90vh]" />
          )}
        </div>
      );
    }
    return <EmptyState folder={folder as FolderType} className="min-h-[90vh] md:min-h-[90vh]" />;
  }

  return (
    <>
      <div
        ref={parentRef}
        className={cn('h-full w-full', getSelectMode() === 'range' && 'select-none')}
      >
        <ScrollArea className="hide-scrollbar h-full overflow-auto">
          {items.map((data, index) => {
            return (
              <Thread
                onMouseDown={handleMailMouseDown}
                selectMode={getSelectMode()}
                isCompact={isCompact}
                sessionData={sessionData}
                message={data}
                key={data.id}
                isKeyboardFocused={focusedIndex === index && keyboardActive}
                isInQuickActionMode={isQuickActionMode && focusedIndex === index}
                selectedQuickActionIndex={quickActionIndex}
                resetNavigation={resetNavigation}
                setHoveredMailId={setHoveredMailId}
              />
            );
          })}
          {items.length >= 9 && nextPageToken && (
            <Button
              variant={'ghost'}
              className="w-full rounded-none"
              onMouseDown={handleScroll}
              disabled={isLoading || isValidating}
            >
              {isLoading || isValidating ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
                  {t('common.actions.loading')}
                </div>
              ) : (
                <>
                  {t('common.mail.loadMore')} <ChevronDown />
                </>
              )}
            </Button>
          )}
        </ScrollArea>
      </div>
      <div className="w-full pt-4 text-center">
        {isLoading || isValidating ? (
          <div className="text-center">
            <div className="mx-auto h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
          </div>
        ) : (
          <div className="h-4" />
        )}
      </div>
    </>
  );
});

const MailLabels = memo(
  ({ labels }: { labels: string[] }) => {
    const t = useTranslations();

    if (!labels.length) return null;

    const visibleLabels = labels.filter(
      (label) => !['unread', 'inbox'].includes(label.toLowerCase()),
    );

    if (!visibleLabels.length) return null;

    return (
      <div className={cn('flex select-none items-center gap-1')}>
        {visibleLabels.map((label) => {
          const style = getDefaultBadgeStyle(label);
          if (label.toLowerCase() === 'notes') {
            return (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <Badge className="rounded-md bg-amber-100 p-1 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400">
                    {getLabelIcon(label)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="px-1 py-0 text-xs">
                  {t('common.notes.title')}
                </TooltipContent>
              </Tooltip>
            );
          }

          // Skip rendering if style is "secondary" (default case)
          if (style === 'secondary') return null;

          const normalizedLabel = getNormalizedLabelKey(label);

          let labelContent;
          switch (normalizedLabel) {
            case 'primary':
              labelContent = t('common.mailCategories.primary');
              break;
            case 'important':
              labelContent = t('common.mailCategories.important');
              break;
            case 'personal':
              labelContent = t('common.mailCategories.personal');
              break;
            case 'updates':
              labelContent = t('common.mailCategories.updates');
              break;
            case 'promotions':
              labelContent = t('common.mailCategories.promotions');
              break;
            case 'social':
              labelContent = t('common.mailCategories.social');
              break;
            case 'starred':
              labelContent = 'Starred';
              break;
            default:
              labelContent = capitalize(normalizedLabel);
          }

          return (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <Badge className="rounded-md p-1" variant={style}>
                  {getLabelIcon(label)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="px-1 py-0 text-xs" variant={style}>
                {labelContent}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  },
  (prev, next) => {
    return JSON.stringify(prev.labels) === JSON.stringify(next.labels);
  },
);
MailLabels.displayName = 'MailLabels';

function getNormalizedLabelKey(label: string) {
  return label.toLowerCase().replace(/^category_/i, '');
}

function capitalize(str: string) {
  return str.substring(0, 1).toUpperCase() + str.substring(1).toLowerCase();
}

function getLabelIcon(label: string) {
  const normalizedLabel = label.toLowerCase().replace(/^category_/i, '');

  switch (normalizedLabel) {
    case 'important':
      return <AlertTriangle className="h-3 w-3" />;
    case 'promotions':
      return <Tag className="h-3 w-3 rotate-90" />;
    case 'personal':
      return <User className="h-3 w-3" />;
    case 'updates':
      return <Bell className="h-3 w-3" />;
    case 'work':
      return <Briefcase className="h-3 w-3" />;
    case 'forums':
      return <Users className="h-3 w-3" />;
    case 'notes':
      return <StickyNote className="h-3 w-3" />;
    case 'starred':
      return <Star className="h-3 w-3" />;
    default:
      return null;
  }
}

function getDefaultBadgeStyle(label: string): ComponentProps<typeof Badge>['variant'] {
  const normalizedLabel = label.toLowerCase().replace(/^category_/i, '');

  switch (normalizedLabel) {
    case 'starred':
    case 'important':
      return 'important';
    case 'promotions':
      return 'promotions';
    case 'personal':
      return 'personal';
    case 'updates':
      return 'updates';
    case 'work':
      return 'default';
    case 'forums':
      return 'forums';
    case 'notes':
      return 'secondary';
    default:
      return 'secondary';
  }
}
