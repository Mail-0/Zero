'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { keyboardShortcuts } from '@/config/shortcuts';
import { useCallback, useEffect, useRef } from 'react';
import { useMail } from '@/components/mail/use-mail';
import { useTRPC } from '@/providers/query-provider';
import { useShortcuts } from './use-hotkey-utils';
import { useThreads } from '@/hooks/use-threads';
import { useStats } from '@/hooks/use-stats';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export function MailListHotkeys() {
  const scope = 'mail-list';
  const [mail, setMail] = useMail();
  const [{ refetch }, items] = useThreads();
  const { refetch: mutateStats } = useStats();
  const t = useTranslations();
  const hoveredEmailId = useRef<string | null>(null);
  const trpc = useTRPC();
  const { mutateAsync: bulkArchive } = useMutation(trpc.mail.bulkArchive.mutationOptions());
  const { mutateAsync: markAsUnreadAction } = useMutation(trpc.mail.markAsUnread.mutationOptions());
  const { mutateAsync: markAsReadAction } = useMutation(trpc.mail.markAsRead.mutationOptions());

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
      toast.promise(markAsReadAction({ ids: [hoveredEmailId.current] }), {
        loading: t('common.actions.loading'),
        success: async () => {
          await Promise.all([refetch(), mutateStats()]);
          return t('common.mail.markedAsRead');
        },
        error: t('common.mail.failedToMarkAsRead'),
      });
      return;
    }

    const idsToMark = mail.bulkSelected;
    if (idsToMark.length === 0) {
      toast.info(t('common.mail.noEmailsToSelect'));
      return;
    }

    toast.promise(markAsReadAction({ ids: idsToMark }), {
      loading: t('common.actions.loading'),
      success: async () => {
        await Promise.all([refetch(), mutateStats()]);
        return t('common.mail.markedAsRead');
      },
      error: t('common.mail.failedToMarkAsRead'),
    });
  }, [mail.bulkSelected, refetch, mutateStats, t]);

  const markAsUnread = useCallback(() => {
    if (hoveredEmailId.current) {
      toast.promise(markAsUnreadAction({ ids: [hoveredEmailId.current] }), {
        loading: t('common.actions.loading'),
        success: async () => {
          await Promise.all([refetch(), mutateStats()]);
          return t('common.mail.markedAsUnread');
        },
        error: t('common.mail.failedToMarkAsUnread'),
      });
      return;
    }

    const idsToMark = mail.bulkSelected;
    if (idsToMark.length === 0) {
      toast.info(t('common.mail.noEmailsToSelect'));
      return;
    }

    toast.promise(markAsUnreadAction({ ids: idsToMark }), {
      loading: t('common.actions.loading'),
      success: async () => {
        await Promise.all([refetch(), mutateStats()]);
        return t('common.mail.markedAsUnread');
      },
      error: t('common.mail.failedToMarkAsUnread'),
    });
  }, [mail.bulkSelected, refetch, mutateStats, t]);

  const archiveEmail = useCallback(async () => {
    if (hoveredEmailId.current) {
      toast.promise(bulkArchive({ ids: [hoveredEmailId.current] }), {
        loading: t('common.actions.loading'),
        success: async () => {
          await Promise.all([refetch(), mutateStats()]);
          return t('common.mail.archived');
        },
        error: t('common.mail.failedToArchive'),
      });
      return;
    }

    const idsToMark = mail.bulkSelected;
    if (idsToMark.length === 0) {
      toast.info(t('common.mail.noEmailsToSelect'));
      return;
    }

    toast.promise(markAsUnreadAction({ ids: idsToMark }), {
      loading: t('common.actions.loading'),
      success: async () => {
        await Promise.all([refetch(), mutateStats()]);
        return t('common.mail.archived');
      },
      error: t('common.mail.failedToArchive'),
    });
  }, [mail]);

  const exitSelectionMode = useCallback(() => {
    setMail((prev) => ({
      ...prev,
      bulkSelected: [],
    }));
  }, []);

  const handlers = {
    markAsRead,
    markAsUnread,
    selectAll,
    archiveEmail,
    exitSelectionMode,
    // muteThread,
  };

  const mailListShortcuts = keyboardShortcuts.filter((shortcut) => shortcut.scope === scope);

  useShortcuts(mailListShortcuts, handlers, { scope });

  return null;
}
