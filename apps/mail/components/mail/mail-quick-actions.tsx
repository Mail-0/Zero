'use client';

import { ThreadDestination } from '@/lib/thread-actions';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Archive, Mail, Inbox, Undo } from 'lucide-react';
import { useCallback, memo, useState, useEffect } from 'react';
import { cn, FOLDERS } from '@/lib/utils';
import { moveThread, toggleReadStatus, handleUndo } from '@/lib/mail-actions-utils';
import { useThreads } from '@/hooks/use-threads';
import { Button } from '@/components/ui/button';
import { useStats } from '@/hooks/use-stats';
import type { InitialThread } from '@/types';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ReplyIcon } from '../icons/animated/reply';

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
    message,
    className,
    isHovered = false,
    isInQuickActionMode = false,
    selectedQuickActionIndex = 0,
    resetNavigation,
  }: MailQuickActionsProps) => {
    const { folder } = useParams<{ folder: string }>();
    const { mutate, isLoading } = useThreads();
    const { mutate: mutateStats } = useStats();
    const t = useTranslations();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isProcessing, setIsProcessing] = useState(false);
    
    interface LastAction {
      action: string;
      threadId?: string;
      previousFolder?: string;
      currentFolder?: string;
      timestamp: number;
    }
    
    const [lastAction, setLastAction] = useState<LastAction | null>(null);
    
    // Listen for actions that can be undone
    useEffect(() => {
      let timeoutId: ReturnType<typeof setTimeout>;
      
      const handleMailAction = (event: CustomEvent) => {
        const { action, threadId, currentFolder, previousFolder } = event.detail;
        
        // Check if this action is for the current message
        if (threadId === message.threadId || threadId === message.id) {
          setLastAction({ 
            action, 
            threadId, 
            currentFolder, 
            previousFolder,
            timestamp: Date.now()
          });
          
          // Clear any existing timeout
          if (timeoutId) clearTimeout(timeoutId);
          
          // Auto-clear the last action after 10 seconds
          timeoutId = setTimeout(() => {
            setLastAction(null);
          }, 10000);
        }
      };
      
      window.addEventListener('mail:action', handleMailAction as EventListener);
      
      return () => {
        window.removeEventListener('mail:action', handleMailAction as EventListener);
        if (timeoutId) clearTimeout(timeoutId);
      };
    }, [message.threadId, message.id]);

    const currentFolder = folder ?? '';
    const isInbox = currentFolder === FOLDERS.INBOX;
    const isArchiveFolder = currentFolder === FOLDERS.ARCHIVE;

    const closeThreadIfOpen = useCallback(() => {
      const threadIdParam = searchParams.get('threadId');
      const messageId = message.threadId ?? message.id;

      if (threadIdParam === messageId) {
        const currentParams = new URLSearchParams(searchParams.toString());
        currentParams.delete('threadId');
        router.push(`/mail/${currentFolder}?${currentParams.toString()}`);
      }

      if (resetNavigation) {
        resetNavigation();
      }
    }, [searchParams, message, router, currentFolder, resetNavigation]);

    const handleArchive = useCallback(
      async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (isProcessing || isLoading) return;

        setIsProcessing(true);
        try {
          const threadId = message.threadId ?? message.id;
          const destination = isArchiveFolder ? FOLDERS.INBOX : FOLDERS.ARCHIVE;
          
          await moveThread({
            threadId,
            currentFolder,
            destination: destination as ThreadDestination,
            onSuccess: async () => {
              await Promise.all([mutate(), mutateStats()]);
              closeThreadIfOpen();
            },
            t
          });
        } catch (error) {
          console.error('Error archiving thread', error);
        } finally {
          setIsProcessing(false);
        }
      },
      [
        message,
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
        if (isProcessing || isLoading) return;

        setIsProcessing(true);
        try {
          const threadId = message.threadId ?? message.id;
          
          await toggleReadStatus({
            threadId,
            isUnread: message.unread,
            onSuccess: async () => {
              await mutate();
              closeThreadIfOpen();
            },
            t
          });
        } catch (error) {
          console.error('Error toggling read status', error);
        } finally {
          setIsProcessing(false);
        }
      },
      [message, mutate, t, isProcessing, isLoading, closeThreadIfOpen],
    );

    const handleDelete = useCallback(
      async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (isProcessing || isLoading) return;

        setIsProcessing(true);
        try {
          const threadId = message.threadId ?? message.id;
          
          await moveThread({
            threadId,
            currentFolder,
            destination: 'trash',
            onSuccess: async () => {
              await Promise.all([mutate(), mutateStats()]);
              closeThreadIfOpen();
            },
            t
          });
        } catch (error) {
          console.error('Error deleting thread', error);
        } finally {
          setIsProcessing(false);
        }
      },
      [t, isProcessing, isLoading, message, currentFolder, mutate, mutateStats, closeThreadIfOpen],
    );

    const handleQuickReply = useCallback(
      async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        
        // Dispatch event to trigger the reply composer in thread display
        const threadId = message.threadId ?? message.id;
        const event = new CustomEvent('mail:action', {
          detail: { 
            threadId, 
            type: 'reply'
          }
        });
        
        window.dispatchEvent(event);
        
        // Navigate to the thread view with the reply composer open
        const currentParams = new URLSearchParams(searchParams.toString());
        currentParams.set('threadId', threadId);
        router.push(`/mail/${currentFolder}?${currentParams.toString()}`);
      },
      [message, router, currentFolder, searchParams],
    );
    
    const handleUndoAction = useCallback(
      async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (isProcessing || isLoading || !lastAction) return;
        
        setIsProcessing(true);
        try {
          await handleUndo({
            lastAction,
            onSuccess: async () => {
              // Clear the last action
              setLastAction(null);
              // Refresh the mail list
              await Promise.all([mutate(), mutateStats()]);
            },
            t
          });
        } catch (error) {
          console.error('Error undoing action', error);
          toast.error(t('common.mail.undoError'));
        } finally {
          setIsProcessing(false);
        }
      },
      [lastAction, t, isProcessing, isLoading, mutate, mutateStats],
    );


    const quickActions = [
      // Only show undo button if there's a recent action to undo
      ...(lastAction ? [{
        action: handleUndoAction,
        icon: Undo,
        label: `Undo ${lastAction.action}`,
        disabled: false,
      }] : []),
      {
        action: handleQuickReply,
        icon: ReplyIcon,
        label: t('common.mail.reply'),
        disabled: false,
      },
      {
        action: handleArchive,
        icon: isArchiveFolder || !isInbox ? Inbox : Archive,
        label: isArchiveFolder || !isInbox ? 'Unarchive' : 'Archive',
        disabled: false,
      },
      {
        action: handleToggleRead,
        icon: Mail,
        label: message.unread ? 'Mark as read' : 'Mark as unread',
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
