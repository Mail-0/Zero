'use client';

import {
  Archive2,
  Bell,
  ChevronDown,
  GroupPeople,
  Lightning,
  People,
  Star2,
  Tag,
  Trash,
  User,
} from '../icons/icons';
import {
  cn,
  FOLDERS,
  formatDate,
  getEmailLogo,
  getMainSearchTerm,
  parseNaturalLanguageSearch,
} from '@/lib/utils';
import {
  type ComponentProps,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ConditionalThreadProps, MailListProps, MailSelectMode, ParsedMessage } from '@/types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { moveThreadsTo, type ThreadDestination } from '@/lib/thread-actions';
import { Briefcase, Check, Star, StickyNote, Users } from 'lucide-react';
import { ThreadContextMenu } from '@/components/context/thread-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useMail, type Config } from '@/components/mail/use-mail';
import { useMailNavigation } from '@/hooks/use-mail-navigation';
import { focusedIndexAtom } from '@/hooks/use-mail-navigation';
import { backgroundQueueAtom } from '@/store/backgroundQueue';
import { useThread, useThreads } from '@/hooks/use-threads';
import { useSearchValue } from '@/hooks/use-search-value';
import { ScrollArea } from '@/components/ui/scroll-area';
import { highlightText } from '@/lib/email-utils.client';
import { useHotkeysContext } from 'react-hotkeys-hook';
import { useParams, useRouter } from 'next/navigation';
import { useTRPC } from '@/providers/query-provider';
import { useThreadLabels } from '@/hooks/use-labels';
import { useKeyState } from '@/hooks/use-hot-key';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSession } from '@/lib/auth-client';
import { RenderLabels } from './render-labels';
import { Badge } from '@/components/ui/badge';
import { useDraft } from '@/hooks/use-drafts';
import { useStats } from '@/hooks/use-stats';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Button } from '../ui/button';
import { useQueryState } from 'nuqs';
import { Categories } from './mail';
import items from './demo.json';
import { useAtom } from 'jotai';
import Image from 'next/image';
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

const Draft = memo(({ message }: { message: { id: string } }) => {
  const { data: draft } = useDraft(message.id);
  const [composeOpen, setComposeOpen] = useQueryState('isComposeOpen');
  const [draftId, setDraftId] = useQueryState('draftId');
  const handleMailClick = useCallback(() => {
    setComposeOpen('true');
    setDraftId(message.id);
    return;
  }, [message.id]);

  return (
    <div className="select-none py-1" onClick={handleMailClick}>
      <div
        key={message.id}
        className={cn(
          'hover:bg-offsetLight hover:bg-primary/5 group relative mx-[8px] flex cursor-pointer flex-col items-start overflow-clip rounded-[10px] border-transparent py-3 text-left text-sm transition-all hover:opacity-100',
        )}
      >
        <div
          className={cn(
            'bg-primary absolute inset-y-0 left-0 w-1 -translate-x-2 transition-transform ease-out',
          )}
        />
        <div className="flex w-full items-center justify-between gap-4 px-4">
          <div className="flex w-full justify-between">
            <div className="w-full">
              <div className="flex w-full flex-row items-center justify-between">
                <div className="flex flex-row items-center gap-[4px]">
                  <span
                    className={cn(
                      'font-medium',
                      'text-md flex items-baseline gap-1 group-hover:opacity-100',
                    )}
                  >
                    <span className={cn('max-w-[25ch] truncate text-sm')}>
                      {cleanNameDisplay(draft?.to?.[0] || 'noname') || ''}
                    </span>
                  </span>
                </div>
              </div>
              <div className="flex justify-between">
                <p
                  className={cn(
                    'text-muted-foreground mt-1 line-clamp-1 max-w-[50ch] text-sm md:max-w-[30ch]',
                  )}
                >
                  {draft?.subject}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

const Thread = memo(
  ({
    message,
    selectMode,
    demo,
    onClick,
    sessionData,
    isKeyboardFocused,
    demoMessage,
    index,
  }: ConditionalThreadProps & { index?: number }) => {
    const [searchValue, setSearchValue] = useSearchValue();
    const t = useTranslations();
    const { folder } = useParams<{ folder: string }>();
    const [{ refetch: refetchThreads }] = useThreads();
    const [threadId] = useQueryState('threadId');
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const isHovering = useRef<boolean>(false);
    const hasPrefetched = useRef<boolean>(false);
    const isMobile = useIsMobile();
    const [, setBackgroundQueue] = useAtom(backgroundQueueAtom);
    const { refetch: refetchStats } = useStats();
    const { data: getThreadData, isLoading, isGroupThread } = useThread(demo ? null : message.id);
    const [isHovered, setIsHovered] = useState(false);
    const [isStarred, setIsStarred] = useState(false);
    const queryClient = useQueryClient();
    const trpc = useTRPC();

    const { mutateAsync: toggleStar } = useMutation(trpc.mail.toggleStar.mutationOptions());

    // Set initial star state based on email data
    useEffect(() => {
      if (getThreadData?.latest?.tags) {
        setIsStarred(getThreadData.latest.tags.some((tag) => tag.name === 'STARRED'));
      }
    }, [getThreadData?.latest?.tags]);

    const handleToggleStar = useCallback(async () => {
      if (!getThreadData || !message.id) return;

      const newStarredState = !isStarred;
      setIsStarred(newStarredState);
      if (newStarredState) {
        toast.success(t('common.actions.addedToFavorites'));
      } else {
        toast.success(t('common.actions.removedFromFavorites'));
      }
      await toggleStar({ ids: [message.id] });
      refetchThreads();
    }, [getThreadData, message.id, isStarred, refetchThreads, t]);

    const moveThreadTo = useCallback(
      async (destination: ThreadDestination) => {
        if (!message.id) return;
        const promise = moveThreadsTo({
          threadIds: [message.id],
          currentFolder: folder,
          destination,
        });
        setBackgroundQueue({ type: 'add', threadId: `thread:${message.id}` });

        toast.success(
          destination === 'inbox'
            ? t('common.actions.movedToInbox')
            : destination === 'spam'
              ? t('common.actions.movedToSpam')
              : destination === 'bin'
                ? t('common.actions.movedToBin')
                : t('common.actions.archived'),
        );
        toast.promise(promise, {
          error: t('common.actions.failedToMove'),
          finally: async () => {
            await Promise.all([refetchStats(), refetchThreads()]);
          },
        });
      },
      [message.id, folder, t, setBackgroundQueue, refetchStats, refetchThreads],
    );

    const latestMessage = demo ? demoMessage : getThreadData?.latest;
    const emailContent = demo ? demoMessage?.body : getThreadData?.latest?.body;

    const { labels: threadLabels } = useThreadLabels(
      getThreadData?.labels ? getThreadData.labels.map((l) => l.id) : [],
    );

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

    const [mailState, setMail] = useMail();

    const isMailSelected = useMemo(() => {
      if (!threadId || !latestMessage) return false;
      const _threadId = latestMessage.threadId ?? message.id;
      return _threadId === threadId || threadId === mailState.selected;
    }, [threadId, message.id, latestMessage, mailState.selected]);

    const isMailBulkSelected = mailState.bulkSelected.includes(
      latestMessage?.threadId ?? message.id,
    );

    const isFolderInbox = folder === FOLDERS.INBOX || !folder;
    const isFolderSpam = folder === FOLDERS.SPAM;
    const isFolderSent = folder === FOLDERS.SENT;
    const isFolderBin = folder === FOLDERS.BIN;

    const cleanName = useMemo(() => {
      if (!latestMessage?.sender?.name) return '';
      return latestMessage.sender.name.trim().replace(/^['"]|['"]$/g, '');
    }, [latestMessage?.sender?.name]);

    const handleMouseEnter = () => {
      if (demo || !latestMessage) return;
      isHovering.current = true;
      setIsHovered(true);

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
            console.log(
              `🕒 Hover threshold reached for email ${messageId}, initiating prefetch...`,
            );
            void queryClient.prefetchQuery(trpc.mail.get.queryOptions({ id: messageId }));
            hasPrefetched.current = true;
          }
        }, HOVER_DELAY);
      }
    };

    const handleMouseLeave = () => {
      isHovering.current = false;
      setIsHovered(false);
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

              (isMailSelected || isMailBulkSelected || isKeyboardFocused) &&
                'border-border bg-primary/5 opacity-100',
              isKeyboardFocused && 'ring-primary/50 ring-2',
            )}
          >
            <div className="flex w-full items-center justify-between gap-4">
              <Avatar className="h-8 w-8">
                {isGroupThread ? (
                  <div className="bg-muted flex h-full w-full items-center justify-center rounded-full p-2">
                    <Users className="text-muted-foreground h-4 w-4" />
                  </div>
                ) : (
                  <>
                    <AvatarImage
                      className="bg-muted-foreground/50 dark:bg-muted/50 rounded-full p-2"
                      src={getEmailLogo(latestMessage.sender.email)}
                    />
                    <AvatarFallback className="bg-muted-foreground/50 dark:bg-muted/50 rounded-full">
                      {cleanName[0]?.toUpperCase()}
                    </AvatarFallback>
                  </>
                )}
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
                          {highlightText(
                            cleanNameDisplay(latestMessage.sender.name) || '',
                            searchValue.highlight,
                          )}
                        </span>{' '}
                        {latestMessage.unread && !isMailSelected ? (
                          <span className="size-2 rounded bg-[#006FFE]" />
                        ) : null}
                      </p>
                      {/* <MailLabels labels={latestMessage.tags} /> */}
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
        <div className={'select-none'} onClick={onClick ? onClick(latestMessage) : undefined}>
          <div
            data-thread-id={latestMessage.threadId ?? latestMessage.id}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            key={latestMessage.threadId ?? latestMessage.id}
            className={cn(
              'hover:bg-offsetLight hover:bg-primary/5 group relative mx-1 flex cursor-pointer flex-col items-start rounded-lg border-transparent py-2 text-left text-sm transition-all hover:opacity-100',
              (isMailSelected || isMailBulkSelected || isKeyboardFocused) &&
                'border-border bg-primary/5 opacity-100',
              isKeyboardFocused && 'ring-primary/50',
              'relative',
            )}
          >
            {/* Quick Action Row */}
            {isHovered && !isMobile && (
              <div
                className={cn(
                  'bg-panel absolute right-2 z-[25] flex -translate-y-1/2 items-center gap-1 rounded-xl border p-1 shadow-sm',
                  index === 0 ? 'top-4' : 'top-[-1]',
                )}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 overflow-visible [&_svg]:size-3.5"
                      onClick={handleToggleStar}
                    >
                      <Star2
                        className={cn(
                          'h-4 w-4',
                          isStarred
                            ? 'fill-yellow-400 stroke-yellow-400'
                            : 'stroke-muted-foreground fill-transparent',
                        )}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="mb-1">
                    {isStarred ? t('common.threadDisplay.unstar') : t('common.threadDisplay.star')}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 [&_svg]:size-3.5"
                      onClick={() => moveThreadTo('archive')}
                    >
                      <Archive2 className="fill-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="mb-1">
                    {t('common.threadDisplay.archive')}
                  </TooltipContent>
                </Tooltip>
                {!isFolderBin ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-destructive h-6 w-6 [&_svg]:size-3.5"
                        onClick={() => moveThreadTo('bin')}
                      >
                        <Trash className="fill-destructive-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="mb-1">{t('common.actions.Bin')}</TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
            )}

            <div className="flex w-full items-center justify-between gap-4 px-4">
              <div>
                <Avatar className="h-8 w-8 rounded-full border dark:border-none">
                  <div
                    className={cn(
                      'flex h-full w-full items-center justify-center rounded-full bg-blue-500 p-2 dark:bg-blue-500',
                      {
                        hidden: !isMailBulkSelected,
                      },
                    )}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      const threadId = latestMessage.threadId ?? message.id;
                      setMail((prev: Config) => ({
                        ...prev,
                        bulkSelected: prev.bulkSelected.filter((id: string) => id !== threadId),
                      }));
                    }}
                  >
                    <Check className="h-4 w-4 text-white" />
                  </div>
                  {isGroupThread ? (
                    <div className="bg-muted flex h-full w-full items-center justify-center rounded-full p-2">
                      <GroupPeople className="text-muted-foreground h-4 w-4" />
                    </div>
                  ) : (
                    <>
                      <AvatarImage
                        className="rounded-full"
                        src={getEmailLogo(latestMessage.sender.email)}
                      />
                      <AvatarFallback className="rounded-full">
                        {cleanName[0]?.toUpperCase()}
                      </AvatarFallback>
                    </>
                  )}
                </Avatar>
                <div className="z-1 relative">
                  {getThreadData.hasUnread && !isMailSelected && !isFolderSent && !isFolderBin ? (
                    <span className="absolute -bottom-[1px] right-0.5 size-2 rounded bg-[#006FFE]" />
                  ) : null}
                </div>
              </div>

              <div className="flex w-full justify-between">
                <div className="w-full">
                  <div className="flex w-full flex-row items-center justify-between">
                    <div className="flex flex-row items-center gap-[4px]">
                      <span
                        className={cn(
                          getThreadData.hasUnread && !isMailSelected ? 'font-bold' : 'font-medium',
                          'text-md flex items-baseline gap-1 group-hover:opacity-100',
                        )}
                      >
                        {isFolderSent ? (
                          <span className={cn('truncate text-sm md:max-w-[15ch] xl:max-w-[25ch]')}>
                            {highlightText(latestMessage.subject, searchValue.highlight)}
                          </span>
                        ) : (
                          <span className={cn('truncate text-sm md:max-w-[15ch] xl:max-w-[25ch]')}>
                            {highlightText(
                              cleanNameDisplay(latestMessage.sender.name) || '',
                              searchValue.highlight,
                            )}
                          </span>
                        )}{' '}
                        {!isFolderSent ? (
                          <span className="flex items-center space-x-2">
                            <RenderLabels labels={threadLabels} />
                          </span>
                        ) : null}
                      </span>
                      {getThreadData.totalReplies > 1 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="rounded-md text-xs opacity-70">
                              [{getThreadData.totalReplies}]
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="p-1 text-xs">
                            {t('common.mail.replies', { count: getThreadData.totalReplies })}
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                    {latestMessage.receivedOn ? (
                      <p
                        className={cn(
                          'text-muted-foreground text-nowrap text-xs font-normal opacity-70 transition-opacity group-hover:opacity-100',
                          isMailSelected && 'opacity-100',
                        )}
                      >
                        {formatDate(latestMessage.receivedOn.split('.')[0] || '')}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex justify-between">
                    {isFolderSent ? (
                      <p
                        className={cn(
                          'mt-1 line-clamp-1 max-w-[50ch] text-sm text-[#8C8C8C] md:max-w-[25ch]',
                        )}
                      >
                        {latestMessage.to.map((e) => e.email).join(', ')}
                      </p>
                    ) : (
                      <p
                        className={cn(
                          'text-muted-foreground mt-1 line-clamp-1 max-w-[50ch] text-sm md:max-w-[40ch]',
                        )}
                      >
                        {highlightText(latestMessage.subject, searchValue.highlight)}
                      </p>
                    )}
                    {getThreadData.labels ? <MailLabels labels={getThreadData.labels} /> : null}
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
        refreshCallback={() => refetchThreads()}
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
      <div className={cn('relative min-h-[calc(100dvh-4rem)] w-full')}>
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
  const [, setThreadId] = useQueryState('threadId');
  const [, setDraftId] = useQueryState('draftId');
  const [category, setCategory] = useQueryState('category');
  const [searchValue, setSearchValue] = useSearchValue();
  const { enableScope, disableScope } = useHotkeysContext();
  const [{ refetch, isLoading, isFetching, hasNextPage }, items, , loadMore] = useThreads();

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
      : allCategories.find((cat) => cat.id === 'Important');

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
      void refetch();
    };

    window.addEventListener('refreshMailList', handleRefresh);
    return () => window.removeEventListener('refreshMailList', handleRefresh);
  }, [refetch]);

  const parentRef = useRef<HTMLDivElement>(null);

  const handleNavigateToThread = useCallback(
    (threadId: string) => {
      setThreadId(threadId);
      // Prevent default navigation
      return false;
    },
    [setThreadId],
  );

  const isFolderDraft = folder === FOLDERS.DRAFT;
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
    if (isLoading || isFetching || !hasNextPage) return;
    console.log('Loading more items...');
    void loadMore();
  }, [isLoading, isFetching, loadMore, hasNextPage]);

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

  const [, setActiveReplyId] = useQueryState('activeReplyId');
  const [mail, setMail] = useMail();

  const handleSelectMail = useCallback(
    (message: ParsedMessage) => {
      const itemId = message.threadId ?? message.id;
      switch (getSelectMode()) {
        case 'mass': {
          const newSelected = mail.bulkSelected.includes(itemId)
            ? mail.bulkSelected.filter((id) => id !== itemId)
            : [...mail.bulkSelected, itemId];
          return setMail({ ...mail, bulkSelected: newSelected });
        }
      }
      setMail({ ...mail, bulkSelected: [message.threadId ?? message.id] });
    },
    [mail, setMail, getSelectMode],
  );

  const [, setFocusedIndex] = useAtom(focusedIndexAtom);

  const handleMailClick = useCallback(
    (message: ParsedMessage) => () => {
      if (getSelectMode() !== 'single') {
        return handleSelectMail(message);
      }
      handleMouseEnter(message.id);

      const messageThreadId = message.threadId ?? message.id;
      const clickedIndex = items.findIndex((item) => item.id === messageThreadId);
      setFocusedIndex(clickedIndex);

      // Update URL param without navigation
      void setThreadId(messageThreadId);
      void setDraftId(null);
      void setActiveReplyId(null);
    },
    [mail, items, setFocusedIndex],
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

  const clearFilters = () => {
    setCategory(null);
    setSearchValue({
      value: '',
      highlight: '',
      folder: '',
    });
  };

  const { resolvedTheme } = useTheme();

  return (
    <>
      <div
        ref={parentRef}
        className={cn(
          'hide-link-indicator h-full w-full',
          getSelectMode() === 'range' && 'select-none',
        )}
        onMouseEnter={() => {
          enableScope('mail-list');
        }}
        onMouseLeave={() => {
          disableScope('mail-list');
        }}
      >
        <ScrollArea hideScrollbar className="hide-scrollbar h-full overflow-auto">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
            </div>
          ) : !items || items.length === 0 ? (
            <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center">
              <div className="flex flex-col items-center justify-center gap-2 text-center">
                <Image
                  suppressHydrationWarning
                  src={resolvedTheme === 'dark' ? '/empty-state.svg' : '/empty-state-light.svg'}
                  alt="Empty Inbox"
                  width={200}
                  height={200}
                />
                <div className="mt-5">
                  <p className="text-lg">It's empty here</p>
                  <p className="text-md text-foreground/70">
                    Search for another email or{' '}
                    <button className="underline" onClick={clearFilters}>
                      clear filters
                    </button>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {items
                .filter((data) => data.id)
                .map((data, index) => {
                  if (!data || !data.id) return null;

                  return isFolderDraft ? (
                    <Draft key={`${data.id}-${index}`} message={{ id: data.id }} />
                  ) : (
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
                      index={index}
                    />
                  );
                })}
              {items.length >= 9 && hasNextPage && !isFetching && (
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
            </div>
          )}
        </ScrollArea>
      </div>
      <div className="w-full pt-4 text-center">
        {isLoading || isFetching ? (
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

MailList.displayName = 'MailList';

export const MailLabels = memo(
  ({ labels }: { labels: { id: string; name: string }[] }) => {
    const t = useTranslations();

    if (!labels?.length) return null;

    const visibleLabels = labels.filter(
      (label) => !['unread', 'inbox'].includes(label.name.toLowerCase()),
    );

    if (!visibleLabels.length) return null;

    return (
      <div className={cn('flex select-none items-center')}>
        {visibleLabels.map((label) => {
          const style = getDefaultBadgeStyle(label.name);
          if (label.name.toLowerCase() === 'notes') {
            return (
              <Tooltip key={label.id}>
                <TooltipTrigger asChild>
                  <Badge className="rounded-md bg-amber-100 p-1 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400">
                    {getLabelIcon(label.name)}
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

          const normalizedLabel = getNormalizedLabelKey(label.name);

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
            <Badge key={label.id} className="rounded-md p-1" variant={style}>
              {getLabelIcon(label.name)}
            </Badge>
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
      return <Lightning className="h-3.5 w-3.5 fill-[#F59E0D]" />;
    case 'promotions':
      return <Tag className="h-3.5 w-3.5 fill-[#F43F5E]" />;
    case 'personal':
      return <User className="h-3.5 w-3.5 fill-[#39AE4A]" />;
    case 'updates':
      return <Bell className="h-3.5 w-3.5 fill-[#8B5CF6]" />;
    case 'work':
      return <Briefcase className="h-3.5 w-3.5" />;
    case 'forums':
      return <People className="h-3.5 w-3.5 fill-blue-500" />;
    case 'notes':
      return <StickyNote className="h-3.5 w-3.5" />;
    case 'starred':
      return <Star className="h-3.5 w-3.5" />;
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

// Helper function to clean name display
const cleanNameDisplay = (name?: string) => {
  if (!name) return '';
  const match = name.match(/^[^a-zA-Z0-9.]*(.*?)[^a-zA-Z0-9.]*$/);
  return match ? match[1] : name;
};
