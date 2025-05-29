import {
  cn,
  FOLDERS,
  formatDate,
  getEmailLogo,
  getMainSearchTerm,
  parseNaturalLanguageSearch,
} from '@/lib/utils';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import { Archive2, ExclamationCircle, GroupPeople, Star2, Trash } from '../icons/icons';
import { useOptimisticThreadState } from '@/components/mail/optimistic-thread-state';
import { focusedIndexAtom, useMailNavigation } from '@/hooks/use-mail-navigation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { MailSelectMode, ParsedMessage, ThreadProps } from '@/types';
import { ThreadContextMenu } from '@/components/context/thread-context';
import { useOptimisticActions } from '@/hooks/use-optimistic-actions';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useMail, type Config } from '@/components/mail/use-mail';
import { type ThreadDestination } from '@/lib/thread-actions';
import { useThread, useThreads } from '@/hooks/use-threads';
import { useSearchValue } from '@/hooks/use-search-value';
import { highlightText } from '@/lib/email-utils.client';
import { useHotkeysContext } from 'react-hotkeys-hook';
import { AnimatePresence, motion } from 'motion/react';
import { useIsFetching } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';
import { useThreadLabels } from '@/hooks/use-labels';
import { useKeyState } from '@/hooks/use-hot-key';
import { VList, type VListHandle } from 'virtua';
import { RenderLabels } from './render-labels';
import { Badge } from '@/components/ui/badge';
import { useDraft } from '@/hooks/use-drafts';
import { Check, Star } from 'lucide-react';
import { useTranslations } from 'use-intl';
import { useParams } from 'react-router';
import { useTheme } from 'next-themes';
import { Button } from '../ui/button';
import { useQueryState } from 'nuqs';
import { Categories } from './mail';
import { useAtom } from 'jotai';

const Thread = memo(
  function Thread({
    message,
    onClick,
    isKeyboardFocused,
    index,
  }: ThreadProps & { index?: number }) {
    const [searchValue, setSearchValue] = useSearchValue();
    const t = useTranslations();
    const { folder } = useParams<{ folder: string }>();
    const [{}, threads] = useThreads();
    const [threadId] = useQueryState('threadId');
    const { data: getThreadData, isGroupThread } = useThread(message.id, message.historyId);
    const [id, setThreadId] = useQueryState('threadId');
    const [, setActiveReplyId] = useQueryState('activeReplyId');
    const [focusedIndex, setFocusedIndex] = useAtom(focusedIndexAtom);
    const latestMessage = getThreadData?.latest;
    const idToUse = useMemo(() => latestMessage?.threadId ?? latestMessage?.id, [latestMessage]);

    const optimisticState = useOptimisticThreadState(idToUse ?? '');

    const displayStarred = useMemo(() => {
      if (optimisticState.optimisticStarred !== null) {
        return optimisticState.optimisticStarred;
      }
      return getThreadData?.latest?.tags?.some((tag) => tag.name === 'STARRED') ?? false;
    }, [optimisticState.optimisticStarred, getThreadData?.latest?.tags]);

    const displayImportant = useMemo(() => {
      if (optimisticState.optimisticImportant !== null) {
        return optimisticState.optimisticImportant;
      }
      return getThreadData?.latest?.tags?.some((tag) => tag.name === 'IMPORTANT') ?? false;
    }, [optimisticState.optimisticImportant, getThreadData?.latest?.tags]);

    const displayUnread = useMemo(() => {
      if (optimisticState.optimisticRead !== null) {
        return !optimisticState.optimisticRead;
      }
      return getThreadData?.hasUnread ?? false;
    }, [optimisticState.optimisticRead, getThreadData?.hasUnread]);

    const optimisticLabels = useMemo(() => {
      if (!getThreadData?.labels) return [];

      const labels = [...getThreadData.labels];
      const hasStarredLabel = labels.some((label) => label.name === 'STARRED');

      if (optimisticState.optimisticStarred !== null) {
        if (optimisticState.optimisticStarred && !hasStarredLabel) {
          labels.push({ id: 'starred-optimistic', name: 'STARRED' });
        } else if (!optimisticState.optimisticStarred && hasStarredLabel) {
          return labels.filter((label) => label.name !== 'STARRED');
        }
      }

      return labels;
    }, [getThreadData?.labels, optimisticState.optimisticStarred]);

    const { optimisticToggleStar } = useOptimisticActions();

    const handleToggleStar = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!getThreadData || !idToUse) return;

        const newStarredState = !displayStarred;
        optimisticToggleStar([idToUse], newStarredState);
      },
      [getThreadData, idToUse, displayStarred, optimisticToggleStar],
    );

    const { optimisticToggleImportant } = useOptimisticActions();

    const handleToggleImportant = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!getThreadData || !idToUse) return;

        const newImportantState = !displayImportant;
        optimisticToggleImportant([idToUse], newImportantState);
      },
      [getThreadData, idToUse, displayImportant, optimisticToggleImportant],
    );

    const handleNext = useCallback(
      (id: string) => {
        if (!id || !threads.length || focusedIndex === null) return setThreadId(null);
        if (focusedIndex < threads.length - 1) {
          const nextThread = threads[focusedIndex];
          if (nextThread) {
            setThreadId(nextThread.id);
            setActiveReplyId(null);
            setFocusedIndex(focusedIndex);
          }
        }
      },
      [threads, id, focusedIndex],
    );

    const { optimisticMoveThreadsTo } = useOptimisticActions();

    const moveThreadTo = useCallback(
      async (destination: ThreadDestination) => {
        if (!idToUse) return;
        handleNext(idToUse);
        optimisticMoveThreadsTo([idToUse], folder ?? '', destination);
      },
      [idToUse, folder, optimisticMoveThreadsTo, handleNext],
    );

    const emailContent = getThreadData?.latest?.body;

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
      if (!threadId || !idToUse) return false;
      const _threadId = idToUse;
      return _threadId === threadId || threadId === mailState.selected;
    }, [threadId, idToUse, mailState.selected]);

    const isMailBulkSelected = idToUse ? mailState.bulkSelected.includes(idToUse) : false;

    const isFolderInbox = folder === FOLDERS.INBOX || !folder;
    const isFolderSpam = folder === FOLDERS.SPAM;
    const isFolderSent = folder === FOLDERS.SENT;
    const isFolderBin = folder === FOLDERS.BIN;

    const cleanName = useMemo(() => {
      if (!latestMessage?.sender?.name) return '';
      return latestMessage.sender.name.trim().replace(/^['"]|['"]$/g, '');
    }, [latestMessage?.sender?.name]);

    const content =
      latestMessage && getThreadData ? (
        <div
          className={'select-none border-b md:my-2 md:border-none'}
          onClick={onClick ? onClick(latestMessage) : undefined}
          onMouseEnter={() => {
            window.dispatchEvent(new CustomEvent('emailHover', { detail: { id: idToUse } }));
          }}
          onMouseLeave={() => {
            window.dispatchEvent(new CustomEvent('emailHover', { detail: { id: null } }));
          }}
        >
          <div
            data-thread-id={idToUse}
            key={idToUse}
            className={cn(
              'hover:bg-offsetLight hover:bg-primary/5 group relative mx-1 flex cursor-pointer flex-col items-start rounded-lg py-2 text-left text-sm transition-all hover:opacity-100',
              (isMailSelected || isMailBulkSelected || isKeyboardFocused) &&
                'border-border bg-primary/5 opacity-100',
              isKeyboardFocused && 'ring-primary/50',
              'relative',
              'group',
            )}
          >
            <div
              className={cn(
                'dark:bg-panelDark absolute right-2 z-[25] flex -translate-y-1/2 items-center gap-1 rounded-xl border bg-white p-1 opacity-0 shadow-sm group-hover:opacity-100',
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
                        displayStarred
                          ? 'fill-yellow-400 stroke-yellow-400'
                          : 'fill-transparent stroke-[#9D9D9D] dark:stroke-[#9D9D9D]',
                      )}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="mb-1 bg-white dark:bg-[#1A1A1A]">
                  {displayStarred
                    ? t('common.threadDisplay.unstar')
                    : t('common.threadDisplay.star')}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 [&_svg]:size-3.5"
                    onClick={handleToggleImportant}
                  >
                    <ExclamationCircle className={cn(displayImportant ? '' : 'opacity-25')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="dark:bg-panelDark mb-1 bg-white">
                  {t('common.mail.toggleImportant')}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 [&_svg]:size-3.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveThreadTo('archive');
                    }}
                  >
                    <Archive2 className="fill-[#9D9D9D]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="dark:bg-panelDark mb-1 bg-white">
                  {t('common.threadDisplay.archive')}
                </TooltipContent>
              </Tooltip>
              {!isFolderBin ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-[#FDE4E9] dark:hover:bg-[#411D23] [&_svg]:size-3.5"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        moveThreadTo('bin');
                      }}
                    >
                      <Trash className="fill-[#F43F5E]" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="dark:bg-panelDark mb-1 bg-white">
                    {t('common.actions.Bin')}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>

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
                      setMail((prev: Config) => ({
                        ...prev,
                        bulkSelected: prev.bulkSelected.filter((id: string) => id !== idToUse),
                      }));
                    }}
                  >
                    <Check className="h-4 w-4 text-white" />
                  </div>
                  {isGroupThread ? (
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-[#FFFFFF] p-2 dark:bg-[#373737]">
                      <GroupPeople className="h-4 w-4" />
                    </div>
                  ) : (
                    <>
                      <AvatarImage
                        className="rounded-full bg-[#FFFFFF] dark:bg-[#373737]"
                        src={getEmailLogo(latestMessage.sender.email)}
                      />
                      <AvatarFallback className="rounded-full bg-[#FFFFFF] font-bold text-[#9F9F9F] dark:bg-[#373737]">
                        {cleanName[0]?.toUpperCase()}
                      </AvatarFallback>
                    </>
                  )}
                </Avatar>
                <div className="z-1 relative">
                  {displayUnread && !isMailSelected && !isFolderSent ? (
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
                          displayUnread && !isMailSelected ? 'font-bold' : 'font-medium',
                          'text-md flex items-baseline gap-1 group-hover:opacity-100',
                        )}
                      >
                        {isFolderSent ? (
                          <span
                            className={cn(
                              'overflow-hidden truncate text-sm md:max-w-[15ch] xl:max-w-[25ch]',
                            )}
                          >
                            {highlightText(latestMessage.subject, searchValue.highlight)}
                          </span>
                        ) : (
                          <span className={cn('line-clamp-1 overflow-hidden text-sm')}>
                            {highlightText(
                              cleanNameDisplay(latestMessage.sender.name) || '',
                              searchValue.highlight,
                            )}
                          </span>
                        )}{' '}
                        {/* {!isFolderSent ? (
                          <span className="hidden items-center space-x-2 md:flex">
                            <RenderLabels labels={threadLabels} />
                          </span>
                        ) : null} */}
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
                      <MailLabels labels={optimisticLabels} />
                    </div>
                    {latestMessage.receivedOn ? (
                      <p
                        className={cn(
                          'text-muted-foreground text-nowrap text-xs font-normal opacity-70 transition-opacity group-hover:opacity-100 dark:text-[#8C8C8C]',
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
                          'mt-1 line-clamp-1 max-w-[50ch] overflow-hidden text-sm text-[#8C8C8C] md:max-w-[25ch]',
                        )}
                      >
                        {latestMessage.to.map((e) => e.email).join(', ')}
                      </p>
                    ) : (
                      <p
                        className={cn(
                          'mt-1 line-clamp-1 w-[95%] min-w-0 overflow-hidden text-sm text-[#8C8C8C]',
                        )}
                      >
                        {highlightText(latestMessage.subject, searchValue.highlight)}
                      </p>
                    )}
                    {/* <div className="hidden md:flex">
                      {getThreadData.labels ? <MailLabels labels={getThreadData.labels} /> : null}
                    </div> */}
                    {threadLabels && (
                      <div className="mr-0 flex w-fit items-center justify-end gap-1">
                        {!isFolderSent ? <RenderLabels labels={threadLabels} /> : null}
                        {/* {getThreadData.labels ? <MailLabels labels={getThreadData.labels} /> : null} */}
                      </div>
                    )}
                  </div>
                  {emailContent && (
                    <div className="text-muted-foreground mt-2 line-clamp-2 text-xs">
                      {highlightText(emailContent, searchValue.highlight)}
                    </div>
                  )}
                  {/* {mainSearchTerm && (
                    <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                      <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5">
                        {mainSearchTerm}
                      </span>
                    </div>
                  )} */}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null;

    return latestMessage ? (
      <AnimatePresence mode="sync">
        {!optimisticState.shouldHide && (
          <motion.div
            key={message.id}
            initial={{ opacity: 1, height: 'auto' }}
            exit={{
              opacity: 0,
              height: 0,
              marginTop: 0,
              marginBottom: 0,
              overflow: 'hidden',
              transition: { duration: 0.3, ease: 'easeInOut' },
            }}
            layout
          >
            {idToUse ? (
              <ThreadContextMenu
                threadId={idToUse}
                isInbox={isFolderInbox}
                isSpam={isFolderSpam}
                isSent={isFolderSent}
                isBin={isFolderBin}
              >
                {content}
              </ThreadContextMenu>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    ) : null;
  },
  (prev, next) => {
    const isSameMessage =
      prev.message.id === next.message.id &&
      prev.isKeyboardFocused === next.isKeyboardFocused &&
      prev.index === next.index &&
      Object.is(prev.onClick, next.onClick);
    return isSameMessage;
  },
);

const Draft = memo(({ message }: { message: { id: string } }) => {
  const { data: draft } = useDraft(message.id);
  const [, setComposeOpen] = useQueryState('isComposeOpen');
  const [, setDraftId] = useQueryState('draftId');
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
                    'mt-1 line-clamp-1 max-w-[50ch] text-sm text-[#8C8C8C] md:max-w-[30ch]',
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

export const MailList = memo(
  function MailList() {
    const { folder } = useParams<{ folder: string }>();
    const t = useTranslations();
    const [, setThreadId] = useQueryState('threadId');
    const [, setDraftId] = useQueryState('draftId');
    const [category, setCategory] = useQueryState('category');
    const [searchValue, setSearchValue] = useSearchValue();
    const { enableScope, disableScope } = useHotkeysContext();
    const [{ refetch, isLoading, isFetching, isFetchingNextPage, hasNextPage }, items, , loadMore] =
      useThreads();
    const trpc = useTRPC();
    const isFetchingMail = useIsFetching({ queryKey: trpc.mail.get.queryKey() }) > 0;

    const allCategories = Categories();

    // Skip category filtering for drafts, spam, sent, archive, and bin pages
    const shouldFilter = !['draft', 'spam', 'sent', 'archive', 'bin'].includes(folder || '');

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
    const vListRef = useRef<VListHandle>(null);

    const handleNavigateToThread = useCallback(
      (threadId: string) => {
        setThreadId(threadId);
        // Prevent default navigation
        return false;
      },
      [setThreadId],
    );

    const { focusedIndex, handleMouseEnter, keyboardActive } = useMailNavigation({
      items,
      containerRef: parentRef,
      onNavigate: handleNavigateToThread,
    });

    const isKeyPressed = useKeyState();

    const getSelectMode = useCallback((): MailSelectMode => {
      const isAltPressed =
        isKeyPressed('Alt') || isKeyPressed('AltLeft') || isKeyPressed('AltRight');

      const isShiftPressed =
        isKeyPressed('Shift') || isKeyPressed('ShiftLeft') || isKeyPressed('ShiftRight');

      if (isKeyPressed('Control') || isKeyPressed('Meta')) {
        return 'mass';
      }

      if (isAltPressed && isShiftPressed) {
        console.log('Select All Below mode activated'); // Debug log
        return 'selectAllBelow';
      }

      if (isShiftPressed) {
        return 'range';
      }

      return 'single';
    }, [isKeyPressed]);

    const [, setActiveReplyId] = useQueryState('activeReplyId');
    const [mail, setMail] = useMail();

    const handleSelectMail = useCallback(
      (message: ParsedMessage) => {
        const itemId = message.threadId ?? message.id;
        const currentMode = getSelectMode();
        console.log('Selection mode:', currentMode, 'for item:', itemId);

        switch (currentMode) {
          case 'mass': {
            const newSelected = mail.bulkSelected.includes(itemId)
              ? mail.bulkSelected.filter((id) => id !== itemId)
              : [...mail.bulkSelected, itemId];
            console.log('Mass selection mode - selected items:', newSelected.length);
            return setMail({ ...mail, bulkSelected: newSelected });
          }
          case 'selectAllBelow': {
            const clickedIndex = items.findIndex((item) => item.id === itemId);
            console.log(
              'SelectAllBelow - clicked index:',
              clickedIndex,
              'total items:',
              items.length,
            );

            if (clickedIndex !== -1) {
              const itemsBelow = items.slice(clickedIndex);
              const idsBelow = itemsBelow.map((item) => item.id);
              console.log('Selecting all items below - count:', idsBelow.length);
              return setMail({ ...mail, bulkSelected: idsBelow });
            }
            console.log('Item not found in list, selecting just this item');
            return setMail({ ...mail, bulkSelected: [itemId] });
          }
          case 'range': {
            console.log('Range selection mode - not fully implemented');
            return setMail({ ...mail, bulkSelected: [itemId] });
          }
          default: {
            console.log('Single selection mode');
            return setMail({ ...mail, bulkSelected: [itemId] });
          }
        }
      },
      [mail, setMail, getSelectMode, items],
    );

    const [, setFocusedIndex] = useAtom(focusedIndexAtom);

    const handleMailClick = useCallback(
      (message: ParsedMessage) => () => {
        const mode = getSelectMode();
        console.log('Mail click with mode:', mode);

        if (mode !== 'single') {
          return handleSelectMail(message);
        }

        handleMouseEnter(message.id);

        const messageThreadId = message.threadId ?? message.id;
        const clickedIndex = items.findIndex((item) => item.id === messageThreadId);
        setFocusedIndex(clickedIndex);

        void setThreadId(messageThreadId);
        void setDraftId(null);
        void setActiveReplyId(null);
      },
      [mail, items, setFocusedIndex, getSelectMode, handleSelectMail],
    );

    const isFiltering = searchValue.value.trim().length > 0;

    useEffect(() => {
      if (isFiltering && !isLoading) {
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

    const filteredItems = useMemo(() => items.filter((item) => item.id), [items]);

    const Comp = folder === FOLDERS.DRAFT ? Draft : Thread;

    const vListRenderer = useCallback(
      (index: number) => {
        const item = filteredItems[index];
        return (
          <>
            <Comp
              key={item.id}
              message={item}
              isKeyboardFocused={focusedIndex === index && keyboardActive}
              index={index}
              onClick={handleMailClick}
            />
            {index === filteredItems.length - 1 && (isFetchingNextPage || isFetchingMail) ? (
              <div className="flex w-full justify-center py-4">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
              </div>
            ) : null}
          </>
        );
      },
      [
        filteredItems,
        focusedIndex,
        keyboardActive,
        handleMailClick,
        isLoading,
        isFetching,
        hasNextPage,
        t,
      ],
    );

    return (
      <>
        <div
          ref={parentRef}
          className={cn(
            'hide-link-indicator flex h-full w-full',
            getSelectMode() === 'range' && 'select-none',
          )}
          onMouseEnter={() => {
            enableScope('mail-list');
          }}
          onMouseLeave={() => {
            disableScope('mail-list');
          }}
        >
          <>
            {isLoading ? (
              <div className="flex h-32 w-full items-center justify-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
              </div>
            ) : !items || items.length === 0 ? (
              <div className="flex w-full items-center justify-center">
                <div className="flex flex-col items-center justify-center gap-2 text-center">
                  <img
                    suppressHydrationWarning
                    src={resolvedTheme === 'dark' ? '/empty-state.svg' : '/empty-state-light.svg'}
                    alt="Empty Inbox"
                    width={200}
                    height={200}
                  />
                  <div className="mt-5">
                    <p className="text-lg">It's empty here</p>
                    <p className="text-md text-muted-foreground dark:text-white/50">
                      Search for another email or{' '}
                      <button className="underline" onClick={clearFilters}>
                        clear filters
                      </button>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col" id="mail-list-scroll">
                <VList
                  ref={vListRef}
                  count={filteredItems.length}
                  overscan={5}
                  className="style-scrollbar flex-1 overflow-x-hidden"
                  children={vListRenderer}
                  onScroll={() => {
                    if (!vListRef.current) return;
                    const endIndex = vListRef.current.findEndIndex();
                    if (
                      // if the shown items are last 2 items, load more
                      Math.abs(filteredItems.length - 1 - endIndex) < 1 &&
                      !isLoading &&
                      !isFetchingNextPage &&
                      !isFetchingMail &&
                      hasNextPage
                    ) {
                      void loadMore();
                    }
                  }}
                />
              </div>
            )}
          </>
        </div>
        <div className="w-full pt-4 text-center">
          {isFetching ? (
            <div className="text-center">
              <div className="mx-auto h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
            </div>
          ) : (
            <div className="h-4" />
          )}
        </div>
      </>
    );
  },
  () => true,
);

export const MailLabels = memo(
  function MailListLabels({ labels }: { labels: { id: string; name: string }[] }) {
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
          const content = getLabelIcon(label.name);

          return content ? (
            <Badge key={label.id} className="rounded-md p-1" variant={style}>
              {content}
            </Badge>
          ) : null;
        })}
      </div>
    );
  },
  (prev, next) => {
    return JSON.stringify(prev.labels) === JSON.stringify(next.labels);
  },
);

function getNormalizedLabelKey(label: string) {
  return label.toLowerCase().replace(/^category_/i, '');
}

function capitalize(str: string) {
  return str.substring(0, 1).toUpperCase() + str.substring(1).toLowerCase();
}

function getLabelIcon(label: string) {
  const normalizedLabel = label.toLowerCase().replace(/^category_/i, '');

  switch (normalizedLabel) {
    case 'starred':
      return <Star className="h-3.5 w-3.5 fill-yellow-400 stroke-yellow-400" />;
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
  const match = name.match(/^[^\p{L}\p{N}.]*(.*?)[^\p{L}\p{N}.]*$/u);
  return match ? match[1] : name;
};
