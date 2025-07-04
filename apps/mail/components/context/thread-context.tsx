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
  Forward,
  Inbox,
  MailOpen,
  Reply,
  ReplyAll,
  Star,
  StarOff,
  Tag,
  Trash,
} from 'lucide-react';
import { useOptimisticThreadState } from '@/components/mail/optimistic-thread-state';
import { useOptimisticActions } from '@/hooks/use-optimistic-actions';
import { type ThreadDestination } from '@/lib/thread-actions';
import { useThread, useThreads } from '@/hooks/use-threads';
import { ExclamationCircle, Mail } from '../icons/icons';
import { useMemo, type ReactNode } from 'react';
import { useLabels } from '@/hooks/use-labels';
import { FOLDERS, LABELS } from '@/lib/utils';
import { useMail } from '../mail/use-mail';
import { Checkbox } from '../ui/checkbox';
import { m } from '@/paraglide/messages';
import { useParams } from 'react-router';
import { useQueryState } from 'nuqs';
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
  threadId: string;
  isInbox?: boolean;
  isSpam?: boolean;
  isSent?: boolean;
  isBin?: boolean;
  refreshCallback?: () => void;
}

const LabelsList = ({ threadId, bulkSelected }: { threadId: string; bulkSelected: string[] }) => {
  const { data: labels } = useLabels();
  const { optimisticToggleLabel } = useOptimisticActions();
  const targetThreadIds = bulkSelected.length > 0 ? bulkSelected : [threadId];

  const { data: thread } = useThread(threadId);
  const rightClickedThreadOptimisticState = useOptimisticThreadState(threadId);

  if (!labels || !thread) return null;

  const handleToggleLabel = async (labelId: string) => {
    if (!labelId) return;

    let shouldAddLabel = false;

    let hasLabel = thread.labels?.map((label) => label.id).includes(labelId) || false;

    if (rightClickedThreadOptimisticState.optimisticLabels) {
      if (rightClickedThreadOptimisticState.optimisticLabels.addedLabelIds.includes(labelId)) {
        hasLabel = true;
      } else if (
        rightClickedThreadOptimisticState.optimisticLabels.removedLabelIds.includes(labelId)
      ) {
        hasLabel = false;
      }
    }

    shouldAddLabel = !hasLabel;

    optimisticToggleLabel(targetThreadIds, labelId, shouldAddLabel);
  };

  return (
    <>
      {labels
        .filter((label) => label.id)
        .map((label) => {
          let isChecked = label.id ? thread.labels?.map((l) => l.id).includes(label.id) : false;

          const checkboxOptimisticState = useOptimisticThreadState(threadId);
          if (label.id && checkboxOptimisticState.optimisticLabels) {
            if (checkboxOptimisticState.optimisticLabels.addedLabelIds.includes(label.id)) {
              isChecked = true;
            } else if (
              checkboxOptimisticState.optimisticLabels.removedLabelIds.includes(label.id)
            ) {
              isChecked = false;
            }
          }

          return (
            <ContextMenuItem
              key={label.id}
              onClick={() => label.id && handleToggleLabel(label.id)}
              className="font-normal"
            >
              <div className="flex items-center">
                <Checkbox checked={isChecked} className="mr-2 h-4 w-4" />
                {label.name}
              </div>
            </ContextMenuItem>
          );
        })}
    </>
  );
};

export function ThreadContextMenu({
  children,
  threadId,
  isInbox = true,
  isSpam = false,
  isSent = false,
  isBin = false,
}: EmailContextMenuProps) {
  const { folder } = useParams<{ folder: string }>();
  const [mail, setMail] = useMail();
  const [{ isLoading, isFetching }] = useThreads();
  const currentFolder = folder ?? '';
  const isArchiveFolder = currentFolder === FOLDERS.ARCHIVE;

  const [, setMode] = useQueryState('mode');
  const [, setThreadId] = useQueryState('threadId');
  const { data: threadData } = useThread(threadId);
  const optimisticState = useOptimisticThreadState(threadId);

  const isUnread = useMemo(() => {
    return threadData?.hasUnread ?? false;
  }, [threadData]);

  const isStarred = useMemo(() => {
    if (optimisticState.optimisticStarred !== null) {
      return optimisticState.optimisticStarred;
    }
    return threadData?.messages.some((message) =>
      message.tags?.some((tag) => tag.name.toLowerCase() === 'starred'),
    );
  }, [threadData, optimisticState.optimisticStarred]);

  const isImportant = useMemo(() => {
    if (optimisticState.optimisticImportant !== null) {
      return optimisticState.optimisticImportant;
    }
    return threadData?.messages.some((message) =>
      message.tags?.some((tag) => tag.name.toLowerCase() === 'important'),
    );
  }, [threadData]);

  const noopAction = () => async () => {
    toast.info(m['common.actions.featureNotImplemented']());
  };

  const { optimisticMoveThreadsTo } = useOptimisticActions();

  const handleMove = (from: string, to: string) => () => {
    try {
      let targets = [];
      if (mail.bulkSelected.length) {
        targets = mail.bulkSelected;
      } else {
        targets = [threadId];
      }

      let destination: ThreadDestination = null;
      if (to === LABELS.INBOX) destination = FOLDERS.INBOX;
      else if (to === LABELS.SPAM) destination = FOLDERS.SPAM;
      else if (to === LABELS.TRASH) destination = FOLDERS.BIN;
      else if (from && !to) destination = FOLDERS.ARCHIVE;

      optimisticMoveThreadsTo(targets, currentFolder, destination);

      if (mail.bulkSelected.length) {
        setMail({ ...mail, bulkSelected: [] });
      }
    } catch (error) {
      console.error(`Error moving ${threadId ? 'email' : 'thread'}:`, error);
      toast.error(m['common.actions.failedToMove']());
    }
  };

  const { optimisticToggleStar } = useOptimisticActions();

  const handleFavorites = () => {
    const targets = mail.bulkSelected.length ? mail.bulkSelected : [threadId];

    const newStarredState = !isStarred;

    optimisticToggleStar(targets, newStarredState);

    if (mail.bulkSelected.length) {
      setMail((prev) => ({ ...prev, bulkSelected: [] }));
    }
  };

  const { optimisticToggleImportant } = useOptimisticActions();

  const handleToggleImportant = () => {
    const targets = mail.bulkSelected.length ? mail.bulkSelected : [threadId];
    const newImportantState = !isImportant;

    // Use optimistic update with undo functionality
    optimisticToggleImportant(targets, newImportantState);

    // Clear bulk selection after action
    if (mail.bulkSelected.length) {
      setMail((prev) => ({ ...prev, bulkSelected: [] }));
    }
  };

  const { optimisticMarkAsRead, optimisticMarkAsUnread } = useOptimisticActions();

  const handleReadUnread = () => {
    const targets = mail.bulkSelected.length ? mail.bulkSelected : [threadId];
    const newReadState = isUnread; // If currently unread, mark as read (true)

    // Use optimistic update with undo functionality
    if (newReadState) {
      optimisticMarkAsRead(targets);
    } else if (!newReadState) {
      optimisticMarkAsUnread(targets);
    } else {
      toast.error('Failed to mark as read');
    }

    // Clear bulk selection after action
    if (mail.bulkSelected.length) {
      setMail((prev) => ({ ...prev, bulkSelected: [] }));
    }
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
      label: m['common.mail.reply'](),
      icon: <Reply className="mr-2.5 h-4 w-4 opacity-60" />,
      action: handleThreadReply,
      disabled: false,
    },
    {
      id: 'reply-all',
      label: m['common.mail.replyAll'](),
      icon: <ReplyAll className="mr-2.5 h-4 w-4 opacity-60" />,
      action: handleThreadReplyAll,
      disabled: false,
    },
    {
      id: 'forward',
      label: m['common.mail.forward'](),
      icon: <Forward className="mr-2.5 h-4 w-4 opacity-60" />,
      action: handleThreadForward,
      disabled: false,
    },
  ];
  const { optimisticDeleteThreads } = useOptimisticActions();

  const handleDelete = () => () => {
    const targets = mail.bulkSelected.length ? mail.bulkSelected : [threadId];

    // Use optimistic update with undo functionality
    optimisticDeleteThreads(targets, currentFolder);

    // Clear bulk selection after action
    if (mail.bulkSelected.length) {
      setMail((prev) => ({ ...prev, bulkSelected: [] }));
    }

    // Navigation removed to prevent route change on current thread action
    // if (!mail.bulkSelected.length && threadId) {
    //   navigate(`/mail/${currentFolder}`);
    // }
  };

  const getActions = () => {
    if (isSpam) {
      return [
        {
          id: 'move-to-inbox',
          label: m['common.mail.moveToInbox'](),
          icon: <Inbox className="mr-2.5 h-4 w-4 opacity-60" />,
          action: handleMove(LABELS.SPAM, LABELS.INBOX),
          disabled: false,
        },
        {
          id: 'move-to-bin',
          label: m['common.mail.moveToBin'](),
          icon: <Trash className="mr-2.5 h-4 w-4 opacity-60" />,
          action: handleMove(LABELS.SPAM, LABELS.TRASH),
          disabled: false,
        },
      ];
    }

    if (isBin) {
      return [
        {
          id: 'restore-from-bin',
          label: m['common.mail.restoreFromBin'](),
          icon: <Inbox className="mr-2.5 h-4 w-4 opacity-60" />,
          action: handleMove(LABELS.TRASH, LABELS.INBOX),
          disabled: false,
        },
        {
          id: 'delete-from-bin',
          label: m['common.mail.deleteFromBin'](),
          icon: <Trash className="mr-2.5 h-4 w-4 opacity-60" />,
          action: handleDelete(),
          disabled: true,
        },
      ];
    }

    if (isArchiveFolder || !isInbox) {
      return [
        {
          id: 'move-to-inbox',
          label: m['common.mail.unarchive'](),
          icon: <Inbox className="mr-2.5 h-4 w-4 opacity-60" />,
          action: handleMove('', LABELS.INBOX),
          disabled: false,
        },
        {
          id: 'move-to-bin',
          label: m['common.mail.moveToBin'](),
          icon: <Trash className="mr-2.5 h-4 w-4 opacity-60" />,
          action: handleMove('', LABELS.TRASH),
          disabled: false,
        },
      ];
    }

    if (isSent) {
      return [
        {
          id: 'archive',
          label: m['common.mail.archive'](),
          icon: <Archive className="mr-2.5 h-4 w-4 opacity-60" />,
          action: handleMove(LABELS.SENT, ''),
          disabled: false,
        },
        {
          id: 'move-to-bin',
          label: m['common.mail.moveToBin'](),
          icon: <Trash className="mr-2.5 h-4 w-4 opacity-60" />,
          action: handleMove(LABELS.SENT, LABELS.TRASH),
          disabled: false,
        },
      ];
    }

    return [
      {
        id: 'archive',
        label: m['common.mail.archive'](),
        icon: <Archive className="mr-2.5 h-4 w-4 opacity-60" />,
        action: handleMove(LABELS.INBOX, ''),
        disabled: false,
      },
      {
        id: 'move-to-spam',
        label: m['common.mail.moveToSpam'](),
        icon: <ArchiveX className="mr-2.5 h-4 w-4 opacity-60" />,
        action: handleMove(LABELS.INBOX, LABELS.SPAM),
        disabled: !isInbox,
      },
      {
        id: 'move-to-bin',
        label: m['common.mail.moveToBin'](),
        icon: <Trash className="mr-2.5 h-4 w-4 opacity-60" />,
        action: handleMove(LABELS.INBOX, LABELS.TRASH),
        disabled: false,
      },
    ];
  };

  const otherActions: EmailAction[] = [
    {
      id: 'toggle-read',
      label: isUnread ? m['common.mail.markAsRead']() : m['common.mail.markAsUnread'](),
      icon: !isUnread ? (
        <Mail className="mr-2.5 h-4 w-4 fill-[#9D9D9D] dark:fill-[#9D9D9D]" />
      ) : (
        <MailOpen className="mr-2.5 h-4 w-4 opacity-60" />
      ),
      action: handleReadUnread,
      disabled: false,
    },
    {
      id: 'toggle-important',
      label: isImportant
        ? m['common.mail.removeFromImportant']()
        : m['common.mail.markAsImportant'](),
      icon: <ExclamationCircle className="mr-2.5 h-4 w-4 opacity-60" />,
      action: handleToggleImportant,
    },
    {
      id: 'favorite',
      label: isStarred ? m['common.mail.removeFavorite']() : m['common.mail.addFavorite'](),
      icon: isStarred ? (
        <StarOff className="mr-2.5 h-4 w-4 opacity-60" />
      ) : (
        <Star className="mr-2.5 h-4 w-4 opacity-60" />
      ),
      action: handleFavorites,
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
      <ContextMenuTrigger disabled={isLoading || isFetching} className="w-full">
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent
        className="dark:bg-panelDark w-56 overflow-y-auto bg-white"
        onContextMenu={(e) => e.preventDefault()}
      >
        {primaryActions.map(renderAction)}

        <ContextMenuSeparator className="bg-[#E7E7E7] dark:bg-[#252525]" />

        <ContextMenuSub>
          <ContextMenuSubTrigger className="font-normal">
            <Tag className="mr-2.5 h-4 w-4 opacity-60" />
            {m['common.mail.labels']()}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="dark:bg-panelDark max-h-[520px] w-48 overflow-y-auto bg-white">
            <LabelsList threadId={threadId} bulkSelected={mail.bulkSelected} />
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator className="bg-[#E7E7E7] dark:bg-[#252525]" />

        {getActions().map(renderAction as any)}

        <ContextMenuSeparator className="bg-[#E7E7E7] dark:bg-[#252525]" />

        {otherActions.map(renderAction)}
      </ContextMenuContent>
    </ContextMenu>
  );
}
