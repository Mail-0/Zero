'use client';

import type { InitialThread, ThreadProps, MailListProps, MailSelectMode } from '@/types';
import { EmptyState, type FolderType } from '@/components/mail/empty-state';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { cn, defaultPageSize, formatDate } from '@/lib/utils';
import { useSearchValue } from '@/hooks/use-search-value';
import { markAsRead, markAsUnread } from '@/actions/mail';
import { highlightText } from '@/lib/email-utils.client';
import { useMail } from '@/components/mail/use-mail';
import { useHotkeys } from 'react-hotkeys-hook';
import { useDrafts } from '@/hooks/use-drafts';
import { useSession } from '@/lib/auth-client';
import { ScrollArea } from '../ui/scroll-area';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

const Draft = ({ message, onClick }: ThreadProps) => {
  const [mail] = useMail();
  const [searchValue] = useSearchValue();

  const isMailSelected = message.id === mail.selected;
  const isMailBulkSelected = mail.bulkSelected.includes(message.id);

  return (
    <div className="p-1">
      <div
        onClick={onClick ? onClick(message) : undefined}
        key={message.id}
        className={cn(
          'hover:bg-offsetLight hover:bg-primary/5 group relative flex cursor-pointer flex-col items-start overflow-clip rounded-lg border border-transparent px-4 py-3 text-left text-sm transition-all hover:opacity-100',
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
                message.unread ? 'font-bold' : 'font-medium',
                'text-md flex items-baseline gap-1 group-hover:opacity-100',
              )}
            >
              <span className={cn(mail.selected && 'max-w-[120px] truncate')}>
                {highlightText(message.sender.name, searchValue.highlight)}
              </span>
            </p>
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
        <p
          className={cn(
            'mt-1 line-clamp-1 text-xs opacity-70 transition-opacity',
            mail.selected ? 'line-clamp-1' : 'line-clamp-2',
            isMailSelected && 'opacity-100',
          )}
        >
          {highlightText(message.subject, searchValue.highlight)}
        </p>
      </div>
    </div>
  );
};

export function DraftsList({ isCompact }: MailListProps) {
  const [mail, setMail] = useMail();
  const { data: session } = useSession();
  const [searchValue] = useSearchValue();
  const router = useRouter();
  const t = useTranslations();

  const {
    data: { drafts: items, nextPageToken },
    isValidating,
    isLoading,
    loadMore,
    error,
  } = useDrafts(searchValue.value, defaultPageSize);

  const parentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<VirtuosoHandle>(null);

  const handleScroll = useCallback(() => {
    if (isLoading || isValidating || !nextPageToken) return;
    console.log('Loading more items...');
    void loadMore();
  }, [isLoading, isValidating, loadMore, nextPageToken]);

  const [massSelectMode, setMassSelectMode] = useState(false);
  const [rangeSelectMode, setRangeSelectMode] = useState(false);
  const [selectAllBelowMode, setSelectAllBelowMode] = useState(false);

  const selectAll = useCallback(() => {
    // If there are already items selected, deselect them all
    if (mail.bulkSelected.length > 0) {
      setMail((prev) => ({
        ...prev,
        bulkSelected: [],
      }));
      toast.success(t('common.mail.deselectAll'));
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

  const resetSelectMode = () => {
    setMassSelectMode(false);
    setRangeSelectMode(false);
    setSelectAllBelowMode(false);
  };

  useHotkeys('Control', () => {
    resetSelectMode();
    setMassSelectMode(true);
  });

  useHotkeys('Meta', () => {
    resetSelectMode();
    setMassSelectMode(true);
  });

  useHotkeys('Shift', () => {
    resetSelectMode();
    setRangeSelectMode(true);
  });

  useHotkeys('Alt+Shift', () => {
    resetSelectMode();
    setSelectAllBelowMode(true);
  });

  useHotkeys('Meta+Shift+u', async () => {
    resetSelectMode();
    const res = await markAsUnread({ ids: mail.bulkSelected });
    if (res.success) {
      toast.success(t('common.mail.markedAsUnread'));
      setMail((prev) => ({
        ...prev,
        bulkSelected: [],
      }));
    } else toast.error(t('common.mail.failedToMarkAsUnread'));
  });

  useHotkeys('Control+Shift+u', async () => {
    resetSelectMode();
    const res = await markAsUnread({ ids: mail.bulkSelected });
    if (res.success) {
      toast.success(t('common.mail.markedAsUnread'));
      setMail((prev) => ({
        ...prev,
        bulkSelected: [],
      }));
    } else toast.error(t('common.mail.failedToMarkAsUnread'));
  });

  useHotkeys('Meta+Shift+i', async () => {
    resetSelectMode();
    const res = await markAsRead({ ids: mail.bulkSelected });
    if (res.success) {
      toast.success(t('common.mail.markedAsRead'));
      setMail((prev) => ({
        ...prev,
        bulkSelected: [],
      }));
    } else toast.error(t('common.mail.failedToMarkAsRead'));
  });

  useHotkeys('Control+Shift+i', async () => {
    resetSelectMode();
    const res = await markAsRead({ ids: mail.bulkSelected });
    if (res.success) {
      toast.success(t('common.mail.markedAsRead'));
      setMail((prev) => ({
        ...prev,
        bulkSelected: [],
      }));
    } else toast.error(t('common.mail.failedToMarkAsRead'));
  });

  // useHotKey("Meta+Shift+j", async () => {
  //   resetSelectMode();
  //   const res = await markAsJunk({ ids: mail.bulkSelected });
  //   if (res.success) toast.success("Marked as junk");
  //   else toast.error("Failed to mark as junk");
  // });

  // useHotKey("Control+Shift+j", async () => {
  //   resetSelectMode();
  //   const res = await markAsJunk({ ids: mail.bulkSelected });
  //   if (res.success) toast.success("Marked as junk");
  //   else toast.error("Failed to mark as junk");
  // });

  useHotkeys('Meta+a', async (event) => {
    event.preventDefault();
    resetSelectMode();
    selectAll();
  });

  useHotkeys('Control+a', async (event) => {
    event.preventDefault();
    resetSelectMode();
    selectAll();
  });

  useHotkeys('Meta+n', async (event) => {
    event.preventDefault();
    resetSelectMode();
    selectAll();
  });

  useHotkeys('Control+n', async (event) => {
    event.preventDefault();
    resetSelectMode();
    selectAll();
  });

  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        setMassSelectMode(false);
      }
      if (e.key === 'Shift') {
        setRangeSelectMode(false);
      }
      if (e.key === 'Alt') {
        setSelectAllBelowMode(false);
      }
    };

    const handleBlur = () => {
      setMassSelectMode(false);
      setRangeSelectMode(false);
      setSelectAllBelowMode(false);
    };

    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      setMassSelectMode(false);
      setRangeSelectMode(false);
      setSelectAllBelowMode(false);
    };
  }, []);

  const selectMode: MailSelectMode = massSelectMode
    ? 'mass'
    : rangeSelectMode
      ? 'range'
      : selectAllBelowMode
        ? 'selectAllBelow'
        : 'single';

  const handleMailClick = (message: InitialThread) => async () => {
    if (selectMode === 'mass') {
      const updatedBulkSelected = mail.bulkSelected.includes(message.id)
        ? mail.bulkSelected.filter((id) => id !== message.id)
        : [...mail.bulkSelected, message.id];

      setMail({ ...mail, bulkSelected: updatedBulkSelected });
      return;
    }

    if (selectMode === 'range') {
      const lastSelectedItem =
        mail.bulkSelected[mail.bulkSelected.length - 1] ?? mail.selected ?? message.id;

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

    router.push(`/mail/create?draftId=${message.id}`);

    return;
  };

  const isEmpty = items.length === 0;
  const isFiltering = searchValue.value.trim().length > 0;

  useEffect(() => {
    if (error) {
      console.error('Error fetching drafts:', error);
      toast.error('Failed to load drafts');
    }
  }, [error]);

  useEffect(() => {
    console.log('Drafts data:', {
      items,
      nextPageToken,
      isValidating,
      isLoading,
    });
  }, [items, nextPageToken, isValidating, isLoading]);

  if (isEmpty && session) {
    if (isFiltering) {
      return <EmptyState folder="search" className="min-h-[90vh] md:min-h-[90vh]" />;
    }
    return <EmptyState folder={'draft' as FolderType} className="min-h-[90vh] md:min-h-[90vh]" />;
  }

  const rowRenderer = useCallback(
    //TODO: Add proper typing
    // @ts-expect-error
    (props) => (
      <Draft
        key={props.data.id}
        onClick={handleMailClick}
        selectMode={selectMode}
        isCompact={isCompact}
        message={props.data}
        {...props}
      />
    ),
    [handleMailClick, selectMode, isCompact],
  );

  return (
    <>
      <div ref={parentRef} className={cn('h-full w-full', selectMode === 'range' && 'select-none')}>
        <ScrollArea className="hide-scrollbar h-full overflow-auto">
          {items.map((item, index) => {
            return rowRenderer({ index, data: item });
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
}
