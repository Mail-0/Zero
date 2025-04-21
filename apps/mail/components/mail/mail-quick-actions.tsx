'use client';

import { moveThreadsTo, ThreadDestination } from '@/lib/thread-actions';
import { useThread, useThreads } from '@/hooks/use-threads';
import { markAsRead, markAsUnread } from '@/actions/mail';
import { useParams, useRouter } from 'next/navigation';
import { Archive, Mail, Inbox } from 'lucide-react';
import { useCallback, memo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useStats } from '@/hooks/use-stats';
import type { InitialThread } from '@/types';
import { useTranslations } from 'next-intl';
import { cn, FOLDERS } from '@/lib/utils';
import { useQueryState } from 'nuqs';
import { toast } from 'sonner';

interface MailQuickActionsProps {
  message: InitialThread;
  className?: string;
  isHovered?: boolean;
  isInQuickActionMode?: boolean;
  selectedQuickActionIndex?: number;
  resetNavigation?: () => void;
}

export const MailQuickActions = memo(
  ({
    message: { id },
    className,
    isHovered = false,
    isInQuickActionMode = false,
    selectedQuickActionIndex = 0,
    resetNavigation,
  }: MailQuickActionsProps) => {
    const { data: threadData, mutate: mutateThread } = useThread(id);
    const latestMessage = threadData?.latest;
    const { folder } = useParams<{ folder: string }>();
    const { mutate, isLoading } = useThreads();
    const { mutate: mutateStats } = useStats();
    const t = useTranslations();
    const router = useRouter();
    const [isProcessing, setIsProcessing] = useState(false);
    const [threadId, setThreadId] = useQueryState('threadId');

    const currentFolder = folder ?? '';
    const isInbox = currentFolder === FOLDERS.INBOX;
    const isArchiveFolder = currentFolder === FOLDERS.ARCHIVE;

    const closeThreadIfOpen = useCallback(() => {
      if (!latestMessage) return;
      const messageId = latestMessage.threadId ?? latestMessage.id;

      if (threadId === messageId) {
        setThreadId(null);
      }

      if (resetNavigation) {
        resetNavigation();
      }
    }, [threadId, latestMessage, router, currentFolder, resetNavigation]);

    const handleArchive = useCallback(
      async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (isProcessing || isLoading || !latestMessage) return;

        setIsProcessing(true);
        try {
          const threadId = latestMessage.threadId ?? latestMessage.id;
          const destination = isArchiveFolder ? FOLDERS.INBOX : FOLDERS.ARCHIVE;

          await moveThreadsTo({
            threadIds: [`thread:${threadId}`],
            currentFolder: currentFolder,
            destination: destination as ThreadDestination,
          }).then(async () => {
            await Promise.all([mutate(), mutateStats()]);

            const actionType = isArchiveFolder ? 'unarchive' : 'archive';
            toast.success(t(`common.mail.${actionType}`));

            closeThreadIfOpen();
          });
        } catch (error) {
          console.error('Error archiving thread', error);
          toast.error(t('common.mail.errorMoving'));
        } finally {
          setIsProcessing(false);
        }
      },
      [
        latestMessage,
        currentFolder,
        isArchiveFolder,
        mutate,
        mutateStats,
        t,
        isProcessing,
        isLoading,
        closeThreadIfOpen,
      ],
    );

    const handleToggleRead = useCallback(
      async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (isProcessing || isLoading || !latestMessage) return;

        setIsProcessing(true);
        try {
          const threadId = latestMessage.threadId ?? latestMessage.id;

          if (latestMessage.unread) {
            await markAsRead({ ids: [threadId] }).then((response) => {
              if (response.success) {
                mutateThread();
                toast.success(t('common.mail.markedAsRead'));
              } else {
                toast.error(t('common.mail.failedToMarkAsRead'));
              }
              closeThreadIfOpen();
            });
          } else {
            await markAsUnread({ ids: [threadId] }).then((response) => {
              if (response.success) {
                mutateThread();
                toast.success(t('common.mail.markedAsUnread'));
              } else {
                toast.error(t('common.mail.failedToMarkAsUnread'));
              }
              closeThreadIfOpen();
            });
          }
        } catch (error) {
          console.error('Error toggling read status', error);
        } finally {
          setIsProcessing(false);
        }
      },
      [latestMessage, mutate, t, isProcessing, isLoading, closeThreadIfOpen],
    );

    const handleDelete = useCallback(
      async (e?: React.MouseEvent) => {
        // TODO: Implement delete
        toast.info(t('common.mail.moveToBin'));
      },
      [t],
    );

    const handleQuickReply = useCallback(
      async (e?: React.MouseEvent) => {
        // TODO: Implement quick reply
        toast.info(t('common.mail.reply'));
      },
      [t],
    );

    const quickActions = [
      {
        action: handleArchive,
        icon: isArchiveFolder || !isInbox ? Inbox : Archive,
        label: isArchiveFolder || !isInbox ? 'Unarchive' : 'Archive',
        disabled: false,
      },
      {
        action: handleToggleRead,
        icon: Mail,
        label: threadData?.hasUnread ? 'Mark as read' : 'Mark as unread',
        disabled: false,
      },
    ];

    if (!isHovered && !isInQuickActionMode) {
      return null;
    }

    return (
      <div
        className={cn(
          'bg-background/80 absolute right-2 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1 overflow-visible rounded-md p-1 backdrop-blur-sm',
          className,
          isInQuickActionMode && 'bg-background/95 ring-primary/20 ring-2',
        )}
      >
        {quickActions.map((quickAction, index) => (
          <Button
            key={index}
            variant={
              isInQuickActionMode && selectedQuickActionIndex === index ? 'secondary' : 'ghost'
            }
            size="icon"
            className={cn(
              'mail-quick-action-button h-7 w-7',
              isInQuickActionMode &&
                selectedQuickActionIndex === index &&
                'border-primary/60 border shadow-sm',
              quickAction.disabled && 'opacity-50',
            )}
            onClick={(e) => quickAction.action(e)}
            disabled={isLoading || isProcessing || quickAction.disabled}
            aria-label={quickAction.label}
          >
            <quickAction.icon className="h-4 w-4" />
          </Button>
        ))}
      </div>
    );
  },
);

MailQuickActions.displayName = 'MailQuickActions';
