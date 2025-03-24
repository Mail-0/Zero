'use client';

import type { ConditionalThreadProps, InitialThread, MailListProps, MailSelectMode } from '@/types';
import { AlertTriangle, Bell, Briefcase, Star, StickyNote, Tag, User, Users } from 'lucide-react';
import { type ComponentProps, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EmptyState, type FolderType } from '@/components/mail/empty-state';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
import { cn, formatDate } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { Virtuoso } from 'react-virtuoso';
import items from './demo.json';
import { toast } from 'sonner';
const HOVER_DELAY = 1000; // ms before prefetching

const Thread = memo(
  ({
    message,
    selectMode,
    demo,
    onClick,
    sessionData,
    folder,
    // onRefresh,
  }: ConditionalThreadProps & {
    folder?: string;
    // onRefresh?: () => void;
  }) => {
    const [mail] = useMail();
    const [searchValue] = useSearchValue();
    const t = useTranslations();
    const searchParams = useSearchParams();
    const threadIdParam = searchParams.get('threadId');
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const isHovering = useRef<boolean>(false);
    const hasPrefetched = useRef<boolean>(false);

    // const isFolderInbox = folder === FOLDERS.INBOX || !folder;
    // const isFolderSpam = folder === FOLDERS.SPAM;
    // const isFolderSent = folder === FOLDERS.SENT;

    const isMailSelected = useMemo(() => {
      const threadId = message.threadId ?? message.id;
      return threadId === threadIdParam;
    }, [message.id, message.threadId, threadIdParam]);

    const isMailBulkSelected = mail.bulkSelected.includes(message.id);

    const threadLabels = useMemo(() => {
      return [...(message.tags || [])];
    }, [message.tags]);

    const handleMouseEnter = () => {
      if (demo) return;
      isHovering.current = true;

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
            void preloadThread(
              sessionData.userId,
              messageId,
              message.connectionId || sessionData.connectionId || '',
            );
            hasPrefetched.current = true;
          }
        }, HOVER_DELAY);
      }
    };

    const handleMouseLeave = () => {
      isHovering.current = false;
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

    return (
      // <ThreadContextMenu
      // 	emailId={message.id}
      // 	threadId={message.threadId ?? message.id}
      // 	isInbox={isFolderInbox}
      // 	isSpam={isFolderSpam}
      // 	isSent={isFolderSent}
      // 	refreshCallback={onRefresh}
      // >
      <div className="p-1">
        <div
          onClick={onClick ? onClick(message) : undefined}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          key={message.id}
          className={cn(
            'hover:bg-offsetLight hover:bg-primary/5 group relative flex cursor-pointer flex-col items-start overflow-clip rounded-lg border border-transparent px-4 py-3 text-left text-sm transition-all hover:opacity-100',
            isMailSelected || (!message.unread && 'opacity-50'),
            (isMailSelected || isMailBulkSelected) && 'border-border bg-primary/5 opacity-100',
          )}
        >
          <div
            className={cn(
              'bg-primary absolute inset-y-0 left-0 w-1 -translate-x-2 transition-transform ease-out',
              isMailBulkSelected && 'translate-x-0',
            )}
          />
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-1">
              <p
                className={cn(
                  message.unread && !isMailSelected ? 'font-bold' : 'font-medium',
                  'text-md flex items-baseline gap-1 group-hover:opacity-100',
                )}
              >
                <span className={cn(threadIdParam && 'max-w-[120px] truncate')}>
                  {highlightText(message.sender.name, searchValue.highlight)}
                </span>{' '}
                {message.unread && !isMailSelected ? (
                  <span className="size-2 rounded bg-[#006FFE]" />
                ) : null}
              </p>
              <MailLabels labels={threadLabels} />
              <div className="flex items-center gap-1">
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
            </div>
            {message.receivedOn ? (
              <p
                className={cn(
                  'text-xs font-normal opacity-70 transition-opacity group-hover:opacity-100',
                  isMailSelected && 'opacity-100',
                )}
              >
                {formatDate(message.receivedOn.split('.')[0] || '')}
              </p>
            ) : null}
          </div>
          <div className="flex w-full items-center justify-between">
            <p
              className={cn(
                'mt-1 line-clamp-1 text-xs opacity-70 transition-opacity',
                mail.selected ? 'line-clamp-1' : 'line-clamp-2',
                isMailSelected && 'opacity-100',
              )}
            >
              {highlightText(message.subject, searchValue.highlight)}
            </p>

            {/* Show account info in unified inbox view */}
            {mail.unifiedInbox && message.connectionEmail && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="ml-1 flex items-center">
                    <Badge
                      variant="outline"
                      className="max-w-[100px] truncate px-1.5 py-[1px] text-[11px] font-normal leading-none"
                    >
                      {message.connectionName || message.connectionEmail.split('@')[0]}
                    </Badge>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="px-2 py-1 text-xs">
                  {message.connectionEmail}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
      // </ThreadContextMenu>
    );
  },
);

Thread.displayName = 'Thread';

export function MailListDemo({ items: filteredItems = items }) {
  return (
    <ScrollArea className="h-full pb-2" type="scroll">
      <div className={cn('relative min-h-[calc(100vh-4rem)] w-full')}>
        <div className="absolute left-0 top-0 w-full p-[8px]">
          {filteredItems.map((item) => {
            return item ? <Thread demo key={item.id} message={item} selectMode={'single'} /> : null;
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const threadIdParam = searchParams.get('threadId');

  const sessionData = useMemo(
    () => ({
      userId: session?.user?.id ?? '',
      connectionId: session?.connectionId ?? null,
    }),
    [session],
  );

  const [searchValue] = useSearchValue();

  const {
    data: { threads: items, nextPageToken },
    isValidating,
    isLoading,
    loadMore,
  } = useThreads();

  const parentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<VirtuosoHandle>(null);

  const handleScroll = useCallback(() => {
    if (isLoading || isValidating || !nextPageToken) return;
    console.log('Loading more items...');
    void loadMore();
  }, [isLoading, isValidating, loadMore, nextPageToken]);

  const isKeyPressed = useKeyState();

  const selectAll = useCallback(() => {
    // If there are already items selected, deselect them all
    if (mail.bulkSelected.length > 0) {
      setMail((prev) => ({
        ...prev,
        bulkSelected: [],
      }));
      // toast.success(t('common.mail.deselectAll'));
    }
    // Otherwise select all items
    else if (items.length > 0) {
      const allIds = items.map((item) => item.id);
      setMail((prev) => ({
        ...prev,
        bulkSelected: allIds,
      }));
    } else {
      toast.info(t('common.mail.noEmailsToSelect'));
    }
  }, [items, setMail, mail.bulkSelected, t]);

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
    selectAll();
  });

  useHotKey('Control+a', (event) => {
    event?.preventDefault();
    selectAll();
  });

  useHotKey('Meta+n', (event) => {
    event?.preventDefault();
    selectAll();
  });

  useHotKey('Control+n', (event) => {
    event?.preventDefault();
    selectAll();
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

  const handleMailClick = useCallback(
    (message: InitialThread) => () => {
      const selectMode = getSelectMode();

      if (selectMode === 'mass') {
        const updatedBulkSelected = mail.bulkSelected.includes(message.id)
          ? mail.bulkSelected.filter((id) => id !== message.id)
          : [...mail.bulkSelected, message.id];

        setMail({ ...mail, bulkSelected: updatedBulkSelected });
        return;
      }

      // TODO: Look into making this more performant
      if (selectMode === 'range') {
        const lastSelectedItem =
          mail.bulkSelected[mail.bulkSelected.length - 1] ?? threadIdParam ?? message.id;

        const mailsIndex = items.map((m) => m.id);
        const startIdx = mailsIndex.indexOf(lastSelectedItem);
        const endIdx = mailsIndex.indexOf(message.id);

        if (startIdx !== -1 && endIdx !== -1) {
          const selectedRange = mailsIndex.slice(
            Math.min(startIdx, endIdx),
            Math.max(startIdx, endIdx) + 1,
          );

          setMail({ ...mail, bulkSelected: selectedRange });
        }
        return;
      }

      if (selectMode === 'selectAllBelow') {
        const mailsIndex = items.map((m) => m.id);
        const startIdx = mailsIndex.indexOf(message.id);

        if (startIdx !== -1) {
          const selectedRange = mailsIndex.slice(startIdx);

          setMail({ ...mail, bulkSelected: selectedRange });
        }
        return;
      }

      const threadId = message.threadId ?? message.id;
      const currentParams = new URLSearchParams(searchParams.toString());

      if (threadIdParam === threadId) {
        // Deselect the thread and update URL to remove threadId
        currentParams.delete('threadId');
        setMail((prev) => ({
          ...prev,
          bulkSelected: [],
        }));

        // Update URL to remove threadId
        router.push(`/mail/${folder}?${currentParams.toString()}`);
      } else {
        // Select the thread and update URL with threadId
        currentParams.set('threadId', threadId);
        setMail((prev) => ({
          ...prev,
          bulkSelected: [],
        }));

        // Update URL with threadId
        router.push(`/mail/${folder}?${currentParams.toString()}`);
      }
    },
    [getSelectMode, folder, searchParams, items],
  );

  const isEmpty = items.length === 0;
  const isFiltering = searchValue.value.trim().length > 0;

  if (isEmpty && session) {
    if (isFiltering) {
      return <EmptyState folder="search" className="min-h-[90vh] md:min-h-[90vh]" />;
    }
    return <EmptyState folder={folder as FolderType} className="min-h-[90vh] md:min-h-[90vh]" />;
  }

  return (
    <>
      <div
        ref={parentRef}
        className={cn('h-full w-full', getSelectMode() === 'range' && 'select-none')}
      >
        <Virtuoso
          ref={scrollRef}
          style={{ height: '100%' }}
          totalCount={items.length}
          itemContent={(_: number, data: InitialThread) => (
            <Thread
              onClick={handleMailClick}
              selectMode={getSelectMode()}
              isCompact={isCompact}
              sessionData={sessionData}
              message={data}
              key={data.id}
            />
          )}
          increaseViewportBy={200}
          endReached={handleScroll}
          data={items}
          className="hide-scrollbar"
        />
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
