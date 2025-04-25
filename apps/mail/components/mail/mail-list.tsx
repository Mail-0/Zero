'use client';

import {
  cn,
  FOLDERS,
  formatDate,
  getEmailLogo,
  getMainSearchTerm,
  parseNaturalLanguageSearch,
  parseNaturalLanguageDate,
} from '@/lib/utils';
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
} from 'lucide-react';
import type {
  ConditionalThreadProps,
  InitialThread,
  MailListProps,
  MailSelectMode,
  ParsedMessage,
} from '@/types';
import { type ComponentProps, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EmptyState, type FolderType } from '@/components/mail/empty-state';
import { preloadThread, useThread, useThreads } from '@/hooks/use-threads';
import { ThreadContextMenu } from '@/components/context/thread-context';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { useMailNavigation } from '@/hooks/use-mail-navigation';
import { useSearchValue } from '@/hooks/use-search-value';
import { markAsRead, markAsUnread } from '@/actions/mail';
import { ScrollArea } from '@/components/ui/scroll-area';
import { highlightText } from '@/lib/email-utils.client';
import { useHotkeysContext } from 'react-hotkeys-hook';
import { useParams, useRouter } from 'next/navigation';
import { useMail } from '@/components/mail/use-mail';
import type { VirtuosoHandle } from 'react-virtuoso';
import { useKeyState } from '@/hooks/use-hot-key';
import { useSession } from '@/lib/auth-client';
import { RenderLabels } from './render-labels';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import { Label } from '@/hooks/use-labels';
import { Button } from '../ui/button';
import { useQueryState } from 'nuqs';
import { Categories } from './mail';
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
  isFolderBin,
  refreshCallback,
}: {
  children: React.ReactNode;
  emailId: string;
  threadId: string;
  isFolderInbox: boolean;
  isFolderSpam: boolean;
  isFolderSent: boolean;
  isFolderBin: boolean;
  refreshCallback: () => void;
}) => {
  return (
    <ThreadContextMenu
      emailId={emailId}
      threadId={threadId}
      isInbox={isFolderInbox}
      isSpam={isFolderSpam}
      isSent={isFolderSent}
      isBin={isFolderBin}
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
    onClick,
    sessionData,
    isKeyboardFocused,
    demoMessage,
  }: ConditionalThreadProps) => {
    const [mail] = useMail();
    const [searchValue, setSearchValue] = useSearchValue();
    const t = useTranslations();
    const { folder } = useParams<{ folder: string }>();
    const { mutate } = useThreads();
    const [threadId, setThreadId] = useQueryState('threadId');
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const isHovering = useRef<boolean>(false);
    const hasPrefetched = useRef<boolean>(false);
    const { data: getThreadData, isLoading } = useThread(demo ? null : message.id);

    const latestMessage = demo ? demoMessage : getThreadData?.latest;
    const emailContent = demo ? demoMessage?.body : getThreadData?.latest?.body;

    const mainSearchTerm = useMemo(() => {
      if (!searchValue.highlight) return '';
      return getMainSearchTerm(searchValue.highlight);
    }, [searchValue.highlight]);

    const semanticSearchQuery = useMemo(() => {
      if (!searchValue.value) return '';
      return parseNaturalLanguageSearch(searchValue.value);
    }, [searchValue.value]);

    // Use semanticSearchQuery when filtering/searching emails
    useEffect(() => {
      if (semanticSearchQuery && semanticSearchQuery !== searchValue.value) {
        // Update the search value with our semantic query
        setSearchValue({
          ...searchValue,
          value: semanticSearchQuery,
          isAISearching: true,
        });
      }
    }, [semanticSearchQuery]);

    const isMailSelected = useMemo(() => {
      if (!threadId || !latestMessage) return false;
      const _threadId = latestMessage.threadId ?? message.id;
      return _threadId === threadId || threadId === mail.selected;
    }, [threadId, message.id, latestMessage, mail.selected]);

    const isMailBulkSelected = mail.bulkSelected.includes(latestMessage?.threadId ?? message.id);

    const threadLabels = useMemo(() => {
      if (!latestMessage) return [];
      return [...(latestMessage.tags || [])];
    }, [latestMessage]);

    const isFolderInbox = folder === FOLDERS.INBOX || !folder;
    const isFolderSpam = folder === FOLDERS.SPAM;
    const isFolderSent = folder === FOLDERS.SENT;
    const isFolderBin = folder === FOLDERS.BIN;

    const handleMouseEnter = () => {
      if (demo || !latestMessage) return;
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
            const messageId = latestMessage.threadId ?? message.id;
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
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      window.dispatchEvent(new CustomEvent('emailHover', { detail: { id: null } }));
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

    if (!demo && (isLoading || !latestMessage || !getThreadData)) return null;

    const demoContent =
      demo && latestMessage ? (
        <div className="p-1 px-3" onClick={onClick ? onClick(latestMessage) : undefined}>
          <div
            data-thread-id={latestMessage.threadId ?? message.id}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            key={latestMessage.threadId ?? message.id}
            className={cn(
              'hover:bg-offsetLight hover:bg-primary/5 group relative flex cursor-pointer flex-col items-start overflow-clip rounded-lg border border-transparent px-4 py-3 text-left text-sm transition-all hover:opacity-100',
              isMailSelected || (!latestMessage.unread && 'opacity-80'),
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
                  src={getEmailLogo(latestMessage.sender.email)}
                />
                <AvatarFallback className="bg-muted-foreground/50 dark:bg-muted/50">
                  {latestMessage.sender?.name[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex w-full justify-between">
                <div className="w-full">
                  <div className="flex w-full flex-row items-center justify-between">
                    <div className="flex flex-row items-center gap-1">
                      <p
                        className={cn(
                          latestMessage.unread && !isMailSelected ? 'font-bold' : 'font-medium',
                          'text-md flex items-baseline gap-1 group-hover:opacity-100',
                        )}
                      >
                        <span className={cn(threadId ? 'max-w-[3ch] truncate' : '')}>
                          {highlightText(latestMessage.sender.name, searchValue.highlight)}
                        </span>{' '}
                        {latestMessage.unread && !isMailSelected ? (
                          <span className="size-2 rounded bg-[#006FFE]" />
                        ) : null}
                      </p>
                      <MailLabels labels={threadLabels} />
                      {Math.random() > 0.5 &&
                        (() => {
                          const count = Math.floor(Math.random() * 10) + 1;
                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="rounded-md border border-dotted px-[5px] py-[1px] text-xs opacity-70">
                                  {count}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="px-1 py-0 text-xs">
                                {t('common.mail.replies', { count })}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })()}
                    </div>
                    {latestMessage.receivedOn ? (
                      <p
                        className={cn(
                          'text-nowrap text-xs font-normal opacity-70 transition-opacity group-hover:opacity-100',
                          isMailSelected && 'opacity-100',
                        )}
                      >
                        {formatDate(latestMessage.receivedOn.split('.')[0] || '')}
                      </p>
                    ) : null}
                  </div>
                  <p className={cn('mt-1 line-clamp-1 text-xs opacity-70 transition-opacity')}>
                    {highlightText(latestMessage.subject, searchValue.highlight)}
                  </p>
                  {emailContent && (
                    <div className="text-muted-foreground mt-2 line-clamp-2 text-xs">
                      {highlightText(emailContent, searchValue.highlight)}
                    </div>
                  )}
                  {mainSearchTerm && (
                    <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                      <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5">
                        {mainSearchTerm}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null;

    if (demo) return demoContent;

    const content =
      latestMessage && getThreadData ? (
        <div
          className="select-none p-1 px-3"
          onClick={onClick ? onClick(latestMessage) : undefined}
        >
          <div
            data-thread-id={latestMessage.threadId ?? latestMessage.id}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            key={latestMessage.threadId ?? latestMessage.id}
            className={cn(
              'hover:bg-offsetLight hover:bg-primary/5 group relative flex cursor-pointer flex-col items-start overflow-clip rounded-lg border border-transparent px-4 py-3 text-left text-sm transition-all hover:opacity-100',
              (isMailSelected ||
                (!getThreadData.hasUnread && !['sent', 'archive', 'bin'].includes(folder))) &&
                'opacity-80 dark:opacity-50 dark:hover:opacity-80',
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
                  src={getEmailLogo(latestMessage.sender.email)}
                />
                <AvatarFallback className="bg-muted-foreground/50 dark:bg-muted/50">
                  {latestMessage.sender.name[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex w-full justify-between">
                <div className="w-full">
                  <div className="flex w-full flex-row items-center justify-between">
                    <div className="flex flex-row items-center gap-1">
                      <p
                        className={cn(
                          getThreadData.hasUnread && !isMailSelected ? 'font-bold' : 'font-medium',
                          'text-md flex items-baseline gap-1 group-hover:opacity-100',
                        )}
                      >
                        <span className={cn('truncate', threadId ? 'max-w-[20ch] truncate' : '')}>
                          {highlightText(latestMessage.sender.name, searchValue.highlight)}
                        </span>{' '}
                        {getThreadData.hasUnread && !isMailSelected ? (
                          <span className="size-2 rounded bg-[#006FFE]" />
                        ) : null}
                        <span className="space-x-2">
                          <RenderLabels ids={threadLabels} />
                        </span>
                      </p>
                      {getThreadData.totalReplies > 1 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="rounded-md border border-dotted px-[5px] py-[1px] text-xs opacity-70">
                              {getThreadData.totalReplies}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="px-1 py-0 text-xs">
                            {t('common.mail.replies', { count: getThreadData.totalReplies })}
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                    {latestMessage.receivedOn ? (
                      <p
                        className={cn(
                          'text-nowrap text-xs font-normal opacity-70 transition-opacity group-hover:opacity-100',
                          isMailSelected && 'opacity-100',
                        )}
                      >
                        {formatDate(latestMessage.receivedOn.split('.')[0] || '')}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex justify-between">
                    <p className={cn('mt-1 line-clamp-1 text-xs opacity-70 transition-opacity')}>
                      {highlightText(latestMessage.subject, searchValue.highlight)}
                    </p>
                    {/* <MailLabels labels={threadLabels} /> */}
                  </div>
                  {emailContent && (
                    <div className="text-muted-foreground mt-2 line-clamp-2 text-xs">
                      {highlightText(emailContent, searchValue.highlight)}
                    </div>
                  )}
                  {mainSearchTerm && (
                    <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                      <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5">
                        {mainSearchTerm}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null;

    return latestMessage ? (
      <ThreadWrapper
        emailId={message.id}
        threadId={latestMessage.threadId ?? message.id}
        isFolderInbox={isFolderInbox}
        isFolderSpam={isFolderSpam}
        isFolderSent={isFolderSent}
        isFolderBin={isFolderBin}
        refreshCallback={() => mutate()}
      >
        {content}
      </ThreadWrapper>
    ) : null;
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
                onClick={(message) => () => onSelectMail && onSelectMail(message)}
                demoMessage={item as any}
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
  const { data: session } = useSession();
  const t = useTranslations();
  const router = useRouter();
  const [threadId, setThreadId] = useQueryState('threadId');
  const [category, setCategory] = useQueryState('category');
  const [searchValue, setSearchValue] = useSearchValue();
  const { enableScope, disableScope } = useHotkeysContext();
  const {
    data: { threads: items = [], nextPageToken },
    isValidating,
    isLoading,
    loadMore,
    mutate,
    isReachingEnd,
  } = useThreads();

  const allCategories = Categories();

  // Skip category filtering for drafts, spam, sent, archive, and bin pages
  const shouldFilter = !['draft', 'spam', 'sent', 'archive', 'bin'].includes(folder || '');

  const sessionData = useMemo(
    () => ({
      userId: session?.user?.id ?? '',
      connectionId: session?.connectionId ?? null,
    }),
    [session],
  );

  // Set initial category search value only if not in special folders
  useEffect(() => {
    if (!shouldFilter) return;

    const currentCategory = category
      ? allCategories.find((cat) => cat.id === category)
      : allCategories.find((cat) => cat.id === 'Primary');

    if (currentCategory && searchValue.value === '') {
      setSearchValue({
        value: currentCategory.searchValue || '',
        highlight: '',
        folder: '',
      });
    }
  }, [allCategories, category, shouldFilter, searchValue.value, setSearchValue]);

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
      setThreadId(threadId);
    },
    [folder, router],
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
    (message: ParsedMessage) => () => {
      handleMouseEnter(message.id);

      const messageThreadId = message.threadId ?? message.id;

      // Update URL param without navigation
      void setThreadId(messageThreadId);
    },
    [],
  );

  const isFiltering = searchValue.value.trim().length > 0;

  // Add effect to handle search loading state
  useEffect(() => {
    if (isFiltering && !isLoading) {
      // Reset the search value when loading is complete
      setSearchValue({
        ...searchValue,
        isLoading: false,
      });
    }
  }, [isLoading, isFiltering, setSearchValue]);

  return (
    <>
      <div
        ref={parentRef}
        className={cn('h-full w-full', getSelectMode() === 'range' && 'select-none')}
        onMouseEnter={() => {
          console.log('[MailList] Mouse Enter - Enabling scope: mail-list');
          enableScope('mail-list');
        }}
        onMouseLeave={() => {
          console.log('[MailList] Mouse Leave - Disabling scope: mail-list');
          disableScope('mail-list');
        }}
      >
        <ScrollArea className="hide-scrollbar h-full overflow-auto">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
            </div>
          ) : !items || items.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-center">
              <p className="text-muted-foreground text-sm">
                {searchValue.value ? t('common.mail.noSearchResults') : t('common.mail.noEmails')}
              </p>
              {searchValue.value && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchValue({
                      value: '',
                      highlight: '',
                      folder: '',
                      isLoading: false,
                    });
                  }}
                >
                  {t('common.mail.clearSearch')}
                </Button>
              )}
            </div>
          ) : (
            <>
              {items
                .filter((data) => data.id)
                .map((data, index) => {
                  if (!data || !data.id) return null;

                  return (
                    <Thread
                      onClick={handleMailClick}
                      selectMode={getSelectMode()}
                      isCompact={isCompact}
                      sessionData={sessionData}
                      message={data}
                      key={`${data.id}-${index}`}
                      isKeyboardFocused={focusedIndex === index && keyboardActive}
                      isInQuickActionMode={isQuickActionMode && focusedIndex === index}
                      selectedQuickActionIndex={quickActionIndex}
                      resetNavigation={resetNavigation}
                    />
                  );
                })}
              {items.length >= 9 && nextPageToken && !isValidating && (
                <Button
                  variant={'ghost'}
                  className="w-full rounded-none"
                  onMouseDown={handleScroll}
                  disabled={isLoading}
                >
                  {isLoading ? (
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
            </>
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
                <TooltipContent className="hidden px-1 py-0 text-xs">
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
              <TooltipContent className="hidden px-1 py-0 text-xs" variant={style}>
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
