import { useOptimisticActions } from '@/hooks/use-optimistic-actions';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchValue } from '@/hooks/use-search-value';
import { useQueryClient } from '@tanstack/react-query';
import { keyboardShortcuts } from '@/config/shortcuts';
import { useLocation, useParams } from 'react-router';
import { useMail } from '@/components/mail/use-mail';
import { useTRPC } from '@/providers/query-provider';
import { Categories } from '@/components/mail/mail';
import { useShortcuts } from './use-hotkey-utils';
import { useThreads } from '@/hooks/use-threads';
import { cleanSearchValue } from '@/lib/utils';
import { useStats } from '@/hooks/use-stats';
import { useTranslations } from 'use-intl';
import { useQueryState } from 'nuqs';
import { toast } from 'sonner';

export function MailListHotkeys() {
  const scope = 'mail-list';
  const [mail, setMail] = useMail();
  const [{ refetch }, items] = useThreads();
  const { refetch: mutateStats } = useStats();
  const t = useTranslations();
  const hoveredEmailId = useRef<string | null>(null);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const categories = Categories();
  const [, setCategory] = useQueryState('category');
  const [searchValue, setSearchValue] = useSearchValue();
  const pathname = useLocation().pathname;
  const params = useParams<{ folder: string }>();
  const folder = params?.folder ?? 'inbox';

  const { optimisticMarkAsRead, optimisticMarkAsUnread, optimisticMoveThreadsTo } =
    useOptimisticActions();

  const invalidateCount = () =>
    queryClient.invalidateQueries({ queryKey: trpc.mail.count.queryKey() });

  useEffect(() => {
    const handleEmailHover = (event: CustomEvent<{ id: string | null }>) => {
      hoveredEmailId.current = event.detail.id;
    };

    window.addEventListener('emailHover', handleEmailHover as EventListener);
    return () => {
      window.removeEventListener('emailHover', handleEmailHover as EventListener);
    };
  }, []);

  const selectAll = useCallback(() => {
    console.log('selectAll');
    if (mail.bulkSelected.length > 0) {
      setMail((prev) => ({
        ...prev,
        bulkSelected: [],
      }));
    } else if (items.length > 0) {
      const allIds = items.map((item) => item.id);
      setMail((prev) => ({
        ...prev,
        bulkSelected: allIds,
      }));
    } else {
      toast.info(t('common.mail.noEmailsToSelect'));
    }
  }, [items, mail]);

  const markAsRead = useCallback(() => {
    if (hoveredEmailId.current) {
      optimisticMarkAsRead([hoveredEmailId.current]);
      return;
    }

    const idsToMark = mail.bulkSelected;
    if (idsToMark.length === 0) {
      toast.info(t('common.mail.noEmailsToSelect'));
      return;
    }

    optimisticMarkAsRead(idsToMark);
  }, [mail.bulkSelected, optimisticMarkAsRead, t]);

  const markAsUnread = useCallback(() => {
    if (hoveredEmailId.current) {
      optimisticMarkAsUnread([hoveredEmailId.current]);
      return;
    }

    const idsToMark = mail.bulkSelected;
    if (idsToMark.length === 0) {
      toast.info(t('common.mail.noEmailsToSelect'));
      return;
    }

    optimisticMarkAsUnread(idsToMark);
  }, [mail.bulkSelected, optimisticMarkAsUnread, t]);

  const archiveEmail = useCallback(async () => {
    if (hoveredEmailId.current) {
      optimisticMoveThreadsTo([hoveredEmailId.current], folder, 'archive');
      return;
    }

    const idsToArchive = mail.bulkSelected;
    if (idsToArchive.length === 0) {
      toast.info(t('common.mail.noEmailsToSelect'));
      return;
    }

    optimisticMoveThreadsTo(idsToArchive, folder, 'archive');
  }, [mail.bulkSelected, folder, optimisticMoveThreadsTo, t]);

  const exitSelectionMode = useCallback(() => {
    setMail((prev) => ({
      ...prev,
      bulkSelected: [],
    }));
  }, []);

  const switchMailListCategory = useCallback(
    (category: string | null) => {
      if (pathname?.includes('/mail/inbox')) {
        const cat = categories.find((cat) => cat.id === category);
        if (!cat) {
          setCategory(null);
          setSearchValue({
            value: '',
            highlight: searchValue.highlight,
            folder: '',
          });
          return;
        }
        setCategory(cat.id);
        setSearchValue({
          value: `${cat.searchValue} ${cleanSearchValue(searchValue.value).trim().length ? `AND ${cleanSearchValue(searchValue.value)}` : ''}`,
          highlight: searchValue.highlight,
          folder: '',
        });
      }
    },
    [categories, pathname, searchValue, setCategory, setSearchValue],
  );

  const handlers = useMemo(
    () => ({
      markAsRead,
      markAsUnread,
      selectAll,
      archiveEmail,
      exitSelectionMode,
      showImportant: () => {
        switchMailListCategory(null);
      },
      showAllMail: () => {
        switchMailListCategory('All Mail');
      },
      showPersonal: () => {
        switchMailListCategory('Personal');
      },
      showUpdates: () => {
        switchMailListCategory('Updates');
      },
      showPromotions: () => {
        switchMailListCategory('Promotions');
      },
      showUnread: () => {
        switchMailListCategory('Unread');
      },
    }),
    [switchMailListCategory, markAsRead, markAsUnread, selectAll, archiveEmail, exitSelectionMode],
  );

  const mailListShortcuts = keyboardShortcuts.filter((shortcut) => shortcut.scope === scope);

  useShortcuts(mailListShortcuts, handlers, { scope });

  return null;
}
