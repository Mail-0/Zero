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
import { moveThreadsTo, ThreadDestination } from '@/lib/thread-actions';
import { markAsRead, markAsUnread, toggleStar } from '@/actions/mail';
import { useThread, useThreads } from '@/hooks/use-threads';
import { useSearchValue } from '@/hooks/use-search-value';
import { useParams, useRouter } from 'next/navigation';
import { modifyLabels } from '@/actions/mail';
import { LABELS, FOLDERS } from '@/lib/utils';
import { useStats } from '@/hooks/use-stats';
import { useTranslations } from 'next-intl';
import { useMail } from '../mail/use-mail';
import { type ReactNode } from 'react';
import { useQueryState } from 'nuqs';
import { useMemo } from 'react';
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

export function ThreadContextMenu({
  children,
  emailId,
  threadId = emailId,
  isInbox = true,
  isSpam = false,
  isSent = false,
  isBin = false,
  refreshCallback,
}: EmailContextMenuProps) {
  const { folder } = useParams<{ folder: string }>();
  const [mail, setMail] = useMail();
  const {
    data: { threads },
    mutate,
    isLoading,
    isValidating,
  } = useThreads();
  const currentFolder = folder ?? '';
  const isArchiveFolder = currentFolder === FOLDERS.ARCHIVE;
  const { mutate: mutateStats } = useStats();
  const t = useTranslations();
  const router = useRouter();
  const [, setMode] = useQueryState('mode');
  const [, setThreadId] = useQueryState('threadId');
  const { mutate: mutateThread, data: threadData } = useThread(threadId);
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
    return threadData?.latest?.tags?.includes('STARRED') ?? false;
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
      }).then(async () => {
        await Promise.all([mutate(), mutateStats()]);
        setMail({ ...mail, bulkSelected: [] });
      });

      let loadingMessage = t('common.actions.moving');
      let successMessage = t('common.actions.movedToInbox');

      if (destination === FOLDERS.INBOX) {
        loadingMessage = t('common.actions.movingToInbox');
        successMessage = t('common.actions.movedToInbox');
      } else if (destination === FOLDERS.SPAM) {
        loadingMessage = t('common.actions.movingToSpam');
        successMessage = t('common.actions.movedToSpam');
      } else if (destination === FOLDERS.ARCHIVE) {
        loadingMessage = t('common.actions.archiving');
        successMessage = t('common.actions.archived');
      } else if (destination === FOLDERS.BIN) {
        loadingMessage = t('common.actions.movingToBin');
        successMessage = t('common.actions.movedToBin');
      }

      toast.promise(promise, {
        loading: loadingMessage,
        success: successMessage,
        error: t('common.actions.failedToMove'),
      });

      await promise;
    } catch (error) {
      console.error(`Error moving ${threadId ? 'email' : 'thread'}:`, error);
    }
  };

  const handleFavorites = () => {
    const targets = mail.bulkSelected.length ? mail.bulkSelected : [threadId];
    console.log('targets', targets);
    const promise = toggleStar({ ids: targets }).then(() => {
      setMail((prev) => ({ ...prev, bulkSelected: [] }));
      return mutateThread();
    });

    toast.promise(promise, {
      loading: isStarred
        ? t('common.actions.removingFromFavorites')
        : t('common.actions.addingToFavorites'),
      success: isStarred
        ? t('common.actions.removedFromFavorites')
        : t('common.actions.addedToFavorites'),
      error: t('common.actions.failedToModifyFavorites'),
    });
  };

  const handleReadUnread = () => {
    const targets = mail.bulkSelected.length ? mail.bulkSelected : [threadId];
    const action = isUnread ? markAsRead : markAsUnread;

    const promise = action({ ids: targets }).then(() => {
      setMail((prev) => ({ ...prev, bulkSelected: [] }));
      return mutateThread();
    });

    toast.promise(promise, {
      loading: t(isUnread ? 'common.actions.markingAsRead' : 'common.actions.markingAsUnread'),
      success: t(isUnread ? 'common.mail.markedAsRead' : 'common.mail.markedAsUnread'),
      error: t(isUnread ? 'common.mail.failedToMarkAsRead' : 'common.mail.failedToMarkAsUnread'),
    });
  };

  const handleThreadReply = () => {
    setMode('reply');
    setThreadId(threadId);
  };

  const handleThreadReplyAll = () => {
    setMode('replyAll');
    setThreadId(threadId);
  };

  const handleThreadForward = () => {
    setMode('forward');
    setThreadId(threadId);
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
      id: 'favorite',
      label: isStarred ? t('common.mail.removeFavorite') : t('common.mail.addFavorite'),
      icon: isStarred ? (
        <StarOff className="mr-2.5 h-4 w-4" />
      ) : (
        <Star className="mr-2.5 h-4 w-4" />
      ),
      action: handleFavorites,
      disabled: false,
    },
    {
      id: 'mute',
      label: t('common.mail.muteThread'),
      icon: <BellOff className="mr-2.5 h-4 w-4" />,
      action: noopAction,
      disabled: true, // TODO: Mute thread functionality to be implemented
    },
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
      <ContextMenuTrigger disabled={isLoading || isValidating} className="w-full">
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56" onContextMenu={(e) => e.preventDefault()}>
        {primaryActions.map(renderAction)}

        <ContextMenuSeparator />

        {getActions().map(renderAction as any)}

        <ContextMenuSeparator />

        {otherActions.map(renderAction)}

        {/* <ContextMenuSeparator />

				<ContextMenuSub>
					<ContextMenuSubTrigger className="font-normal">
						<Tag className="mr-2.5 h-4 w-4" />
						{t('common.mail.labels')}
					</ContextMenuSubTrigger>
					<ContextMenuSubContent className="w-48">
						<ContextMenuItem className="font-normal">
							<MailPlus className="mr-2.5 h-4 w-4" />
							{t('common.mail.createNewLabel')}
						</ContextMenuItem>
						<ContextMenuSeparator />
						<ContextMenuItem disabled className="text-muted-foreground italic">
							{t('common.mail.noLabelsAvailable')}
						</ContextMenuItem>
					</ContextMenuSubContent>
				</ContextMenuSub> */}
      </ContextMenuContent>
    </ContextMenu>
  );
}
