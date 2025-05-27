import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '../ui/context-menu';
import {
  Archive,
  ArchiveX,
  BellOff,
  Forward,
  Inbox,
  MailPlus,
  Reply,
  ReplyAll,
  Tag,
  Mail,
  Star,
  StarOff,
  Trash,
  MailOpen,
} from 'lucide-react';
import { moveThreadsTo, type ThreadDestination } from '@/lib/thread-actions';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { backgroundQueueAtom } from '@/store/backgroundQueue';
import { useThread, useThreads } from '@/hooks/use-threads';
import { useSearchValue } from '@/hooks/use-search-value';
import { useParams, useNavigate } from 'react-router';
import { useTRPC } from '@/providers/query-provider';
import { ExclamationCircle } from '../icons/icons';
import { useLabels } from '@/hooks/use-labels';
import { LABELS, FOLDERS } from '@/lib/utils';
import { useStats } from '@/hooks/use-stats';
import { useMail } from '../mail/use-mail';
import { useTranslations } from 'use-intl';
import { Checkbox } from '../ui/checkbox';
import { type ReactNode } from 'react';
import { useQueryState } from 'nuqs';
import { useMemo } from 'react';
import { useAtom } from 'jotai';
import { toast } from 'sonner';

interface EmailAction {
  id: string;
  label: string | ReactNode;
  icon?: ReactNode;
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
  condition?: () => boolean;
}

interface EmailContextMenuProps {
  children: ReactNode;
  emailId: string;
  threadId?: string;
  isInbox?: boolean;
  isSpam?: boolean;
  isSent?: boolean;
  isBin?: boolean;
  refreshCallback?: () => void;
}

const LabelsList = ({ threadId }: { threadId: string }) => {
  const { data: labels } = useLabels();
  const { data: thread, refetch } = useThread(threadId);
  const t = useTranslations();
  const trpc = useTRPC();
  const { mutateAsync: modifyLabels } = useMutation(trpc.mail.modifyLabels.mutationOptions());

  if (!labels || !thread) return null;

  const handleToggleLabel = async (labelId: string) => {
    if (!labelId) return;
    const hasLabel = thread.labels?.map((label) => label.id).includes(labelId);
    const promise = modifyLabels({
      threadId: [threadId],
      addLabels: hasLabel ? [] : [labelId],
      removeLabels: hasLabel ? [labelId] : [],
    });
    toast.promise(promise, {
      error:  hasLabel ? "Failed to remove label" : "Failed to add label",
      finally: async () => {
        await refetch();
      },
    });
  };

  return (
    <>
      {labels
        .filter((label) => label.id)
        .map((label) => (
          <ContextMenuItem
            key={label.id}
            onClick={() => label.id && handleToggleLabel(label.id)}
            className="font-normal"
          >
            <div className="flex items-center">
              <Checkbox
                checked={
                  label.id ? thread.labels?.map((label) => label.id).includes(label.id) : false
                }
                className="mr-2 h-4 w-4"
              />
              {label.name}
            </div>
          </ContextMenuItem>
        ))}
    </>
  );
};

export function ThreadContextMenu({
  children,
  emailId,
  threadId = emailId,
  isInbox = true,
  isSpam = false,
  isSent = false,
  isBin = false,
}: EmailContextMenuProps) {
  const { folder } = useParams<{ folder: string }>();
  const [mail, setMail] = useMail();
  const [{ refetch, isLoading, isFetching }, threads] = useThreads();
  const currentFolder = folder ?? '';
  const isArchiveFolder = currentFolder === FOLDERS.ARCHIVE;
  const { refetch: refetchStats } = useStats();
  const t = useTranslations();
  const [, setMode] = useQueryState('mode');
  const [, setThreadId] = useQueryState('threadId');
  const [, setBackgroundQueue] = useAtom(backgroundQueueAtom);
  const { refetch: refetchThread, data: threadData } = useThread(threadId);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const invalidateCount = () =>
    queryClient.invalidateQueries({ queryKey: trpc.mail.count.queryKey() });
  const { mutateAsync: markAsRead } = useMutation(
    trpc.mail.markAsRead.mutationOptions({ onSuccess: () => invalidateCount() }),
  );
  const { mutateAsync: markAsUnread } = useMutation(
    trpc.mail.markAsUnread.mutationOptions({ onSuccess: () => invalidateCount() }),
  );
  const { mutateAsync: toggleStar } = useMutation(trpc.mail.toggleStar.mutationOptions());
  const { mutateAsync: toggleImportant } = useMutation(trpc.mail.toggleImportant.mutationOptions());
  const { mutateAsync: deleteThread } = useMutation(trpc.mail.delete.mutationOptions());

  const selectedThreads = useMemo(() => {
    if (mail.bulkSelected.length) {
      return threads.filter((thread) => mail.bulkSelected.includes(thread.id));
    }
    return threads.filter((thread) => thread.id === threadId);
  }, [mail.bulkSelected, threadId, threads]);

  const isUnread = useMemo(() => {
    return threadData?.hasUnread ?? false;
  }, [threadData]);

  const isStarred = useMemo(() => {
    // TODO support bulk select
    return threadData?.messages.some((message) =>
      message.tags?.some((tag) => tag.name.toLowerCase() === 'starred'),
    );
  }, [threadData]);

  const isImportant = useMemo(() => {
    return threadData?.messages.some((message) =>
      message.tags?.some((tag) => tag.name.toLowerCase() === 'important'),
    );
  }, [threadData]);

  const noopAction = () => async () => {
    toast.info(t('common.actions.featureNotImplemented'));
  };

  const handleMove = (from: string, to: string) => async () => {
    try {
      let targets = [];
      if (mail.bulkSelected.length) {
        targets = mail.bulkSelected.map((id) => `thread:${id}`);
      } else {
        targets = [threadId ? `thread:${threadId}` : emailId];
      }

      let destination: ThreadDestination = null;
      if (to === LABELS.INBOX) destination = FOLDERS.INBOX;
      else if (to === LABELS.SPAM) destination = FOLDERS.SPAM;
      else if (to === LABELS.TRASH) destination = FOLDERS.BIN;
      else if (from && !to) destination = FOLDERS.ARCHIVE;

      const promise = moveThreadsTo({
        threadIds: targets,
        currentFolder: currentFolder,
        destination,
      });
      targets.forEach((threadId) => setBackgroundQueue({ type: 'add', threadId }));
      toast.promise(promise, {
        finally: async () => {
          await Promise.all([refetch(), refetchStats()]);
          setMail({ ...mail, bulkSelected: [] });
          targets.forEach((threadId) => setBackgroundQueue({ type: 'delete', threadId }));
        },
        error: t('common.actions.failedToMove'),
      });
    } catch (error) {
      console.error(`Error moving ${threadId ? 'email' : 'thread'}:`, error);
    }
  };

  const handleFavorites = async () => {
    const targets = mail.bulkSelected.length ? mail.bulkSelected : [threadId];
    const promise = toggleStar({ ids: targets });
    toast.promise(promise, {
      error:  isStarred ? t('common.actions.failedToRemoveFromFavorites') : t('common.actions.failedToAddToFavorites'),
      finally: async () => {
        setMail((prev) => ({ ...prev, bulkSelected: [] }));
        await Promise.allSettled([refetchThread(), refetch()]);
      },
    });
  };

  const handleToggleImportant = async () => {
    const targets = mail.bulkSelected.length ? mail.bulkSelected : [threadId];
    await toggleImportant({ ids: targets });
    setMail((prev) => ({ ...prev, bulkSelected: [] }));
    return await Promise.allSettled([refetchThread(), refetch()]);
  };

  const handleReadUnread = () => {
    const targets = mail.bulkSelected.length ? mail.bulkSelected : [threadId];
    const action = isUnread ? markAsRead : markAsUnread;

    const promise = action({ ids: targets });

    toast.promise(promise, {
      error: t(isUnread ? 'common.mail.failedToMarkAsRead' : 'common.mail.failedToMarkAsUnread'),
      async finally() {
        setMail((prev) => ({ ...prev, bulkSelected: [] }));
        await Promise.allSettled([refetchThread(), refetch()]);
      },
    });
  };
  const [, setActiveReplyId] = useQueryState('activeReplyId');

  const handleThreadReply = () => {
    setMode('reply');
    setThreadId(threadId);
    if (threadData?.latest) setActiveReplyId(threadData?.latest?.id);
  };

  const handleThreadReplyAll = () => {
    setMode('replyAll');
    setThreadId(threadId);
    if (threadData?.latest) setActiveReplyId(threadData?.latest?.id);
  };

  const handleThreadForward = () => {
    setMode('forward');
    setThreadId(threadId);
    if (threadData?.latest) setActiveReplyId(threadData?.latest?.id);
  };

  const primaryActions: EmailAction[] = [
    {
      id: 'reply',
      label: t('common.mail.reply'),
      icon: <Reply className="mr-2.5 h-4 w-4" />,
      action: handleThreadReply,
      disabled: false,
    },
    {
      id: 'reply-all',
      label: t('common.mail.replyAll'),
      icon: <ReplyAll className="mr-2.5 h-4 w-4" />,
      action: handleThreadReplyAll,
      disabled: false,
    },
    {
      id: 'forward',
      label: t('common.mail.forward'),
      icon: <Forward className="mr-2.5 h-4 w-4" />,
      action: handleThreadForward,
      disabled: false,
    },
  ];
  const handleDelete = () => async () => {
    toast.promise(deleteThread({ id: threadId }), {
      loading: t('common.actions.deletingMail'),
      success: t('common.actions.deletedMail'),
      error: t('common.actions.failedToDeleteMail'),
      finally: async () => {
        setMail((prev) => ({ ...prev, bulkSelected: [] }));
        await Promise.allSettled([refetchThread(), refetch()]);
      },
    });
  };

  const getActions = () => {
    if (isSpam) {
      return [
        {
          id: 'move-to-inbox',
          label: t('common.mail.moveToInbox'),
          icon: <Inbox className="mr-2.5 h-4 w-4" />,
          action: handleMove(LABELS.SPAM, LABELS.INBOX),
          disabled: false,
        },
        {
          id: 'move-to-bin',
          label: t('common.mail.moveToBin'),
          icon: <Trash className="mr-2.5 h-4 w-4" />,
          action: handleMove(LABELS.SPAM, LABELS.TRASH),
          disabled: false,
        },
      ];
    }

    if (isBin) {
      return [
        {
          id: 'restore-from-bin',
          label: t('common.mail.restoreFromBin'),
          icon: <Inbox className="mr-2.5 h-4 w-4" />,
          action: handleMove(LABELS.TRASH, LABELS.INBOX),
          disabled: false,
        },
        {
          id: 'delete-from-bin',
          label: t('common.mail.deleteFromBin'),
          icon: <Trash className="mr-2.5 h-4 w-4" />,
          action: handleDelete(),
          disabled: true,
        },
      ];
    }

    if (isArchiveFolder || !isInbox) {
      return [
        {
          id: 'move-to-inbox',
          label: t('common.mail.unarchive'),
          icon: <Inbox className="mr-2.5 h-4 w-4" />,
          action: handleMove('', LABELS.INBOX),
          disabled: false,
        },
        {
          id: 'move-to-bin',
          label: t('common.mail.moveToBin'),
          icon: <Trash className="mr-2.5 h-4 w-4" />,
          action: handleMove('', LABELS.TRASH),
          disabled: false,
        },
      ];
    }

    if (isSent) {
      return [
        {
          id: 'archive',
          label: t('common.mail.archive'),
          icon: <Archive className="mr-2.5 h-4 w-4" />,
          action: handleMove(LABELS.SENT, ''),
          disabled: false,
        },
        {
          id: 'move-to-bin',
          label: t('common.mail.moveToBin'),
          icon: <Trash className="mr-2.5 h-4 w-4" />,
          action: handleMove(LABELS.SENT, LABELS.TRASH),
          disabled: false,
        },
      ];
    }

    return [
      {
        id: 'archive',
        label: t('common.mail.archive'),
        icon: <Archive className="mr-2.5 h-4 w-4" />,
        action: handleMove(LABELS.INBOX, ''),
        disabled: false,
      },
      {
        id: 'move-to-spam',
        label: t('common.mail.moveToSpam'),
        icon: <ArchiveX className="mr-2.5 h-4 w-4" />,
        action: handleMove(LABELS.INBOX, LABELS.SPAM),
        disabled: !isInbox,
      },
      {
        id: 'move-to-bin',
        label: t('common.mail.moveToBin'),
        icon: <Trash className="mr-2.5 h-4 w-4" />,
        action: handleMove(LABELS.INBOX, LABELS.TRASH),
        disabled: false,
      },
    ];
  };

  const otherActions: EmailAction[] = [
    {
      id: 'toggle-read',
      label: isUnread ? t('common.mail.markAsRead') : t('common.mail.markAsUnread'),
      icon: isUnread ? (
        <Mail className="mr-2.5 h-4 w-4" />
      ) : (
        <MailOpen className="mr-2.5 h-4 w-4" />
      ),
      action: handleReadUnread,
      disabled: false,
    },
    {
      id: 'toggle-important',
      label: isImportant ? t('common.mail.removeFromImportant') : t('common.mail.markAsImportant'),
      icon: <ExclamationCircle className={'mr-2.5 h-4 w-4'} />,
      action: handleToggleImportant,
    },
    {
      id: 'favorite',
      label: isStarred ? t('common.mail.removeFavorite') : t('common.mail.addFavorite'),
      icon: isStarred ? (
        <StarOff className="mr-2.5 h-4 w-4" />
      ) : (
        <Star className="mr-2.5 h-4 w-4" />
      ),
      action: handleFavorites,
    },
    // {
    //   id: 'mute',
    //   label: t('common.mail.muteThread'),
    //   icon: <BellOff className="mr-2.5 h-4 w-4" />,
    //   action: noopAction,
    //   disabled: true, // TODO: Mute thread functionality to be implemented
    // },
  ];

  const renderAction = (action: EmailAction) => {
    return (
      <ContextMenuItem
        key={action.id}
        onClick={action.action}
        disabled={action.disabled}
        className="font-normal"
      >
        {action.icon}
        {action.label}
        {action.shortcut && <ContextMenuShortcut>{action.shortcut}</ContextMenuShortcut>}
      </ContextMenuItem>
    );
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger disabled={isLoading || isFetching} className="w-full">
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56 bg-white dark:bg-[#1A1A1A]" onContextMenu={(e) => e.preventDefault()}>
        {primaryActions.map(renderAction)}

        <ContextMenuSeparator className="dark:bg-[#252525] bg-[#252525]"/>

        <ContextMenuSub>
          <ContextMenuSubTrigger className="font-normal">
            <Tag className="mr-2.5 h-4 w-4" />
            {t('common.mail.labels')}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48 bg-white dark:bg-[#1A1A1A]">
            <LabelsList threadId={threadId} />
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator className="dark:bg-[#252525] bg-[#252525]"/>

        {getActions().map(renderAction as any)}

        <ContextMenuSeparator className="dark:bg-[#252525] bg-[#252525]"/>

        {otherActions.map(renderAction)}
      </ContextMenuContent>
    </ContextMenu>
  );
}
