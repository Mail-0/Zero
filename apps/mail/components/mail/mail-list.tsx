import {
  Archive2,
  ExclamationCircle,
  GroupPeople,
  Star2,
  Trash,
  PencilCompose,
} from '../icons/icons';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import { ThreadListContextMenu, threadListFetchingAtom } from '@/components/context/thread-context';
import { useThreadPrefetch, useThreadRowData, useThreads } from '@/hooks/use-threads';
import type { ThreadListSummary } from '../../../server/src/lib/thread-list-summary';
import { useOptimisticThreadState } from '@/components/mail/optimistic-thread-state';
import { focusedIndexAtom, useMailNavigation } from '@/hooks/use-mail-navigation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { MailSelectMode, ParsedMessage, ThreadProps } from '@/types';
import type { ParsedDraft } from '../../../server/src/lib/driver/types';
import { useOptimisticActions } from '@/hooks/use-optimistic-actions';
import { cn, FOLDERS, formatDate, formatListDate } from '@/lib/utils';
import { type ThreadDestination } from '@/lib/thread-actions';
import type { UseQueryResult } from '@tanstack/react-query';
import { useSearchValue } from '@/hooks/use-search-value';
import { EmptyStateIcon } from '../icons/empty-state-svg';
import { highlightText } from '@/lib/email-utils.client';
import { useMail } from '@/components/mail/use-mail';
import { markThreadOpenStart } from '@/lib/perf';
import { Avatar } from '../ui/avatar';

import { useLabels } from '@/hooks/use-labels';

import { useMediaQuery } from '@/hooks/use-media-query';
import { useSettings } from '@/hooks/use-settings';

import { useKeyState } from '@/hooks/use-hot-key';
import { VList, type VListHandle } from 'virtua';
import { BimiAvatar } from '../ui/bimi-avatar';
import { RenderLabels } from './render-labels';
import { Badge } from '@/components/ui/badge';
import { useDraft } from '@/hooks/use-drafts';
import { Check, Star } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

import { m } from '@/paraglide/messages';
import { useParams } from 'react-router';

import { buildCategorySearchValue, parseCategoryIds } from '@/hooks/use-categories';
import { useAtom, useSetAtom } from 'jotai';
import { useMailCategories } from './mail';
import { Button } from '../ui/button';
import { useQueryState } from 'nuqs';

/**
 * Stable callbacks shared by every row. Kept on a single object whose identity never
 * changes so row memoization isn't defeated; implementations read latest state via refs.
 */
export type ThreadRowActions = {
  toggleStar: (threadId: string, starred: boolean) => void;
  toggleImportant: (threadId: string, important: boolean) => void;
  moveTo: (threadId: string, destination: ThreadDestination) => void;
  toggleBulkSelected: (threadId: string) => void;
  /** Warm the thread + latest body on open intent (hover / press). */
  prefetch: (threadId: string) => void;
};

/** Folder-derived flags, computed once by the list (rows must not subscribe to the router). */
export type ThreadFolderFlags = {
  isFolderInbox: boolean;
  isFolderSpam: boolean;
  isFolderSent: boolean;
  isFolderBin: boolean;
};

type UserLabels = ReturnType<typeof useLabels>['userLabels'];

/** A listThreads item: id plus the body-free row summary the server attached to it. */
type ThreadListItem = { id: string; historyId?: string | null; summary?: ThreadListSummary | null };

type ThreadRowProps = Omit<ThreadProps, 'message'> & {
  message: ThreadListItem;
  index?: number;
  /** Row is the thread open in ThreadDisplay. Computed by the list so rows don't subscribe to URL state. */
  isSelected?: boolean;
  isBulkSelected?: boolean;
  actions: ThreadRowActions;
  folderFlags: ThreadFolderFlags;
  highlight: string;
  isDesktop: boolean;
  userLabels: UserLabels;
};

/** Hover intent before warming a thread; skips rows the pointer only passes over. */
const PREFETCH_HOVER_DELAY_MS = 120;

/**
 * Placeholder with the real row's height. A row that rendered nothing while loading would
 * measure 0px, letting the virtualizer mount every unloaded row at once and then jump as
 * they filled in.
 */
const ThreadRowSkeleton = ({ isDesktop }: { isDesktop: boolean }) =>
  isDesktop ? (
    <div className="my-1 select-none" aria-hidden>
      <div className="mx-1 flex min-h-10 items-center gap-4 rounded-lg px-4 py-2">
        <Skeleton className="size-2 shrink-0 rounded" />
        <Skeleton className="h-4 w-28 shrink-0 lg:w-40" />
        <Skeleton className="h-5 w-5 shrink-0 rounded" />
        <Skeleton className="h-4 max-w-[400px] flex-1" />
      </div>
    </div>
  ) : (
    <div className="border-b select-none" aria-hidden>
      <div className="mx-1 flex items-center gap-4 px-4 py-2">
        <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-1 h-5 w-48" />
        </div>
      </div>
    </div>
  );

/** Star / important / archive / bin bar. Mounted only while the row is hovered. */
const ThreadHoverActions = memo(function ThreadHoverActions({
  index,
  displayStarred,
  displayImportant,
  isFolderBin,
  onToggleStar,
  onToggleImportant,
  onMove,
}: {
  index?: number;
  displayStarred: boolean;
  displayImportant: boolean;
  isFolderBin: boolean;
  onToggleStar: (e: React.MouseEvent) => void;
  onToggleImportant: (e: React.MouseEvent) => void;
  onMove: (destination: ThreadDestination) => void;
}) {
  const side = index === 0 ? 'bottom' : 'top';
  return (
    <div
      className={cn(
        'dark:bg-panelDark absolute right-2 z-25 flex -translate-y-1/2 items-center gap-1 rounded-xl border bg-white p-1 opacity-0 shadow-sm group-hover:opacity-100',
        index === 0 ? 'top-4' : 'top-[-1]',
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 overflow-visible [&_svg]:size-3.5"
            onClick={onToggleStar}
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
        <TooltipContent side={side} className="mb-1 bg-white dark:bg-[#1A1A1A]">
          {displayStarred ? m['common.threadDisplay.unstar']() : m['common.threadDisplay.star']()}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-6 w-6 [&_svg]:size-3.5',
              displayImportant ? 'hover:bg-orange-200/70 dark:hover:bg-orange-800/40' : '',
            )}
            onClick={onToggleImportant}
          >
            <ExclamationCircle
              className={cn(displayImportant ? 'fill-orange-400' : 'fill-[#9D9D9D]')}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side={side} className="dark:bg-panelDark mb-1 bg-white">
          {m['common.mail.toggleImportant']()}
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
              onMove('archive');
            }}
          >
            <Archive2 className="fill-[#9D9D9D]" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side={side} className="dark:bg-panelDark mb-1 bg-white">
          {m['common.threadDisplay.archive']()}
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
                onMove('bin');
              }}
            >
              <Trash className="fill-[#F43F5E]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={side} className="dark:bg-panelDark mb-1 bg-white">
            {m['common.actions.Bin']()}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
});

/*
 * Perf: a row re-renders only when its own props, row data, optimistic state or hover state
 * change. Do NOT add useQueryState / useParams / useSearchValue / useThreads / useMail /
 * focusedIndexAtom / useOptimisticActions / useLabels here – each of those re-renders every
 * mounted row on any URL change, click, or optimistic action. Pass what's needed as props.
 */
const Thread = memo(
  function Thread({
    message,
    onClick,
    isKeyboardFocused,
    index,
    isSelected: isMailSelected = false,
    isBulkSelected: isMailBulkSelected = false,
    actions,
    folderFlags,
    highlight,
    isDesktop,
    userLabels,
  }: ThreadRowProps) {
    const { isFolderSent, isFolderBin } = folderFlags;
    const rowData = useThreadRowData(message.id, message.summary);
    const [hovered, setHovered] = useState(false);
    const prefetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { latestMessage, idToUse, cleanName } = useMemo(() => {
      const latestMessage = rowData?.latest;
      const idToUse = latestMessage?.threadId ?? latestMessage?.id;
      const cleanName = latestMessage?.sender?.name
        ? latestMessage.sender.name.trim().replace(/^['"]|['"]$/g, '')
        : '';

      return { latestMessage, idToUse, cleanName };
    }, [rowData?.latest]);

    const optimisticState = useOptimisticThreadState(idToUse ?? message.id);

    const { displayStarred, displayImportant, displayUnread, optimisticLabels } = useMemo(() => {
      const displayStarred =
        optimisticState.optimisticStarred !== null
          ? optimisticState.optimisticStarred
          : (rowData?.labels?.some((tag) => tag.id === 'STARRED') ?? false);

      const displayImportant =
        optimisticState.optimisticImportant !== null
          ? optimisticState.optimisticImportant
          : (rowData?.latest?.tags?.some((tag) => tag.name === 'IMPORTANT') ?? false);

      const displayUnread =
        optimisticState.optimisticRead !== null
          ? !optimisticState.optimisticRead
          : (rowData?.hasUnread ?? false);

      let labels: { id: string; name: string }[] = [];
      if (rowData?.labels) {
        labels = [...rowData.labels];
        const hasStarredLabel = labels.some((label) => label.name === 'STARRED');

        if (optimisticState.optimisticStarred !== null) {
          if (optimisticState.optimisticStarred && !hasStarredLabel) {
            labels.push({ id: 'starred-optimistic', name: 'STARRED' });
          } else if (!optimisticState.optimisticStarred && hasStarredLabel) {
            labels = labels.filter((label) => label.name !== 'STARRED');
          }
        }

        if (optimisticState.optimisticLabels) {
          labels = labels.filter(
            (label) => !optimisticState.optimisticLabels.removedLabelIds.includes(label.id),
          );

          optimisticState.optimisticLabels.addedLabelIds.forEach((labelId) => {
            if (!labels.some((label) => label.id === labelId)) {
              labels.push({ id: labelId, name: labelId });
            }
          });
        }
      }

      return { displayStarred, displayImportant, displayUnread, optimisticLabels: labels };
    }, [
      optimisticState.optimisticStarred,
      optimisticState.optimisticImportant,
      optimisticState.optimisticRead,
      optimisticState.optimisticLabels,
      rowData?.latest?.tags,
      rowData?.hasUnread,
      rowData?.labels,
    ]);

    const threadLabels = useMemo(() => {
      if (!userLabels?.length || !optimisticLabels.length) return EMPTY_LABELS;
      const ids = new Set(optimisticLabels.map((label) => label.id));
      const matched = userLabels.filter((label) => (label.id ? ids.has(label.id) : false));
      return matched.length ? matched : EMPTY_LABELS;
    }, [userLabels, optimisticLabels]);

    const handleToggleStar = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!rowData || !idToUse) return;
        actions.toggleStar(idToUse, !displayStarred);
      },
      [rowData, idToUse, displayStarred, actions],
    );

    const handleToggleImportant = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!rowData || !idToUse) return;
        actions.toggleImportant(idToUse, !displayImportant);
      },
      [rowData, idToUse, displayImportant, actions],
    );

    const moveThreadTo = useCallback(
      (destination: ThreadDestination) => {
        if (!idToUse) return;
        actions.moveTo(idToUse, destination);
      },
      [idToUse, actions],
    );

    const clearPrefetchTimer = useCallback(() => {
      if (prefetchTimer.current) clearTimeout(prefetchTimer.current);
      prefetchTimer.current = null;
    }, []);
    useEffect(() => clearPrefetchTimer, [clearPrefetchTimer]);

    const handleMouseEnter = useCallback(() => {
      setHovered(true);
      window.dispatchEvent(new CustomEvent('emailHover', { detail: { id: idToUse } }));
      if (!idToUse) return;
      clearPrefetchTimer();
      prefetchTimer.current = setTimeout(() => actions.prefetch(idToUse), PREFETCH_HOVER_DELAY_MS);
    }, [idToUse, actions, clearPrefetchTimer]);

    const handleMouseLeave = useCallback(() => {
      setHovered(false);
      clearPrefetchTimer();
      window.dispatchEvent(new CustomEvent('emailHover', { detail: { id: null } }));
    }, [clearPrefetchTimer]);

    // Touch has no hover: start warming on press, ahead of the click.
    const handlePointerDown = useCallback(() => {
      if (idToUse) actions.prefetch(idToUse);
    }, [idToUse, actions]);

    const body = useMemo(() => {
      if (!latestMessage || !rowData) return null;

      const senderText = isFolderSent
        ? latestMessage.to.map((person) => person.name || person.email).join(', ')
        : cleanName || latestMessage.sender.email;
      const date = latestMessage.receivedOn
        ? formatListDate(latestMessage.receivedOn.split('.')[0] || '')
        : null;

      if (isDesktop) {
        return (
          <div
            className={cn(
              'flex min-h-10 w-full items-center gap-4 px-4',
              !displayUnread && 'opacity-70',
            )}
          >
            <button
              aria-label={isMailBulkSelected ? 'Deselect email' : 'Select email'}
              aria-pressed={isMailBulkSelected}
              className="flex h-5 w-5 shrink-0 items-center justify-center"
              onClick={(event) => {
                event.stopPropagation();
                if (!idToUse) return;
                actions.toggleBulkSelected(idToUse);
              }}
            >
              {isMailBulkSelected ? (
                <Check className="h-3.5 w-3.5 rounded bg-blue-500 text-white" />
              ) : (
                <span
                  className={cn(
                    'size-2 rounded',
                    displayUnread && !isFolderSent
                      ? 'bg-[#006FFE]'
                      : 'bg-black/30 dark:bg-[#2C2C2C]',
                  )}
                />
              )}
            </button>
            <span
              className={cn(
                'w-28 shrink-0 truncate text-sm lg:w-40',
                displayUnread ? 'font-semibold' : 'font-medium',
              )}
            >
              {highlightText(senderText, highlight)}
            </span>
            {rowData.isGroupThread ? (
              <GroupPeople className="h-5 w-5 shrink-0" />
            ) : (
              <BimiAvatar
                email={latestMessage.sender.email}
                name={cleanName || latestMessage.sender.email}
                className="h-5 w-5 shrink-0 rounded"
              />
            )}
            <div className="bg-border h-4 w-px shrink-0" />
            <div className="flex min-w-0 flex-1 items-center gap-2 lg:max-w-[400px]">
              <span className={cn('truncate text-sm', displayUnread && 'font-medium')}>
                {highlightText(latestMessage.subject, highlight)}
              </span>
              {rowData.totalReplies > 1 && (
                <span className="text-muted-foreground shrink-0 text-xs">
                  {rowData.totalReplies}
                </span>
              )}
              {rowData.hasDraft && (
                <PencilCompose aria-label="Draft" className="h-3 w-3 shrink-0 fill-blue-500" />
              )}
              <MailLabels labels={optimisticLabels} />
            </div>
            <div className="bg-border hidden h-4 w-px shrink-0 lg:block" />
            <span className="text-muted-foreground hidden min-w-0 flex-1 truncate text-sm lg:block">
              {highlightText(latestMessage.title || '', highlight)}
            </span>
            {!isFolderSent && threadLabels.length > 0 && <RenderLabels labels={threadLabels} />}
            {date !== null && (
              <time className="text-muted-foreground shrink-0 text-xs">{date}</time>
            )}
          </div>
        );
      }

      const avatarBorder = displayUnread && !isMailSelected && !isFolderSent ? '' : 'border';

      return (
        <div
          className={cn(
            'relative flex w-full items-center justify-between gap-4 px-4',
            !displayUnread && 'opacity-60',
          )}
        >
          <div>
            {isMailBulkSelected ? (
              <Avatar className={cn('h-8 w-8 rounded-full', avatarBorder)}>
                <div
                  className="flex h-full w-full items-center justify-center rounded-full bg-[#006FFE] p-2 dark:bg-[#006FFE]"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (idToUse) actions.toggleBulkSelected(idToUse);
                  }}
                >
                  <Check className="h-4 w-4 text-white" />
                </div>
              </Avatar>
            ) : rowData.isGroupThread ? (
              <Avatar className={cn('h-8 w-8 rounded-full', avatarBorder)}>
                <div className="flex h-full w-full items-center justify-center rounded-full bg-[#FFFFFF] p-2 dark:bg-[#373737]">
                  <GroupPeople className="h-4 w-4" />
                </div>
              </Avatar>
            ) : (
              <BimiAvatar
                email={latestMessage.sender.email}
                name={cleanName || latestMessage.sender.email}
                className={cn('h-8 w-8 rounded-full', avatarBorder)}
              />
            )}
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
                      <span className="truncate overflow-hidden text-sm">
                        {highlightText(latestMessage.subject, highlight)}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="line-clamp-1 overflow-hidden text-sm">
                          {highlightText(
                            cleanNameDisplay(latestMessage.sender.name) || '',
                            highlight,
                          )}
                        </span>
                        {displayUnread && !isMailSelected ? (
                          <span className="ml-0.5 size-2 rounded-full bg-[#006FFE]" />
                        ) : null}
                      </div>
                    )}{' '}
                  </span>
                  {rowData.totalReplies > 1 ? (
                    <span
                      className="rounded-md text-xs opacity-70"
                      title={m['common.mail.replies']({ count: rowData.totalReplies })}
                    >
                      [{rowData.totalReplies}]
                    </span>
                  ) : null}
                  {rowData.hasDraft ? (
                    <span className="inline-flex items-center" title="Draft">
                      <PencilCompose
                        aria-label="Draft"
                        className="h-3 w-3 fill-blue-500 dark:fill-blue-400"
                      />
                    </span>
                  ) : null}
                  <MailLabels labels={optimisticLabels} />
                </div>
                {date !== null ? (
                  <p
                    className={cn(
                      'text-muted-foreground text-xs font-normal text-nowrap opacity-70 transition-opacity group-hover:opacity-100 dark:text-[#8C8C8C]',
                      isMailSelected && 'opacity-100',
                    )}
                  >
                    {date}
                  </p>
                ) : null}
              </div>
              <div className="flex justify-between">
                {isFolderSent ? (
                  <p className="mt-1 line-clamp-1 max-w-[50ch] overflow-hidden text-sm text-[#8C8C8C]">
                    {latestMessage.to.map((e) => e.email).join(', ')}
                  </p>
                ) : (
                  <p className="mt-1 line-clamp-1 w-[95%] min-w-0 overflow-hidden text-sm text-[#8C8C8C]">
                    {highlightText(latestMessage.subject, highlight)}
                  </p>
                )}
                {threadLabels.length > 0 && !isFolderSent ? (
                  <div className="mr-0 flex w-fit items-center justify-end gap-1">
                    <RenderLabels labels={threadLabels} />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      );
    }, [
      latestMessage,
      rowData,
      idToUse,
      isFolderSent,
      highlight,
      displayUnread,
      isMailSelected,
      isMailBulkSelected,
      threadLabels,
      optimisticLabels,
      cleanName,
      actions,
      isDesktop,
    ]);

    if (!rowData) return <ThreadRowSkeleton isDesktop={isDesktop} />;
    if (!latestMessage || optimisticState.shouldHide || !idToUse) return null;

    return (
      <div
        className={cn('select-none', isDesktop ? 'my-1' : 'border-b')}
        onClick={onClick ? onClick(latestMessage) : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onPointerDown={handlePointerDown}
      >
        <div
          data-thread-id={idToUse}
          className={cn(
            'hover:bg-offsetLight hover:bg-primary/5 group relative mx-1 flex cursor-pointer flex-col items-start rounded-lg py-2 text-left text-sm transition-all hover:opacity-100',
            (isMailSelected || isMailBulkSelected || isKeyboardFocused) &&
              'border-border bg-primary/5 opacity-100',
            isKeyboardFocused && 'ring-primary/50',
          )}
        >
          {hovered ? (
            <ThreadHoverActions
              index={index}
              displayStarred={displayStarred}
              displayImportant={displayImportant}
              isFolderBin={isFolderBin}
              onToggleStar={handleToggleStar}
              onToggleImportant={handleToggleImportant}
              onMove={moveThreadTo}
            />
          ) : null}
          {body}
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.message === next.message &&
    prev.isKeyboardFocused === next.isKeyboardFocused &&
    prev.isSelected === next.isSelected &&
    prev.isBulkSelected === next.isBulkSelected &&
    prev.index === next.index &&
    prev.actions === next.actions &&
    prev.folderFlags === next.folderFlags &&
    prev.highlight === next.highlight &&
    prev.isDesktop === next.isDesktop &&
    prev.userLabels === next.userLabels &&
    Object.is(prev.onClick, next.onClick),
);

const EMPTY_LABELS: UserLabels = [];

const Draft = memo(function Draft({ message }: { message: { id: string } }) {
  const draftQuery = useDraft(message.id) as UseQueryResult<ParsedDraft>;
  const draft = draftQuery.data;
  const [, setComposeOpen] = useQueryState('isComposeOpen');
  const [, setDraftId] = useQueryState('draftId');
  const handleMailClick = useCallback(() => {
    setComposeOpen('true');
    setDraftId(message.id);
    return;
  }, [message.id]);

  if (!draft) {
    return (
      <div className="py-1 select-none">
        <div
          key={message.id}
          className={cn(
            'group relative mx-[8px] flex cursor-pointer flex-col items-start overflow-clip rounded-[10px] border-transparent py-3 text-left text-sm transition-all',
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
                    <Skeleton className="bg-muted h-4 w-32 rounded" />
                  </div>
                </div>
                <div className="flex justify-between">
                  <Skeleton className="bg-muted mt-1 h-4 w-48 rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-1 select-none" onClick={handleMailClick}>
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
                      {cleanNameDisplay(draft?.to?.[0] || 'No Recipient') || ''}
                    </span>
                  </span>
                </div>
                {draft.rawMessage?.internalDate && (
                  <p
                    className={cn(
                      'text-muted-foreground text-xs font-normal text-nowrap opacity-70 transition-opacity group-hover:opacity-100 dark:text-[#8C8C8C]',
                    )}
                  >
                    {formatDate(Number(draft.rawMessage?.internalDate))}
                  </p>
                )}
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

/**
 * Start loading the next page while at least a page (20) of unseen rows is still below the
 * viewport, so the next page is normally in before the user reaches the end. Because the
 * check also runs after each page lands, this keeps exactly one page buffered ahead.
 */
const LOAD_MORE_THRESHOLD = 20;
/** Trim settings for deep lists (see handleScrollEnd): ~20 threads per page. */
const TRIM_PAGES_ABOVE = 4;
const TRIM_PAGES_KEEP = 2;
const TRIM_WHEN_START_INDEX_BELOW = 10;

export const MailList = memo(
  function MailList() {
    const { folder } = useParams<{ folder: string }>();
    const { data: settingsData } = useSettings();
    const [openThreadId, setThreadId] = useQueryState('threadId');
    const [, setDraftId] = useQueryState('draftId');
    const [category, setCategory] = useQueryState('category');
    const [searchValue, setSearchValue] = useSearchValue();
    const [threadsQuery, items, , loadMore, trimPages] = useThreads();
    const { isLoading, isFetching, isFetchingNextPage, hasNextPage } = threadsQuery;
    const loadedPages = threadsQuery.data?.pages.length ?? 0;
    const setThreadListFetching = useSetAtom(threadListFetchingAtom);
    // Appending a page doesn't change the rows already shown, so it must not disable the
    // context menu (the next page is now loaded ahead of the viewport almost continuously).
    const isRefreshingList = isLoading || (isFetching && !isFetchingNextPage);
    useEffect(() => {
      setThreadListFetching(isRefreshingList);
    }, [isRefreshingList, setThreadListFetching]);
    const prefetchThread = useThreadPrefetch();
    const { userLabels } = useLabels();
    const itemsRef = useRef(items);
    const parentRef = useRef<HTMLDivElement>(null);
    const vListRef = useRef<VListHandle>(null);

    useEffect(() => {
      itemsRef.current = items;
    }, [items]);

    const allCategories = useMailCategories();

    // Skip category filtering for drafts, spam, sent, archive, and bin pages
    const shouldFilter = !['draft', 'spam', 'sent', 'archive', 'bin'].includes(folder || '');

    // Set initial category search value only if not in special folders
    useEffect(() => {
      if (!shouldFilter) return;

      const selectedIds = parseCategoryIds(category);
      const initialValue = buildCategorySearchValue(
        selectedIds.length ? selectedIds : ['All Mail'],
        allCategories,
      );

      if (initialValue && searchValue.value === '') {
        setSearchValue({
          value: initialValue,
          highlight: '',
          folder: '',
        });
      }
    }, [allCategories, category, shouldFilter, searchValue.value, setSearchValue]);

    const handleNavigateToThread = useCallback(
      (threadId: string | null) => {
        markThreadOpenStart(threadId, 'keyboard');
        setThreadId(threadId);
        return;
      },
      [setThreadId],
    );

    const { focusedIndex, handleMouseEnter, keyboardActive } = useMailNavigation({
      items,
      containerRef: parentRef,
      onNavigate: handleNavigateToThread,
    });

    const isKeyPressed = useKeyState();
    const isDesktop = useMediaQuery('(min-width: 768px)');

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
    const [mailState, setMail] = useMail();

    const handleSelectMail = useCallback(
      (message: ParsedMessage) => {
        const itemId = message.threadId ?? message.id;
        const currentMode = getSelectMode();
        console.log('Selection mode:', currentMode, 'for item:', itemId);

        setMail((prevMail) => {
          const mail = prevMail;
          switch (currentMode) {
            case 'mass': {
              const newSelected = mail.bulkSelected.includes(itemId)
                ? mail.bulkSelected.filter((id) => id !== itemId)
                : [...mail.bulkSelected, itemId];
              console.log('Mass selection mode - selected items:', newSelected.length);
              return { ...mail, bulkSelected: newSelected };
            }
            case 'selectAllBelow': {
              const clickedIndex = itemsRef.current.findIndex((item) => item.id === itemId);
              console.log(
                'SelectAllBelow - clicked index:',
                clickedIndex,
                'total items:',
                itemsRef.current.length,
              );

              if (clickedIndex !== -1) {
                const itemsBelow = itemsRef.current.slice(clickedIndex);
                const idsBelow = itemsBelow.map((item) => item.id);
                console.log('Selecting all items below - count:', idsBelow.length);
                return { ...mail, bulkSelected: idsBelow };
              }
              console.log('Item not found in list, selecting just this item');
              return { ...mail, bulkSelected: [itemId] };
            }
            case 'range': {
              console.log('Range selection mode - not fully implemented');
              return { ...mail, bulkSelected: [itemId] };
            }
            default: {
              console.log('Single selection mode');
              return { ...mail, bulkSelected: [itemId] };
            }
          }
        });
      },
      [getSelectMode, setMail],
    );

    const [, setFocusedIndex] = useAtom(focusedIndexAtom);

    const optimisticActions = useOptimisticActions();
    const { optimisticMarkAsRead } = optimisticActions;
    const handleMailClick = useCallback(
      (message: ParsedMessage) => async () => {
        const mode = getSelectMode();
        const autoRead = settingsData?.settings?.autoRead ?? true;
        console.log('Mail click with mode:', mode);

        if (mode !== 'single') {
          return handleSelectMail(message);
        }

        handleMouseEnter(message.id);

        const messageThreadId = message.threadId ?? message.id;
        markThreadOpenStart(messageThreadId, 'click');
        const clickedIndex = itemsRef.current.findIndex((item) => item.id === messageThreadId);
        setFocusedIndex(clickedIndex);
        if (message.unread && autoRead) optimisticMarkAsRead([messageThreadId], true);
        setThreadId(messageThreadId);
        setDraftId(null);
        // Don't clear activeReplyId - let ThreadDisplay handle Reply All auto-opening
      },
      [
        getSelectMode,
        handleSelectMail,
        handleMouseEnter,
        setFocusedIndex,
        optimisticMarkAsRead,
        setThreadId,
        setDraftId,
        settingsData,
        setActiveReplyId,
      ],
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

    const filteredItems = useMemo(() => items.filter((item) => item.id), [items]);

    // Latest values for the stable row actions below (read at event time, not render time).
    const rowActionStateRef = useRef({
      optimisticActions,
      openThreadId,
      focusedIndex,
      folder,
      setMail,
      setThreadId,
      setFocusedIndex,
      prefetchThread,
    });
    useEffect(() => {
      rowActionStateRef.current = {
        optimisticActions,
        openThreadId,
        focusedIndex,
        folder,
        setMail,
        setThreadId,
        setFocusedIndex,
        prefetchThread,
      };
    });

    const rowActions = useMemo<ThreadRowActions>(
      () => ({
        toggleStar: (id, starred) =>
          rowActionStateRef.current.optimisticActions.optimisticToggleStar([id], starred),
        toggleImportant: (id, important) =>
          rowActionStateRef.current.optimisticActions.optimisticToggleImportant([id], important),
        moveTo: (id, destination) => {
          const s = rowActionStateRef.current;
          const threads = itemsRef.current;
          // If a thread is open, advance to the one that takes this row's place.
          if (!s.openThreadId || !threads.length || s.focusedIndex === null) {
            void s.setThreadId(null);
          } else if (s.focusedIndex < threads.length - 1) {
            const nextThread = threads[s.focusedIndex];
            if (nextThread) {
              void s.setThreadId(nextThread.id);
              s.setFocusedIndex(s.focusedIndex);
            }
          }
          s.optimisticActions.optimisticMoveThreadsTo([id], s.folder ?? '', destination);
        },
        toggleBulkSelected: (id) =>
          rowActionStateRef.current.setMail((previous) => ({
            ...previous,
            bulkSelected: previous.bulkSelected.includes(id)
              ? previous.bulkSelected.filter((selectedId) => selectedId !== id)
              : [...previous.bulkSelected, id],
          })),
        prefetch: (id) => void rowActionStateRef.current.prefetchThread(id),
      }),
      [],
    );

    const bulkSelected = useMemo(() => new Set(mailState.bulkSelected), [mailState.bulkSelected]);
    const isDraftFolder = folder === FOLDERS.DRAFT;
    const highlight = searchValue.highlight;

    const folderFlags = useMemo<ThreadFolderFlags>(
      () => ({
        isFolderInbox: folder === FOLDERS.INBOX || !folder,
        isFolderSpam: folder === FOLDERS.SPAM,
        isFolderSent: folder === FOLDERS.SENT,
        isFolderBin: folder === FOLDERS.BIN,
      }),
      [folder],
    );

    // j/k and archive-advance move to a neighbour of the open thread; warm both so the next
    // open is a cache hit (rows no longer fetch full threads just by being on screen).
    useEffect(() => {
      if (!openThreadId) return;
      const index = itemsRef.current.findIndex((item) => item.id === openThreadId);
      if (index === -1) return;
      for (const neighbour of [itemsRef.current[index + 1], itemsRef.current[index - 1]]) {
        if (neighbour?.id) void prefetchThread(neighbour.id);
      }
    }, [openThreadId, prefetchThread]);

    /**
     * Load the next page when the viewport is near the end. Runs on scroll *and* whenever the
     * list or fetch state changes: a scroll that happened while a page or refresh was in flight
     * would otherwise be dropped, and a short page that doesn't fill the viewport never scrolls.
     */
    const maybeLoadMore = useCallback(() => {
      const vList = vListRef.current;
      if (!vList || !hasNextPage || isLoading || isFetching) return;
      const endIndex = vList.findEndIndex();
      if (filteredItems.length - 1 - endIndex < LOAD_MORE_THRESHOLD) void loadMore();
    }, [filteredItems.length, hasNextPage, isLoading, isFetching, loadMore]);

    useEffect(() => {
      maybeLoadMore();
      // Again after the virtualizer has measured the viewport (0 on its first commit).
      const frame = requestAnimationFrame(maybeLoadMore);
      return () => cancelAnimationFrame(frame);
    }, [maybeLoadMore]);

    // Back near the top of a deep list: drop far pages so refreshes don't refetch them all.
    const handleScrollEnd = useCallback(() => {
      const vList = vListRef.current;
      if (!vList || loadedPages <= TRIM_PAGES_ABOVE) return;
      if (vList.findStartIndex() < TRIM_WHEN_START_INDEX_BELOW) trimPages(TRIM_PAGES_KEEP);
    }, [loadedPages, trimPages]);

    const vListRenderer = useCallback(
      (index: number) => {
        const item = filteredItems[index];
        return item ? (
          <>
            {isDraftFolder ? (
              <Draft key={item.id} message={item} />
            ) : (
              <Thread
                key={item.id}
                message={item}
                isKeyboardFocused={focusedIndex === index && keyboardActive}
                isSelected={!!openThreadId && item.id === openThreadId}
                isBulkSelected={bulkSelected.has(item.id)}
                index={index}
                onClick={handleMailClick}
                actions={rowActions}
                folderFlags={folderFlags}
                highlight={highlight}
                isDesktop={isDesktop}
                userLabels={userLabels}
              />
            )}
          </>
        ) : (
          <></>
        );
      },
      [
        isDraftFolder,
        filteredItems,
        focusedIndex,
        keyboardActive,
        openThreadId,
        bulkSelected,
        handleMailClick,
        rowActions,
        folderFlags,
        highlight,
        isDesktop,
        userLabels,
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
        >
          <>
            {isLoading ? (
              <div className="flex h-32 w-full items-center justify-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
              </div>
            ) : !items || items.length === 0 ? (
              <div className="flex w-full items-center justify-center">
                <div className="flex flex-col items-center justify-center gap-2 text-center">
                  <EmptyStateIcon width={200} height={200} />
                  <div className="mt-5">
                    <p className="text-lg">It&apos;s empty here</p>
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
                <ThreadListContextMenu
                  isInbox={folderFlags.isFolderInbox}
                  isSpam={folderFlags.isFolderSpam}
                  isSent={folderFlags.isFolderSent}
                  isBin={folderFlags.isFolderBin}
                >
                  <VList
                    ref={vListRef}
                    count={filteredItems.length}
                    // Rows are uniform and cheap to mount now; fewer offscreen rows per scroll.
                    overscan={3}
                    // Estimates match the rendered row heights so first paint doesn't re-measure/jump.
                    itemSize={isDraftFolder ? 100 : isDesktop ? 64 : 65}
                    className="scrollbar-none flex-1 overflow-x-hidden"
                    onScroll={maybeLoadMore}
                    onScrollEnd={handleScrollEnd}
                  >
                    {vListRenderer}
                  </VList>
                </ThreadListContextMenu>
              </div>
            )}
          </>
        </div>
        <div className="w-full pt-2 text-center">
          {isFetching ? (
            <div className="text-center">
              <div className="mx-auto h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
            </div>
          ) : (
            <div className="h-2" />
          )}
        </div>
      </>
    );
  },
  () => true,
);

export const MailLabels = memo(
  function MailListLabels({ labels }: { labels: { id: string; name: string }[] }) {
    if (!labels?.length) return null;

    const visibleLabels = labels.filter(
      (label) => !['unread', 'inbox'].includes(label.name.toLowerCase()),
    );

    if (!visibleLabels.length) return null;

    return (
      <div className={cn('flex items-center select-none')}>
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
                  {m['common.notes.title']()}
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
  (prev, next) =>
    prev.labels === next.labels ||
    (prev.labels.length === next.labels.length &&
      prev.labels.every(
        (label, i) => label.id === next.labels[i]?.id && label.name === next.labels[i]?.name,
      )),
);

function getLabelIcon(label: string) {
  const normalizedLabel = label.toLowerCase().replace(/^category_/i, '');

  switch (normalizedLabel) {
    case 'starred':
      return <Star className="h-[12px] w-[12px] fill-yellow-400 stroke-yellow-400" />;
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
