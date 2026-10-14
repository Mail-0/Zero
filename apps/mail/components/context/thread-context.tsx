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
  ExternalLink,
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
import { useMemo, type MouseEvent, type PointerEvent, type ReactNode, useState } from 'react';
import { useOptimisticThreadState } from '@/components/mail/optimistic-thread-state';
import { useOptimisticActions } from '@/hooks/use-optimistic-actions';
import { ExclamationCircle, Mail, Clock } from '../icons/icons';
import { SnoozeDialog } from '@/components/mail/snooze-dialog';
import { type ThreadDestination } from '@/lib/thread-actions';
import { useTRPC } from '@/providers/query-provider';
import { useMutation } from '@tanstack/react-query';
import { useThreadById } from '@/hooks/use-threads';
import { useLabels } from '@/hooks/use-labels';
import { FOLDERS, LABELS } from '@/lib/utils';
import { useMail } from '../mail/use-mail';
import { atom, useAtomValue } from 'jotai';
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
  const { userLabels: labels } = useLabels();
  const { optimisticToggleLabel } = useOptimisticActions();
  const targetThreadIds = bulkSelected.length > 0 ? bulkSelected : [threadId];

  const { data: thread } = useThreadById(threadId);
  const rightClickedThreadOptimisticState = useOptimisticThreadState(threadId);

  if (!labels || !thread) return null;

  const handleToggleLabel = (labelId: string) => {
    if (!labelId) return;

    // Determine current label state considering optimistic updates
    let hasLabel = thread!.labels?.some((l) => l.id === labelId) ?? false;

    if (rightClickedThreadOptimisticState.optimisticLabels) {
      if (rightClickedThreadOptimisticState.optimisticLabels.addedLabelIds.includes(labelId)) {
        hasLabel = true;
      } else if (
        rightClickedThreadOptimisticState.optimisticLabels.removedLabelIds.includes(labelId)
      ) {
        hasLabel = false;
      }
    }

    optimisticToggleLabel(targetThreadIds, labelId, !hasLabel);
  };

  return (
    <>
      {labels
        .filter((label) => label.id)
        .map((label) => {
          let isChecked = label.id
            ? (thread!.labels?.some((l) => l.id === label.id) ?? false)
            : false;

          if (rightClickedThreadOptimisticState.optimisticLabels) {
            if (
              rightClickedThreadOptimisticState.optimisticLabels.addedLabelIds.includes(label.id)
            ) {
              isChecked = true;
            } else if (
              rightClickedThreadOptimisticState.optimisticLabels.removedLabelIds.includes(label.id)
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

/**
 * Whether the current thread list is loading/refetching. Written once by MailList and read
 * by every row's context menu. (A per-row useIsFetching re-scanned the whole query cache for
 * every row on every cache event – ~40ms per thread open at 4x CPU throttle.)
 */
export const threadListFetchingAtom = atom(false);

/**
 * One context menu for the whole mail list. A Radix ContextMenu root per row cost ~20 extra
 * roots (context providers, state, handlers) on every mounted row. The right-clicked row is
 * resolved from the event target's `data-thread-id`; ThreadContextMenuItems (and everything
 * it subscribes to) only mounts while the menu is open.
 */
export function ThreadListContextMenu({
  children,
  isInbox = true,
  isSpam = false,
  isSent = false,
  isBin = false,
}: Omit<EmailContextMenuProps, 'threadId'>) {
  const isListFetching = useAtomValue(threadListFetchingAtom);
  const [targetThreadId, setTargetThreadId] = useState<string | null>(null);
  const [snoozeThreadId, setSnoozeThreadId] = useState<string | null>(null);

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-thread-id]');
    const id = row?.dataset.threadId;
    if (!id) {
      // Not on a row: skip the custom menu (preventDefault makes Radix ignore the event).
      event.preventDefault();
      return;
    }
    setTargetThreadId(id);
  };

  // Touch long-press opens from Radix's pointer timer, without a contextmenu event first.
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') return;
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-thread-id]');
    if (row?.dataset.threadId) setTargetThreadId(row.dataset.threadId);
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          disabled={isListFetching}
          className="flex h-full min-h-0 w-full flex-1 flex-col"
          onContextMenu={handleContextMenu}
          onPointerDown={handlePointerDown}
        >
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent
          className="dark:bg-panelDark w-56 overflow-y-auto bg-white"
          onContextMenu={(e) => e.preventDefault()}
        >
          {targetThreadId ? (
            <ThreadContextMenuItems
              key={targetThreadId}
              threadId={targetThreadId}
              isInbox={isInbox}
              isSpam={isSpam}
              isSent={isSent}
              isBin={isBin}
              onSnooze={() => setSnoozeThreadId(targetThreadId)}
            />
          ) : null}
        </ContextMenuContent>
      </ContextMenu>
      {snoozeThreadId ? (
        <ThreadSnoozeDialog threadId={snoozeThreadId} onClose={() => setSnoozeThreadId(null)} />
      ) : null}
    </>
  );
}

function ThreadSnoozeDialog({ threadId, onClose }: { threadId: string; onClose: () => void }) {
  const { folder } = useParams<{ folder: string }>();
  const [mail] = useMail();
  const { optimisticSnooze } = useOptimisticActions();

  const handleSnoozeConfirm = (wakeAt: Date) => {
    const targets = mail.bulkSelected.length ? mail.bulkSelected : [threadId];
    optimisticSnooze(targets, folder ?? '', wakeAt);
    onClose();
  };

  return (
    <SnoozeDialog
      open
      onOpenChange={(open) => !open && onClose()}
      onConfirm={handleSnoozeConfirm}
    />
  );
}

function ThreadContextMenuItems({
  threadId,
  isInbox,
  isSpam,
  isSent,
  isBin,
  onSnooze,
}: Omit<EmailContextMenuProps, 'children'> & { onSnooze: () => void }) {
  const { folder } = useParams<{ folder: string }>();
  const [mail, setMail] = useMail();
  const currentFolder = folder ?? '';
  const isArchiveFolder = currentFolder === FOLDERS.ARCHIVE;
  const isSnoozedFolder = currentFolder === FOLDERS.SNOOZED;
  const [, setMode] = useQueryState('mode');
  const [, setThreadId] = useQueryState('threadId');
  const { data: threadData } = useThreadById(threadId);
  const [, setActiveReplyId] = useQueryState('activeReplyId');
  const optimisticState = useOptimisticThreadState(threadId);
  const trpc = useTRPC();
  const {
    optimisticMoveThreadsTo,
    optimisticToggleStar,
    optimisticToggleImportant,
    optimisticMarkAsRead,
    optimisticMarkAsUnread,
    // optimisticDeleteThreads,
    optimisticUnsnooze,
  } = useOptimisticActions();
  const { mutateAsync: deleteThread } = useMutation(trpc.mail.delete.mutationOptions());

  const { isUnread, isStarred, isImportant } = useMemo(() => {
    const unread =
      optimisticState.optimisticRead !== null
        ? !optimisticState.optimisticRead
        : (threadData?.hasUnread ?? false);

    let starred;
    if (optimisticState.optimisticStarred !== null) {
      starred = optimisticState.optimisticStarred;
    } else {
      starred = threadData?.labels?.some((tag) => tag.id === 'STARRED') ?? false;
    }

    let important;
    if (optimisticState.optimisticImportant !== null) {
      important = optimisticState.optimisticImportant;
    } else {
      important = threadData?.messages.some((message) =>
        message.tags?.some((tag) => tag.name.toLowerCase() === 'important'),
      );
    }

    return { isUnread: unread, isStarred: starred, isImportant: important };
  }, [
    threadData,
    optimisticState.optimisticRead,
    optimisticState.optimisticStarred,
    optimisticState.optimisticImportant,
  ]);

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

  const handleFavorites = () => {
    const targets = mail.bulkSelected.length ? mail.bulkSelected : [threadId];

    const newStarredState = !isStarred;

    optimisticToggleStar(targets, newStarredState);

    if (mail.bulkSelected.length) {
      setMail((prev) => ({ ...prev, bulkSelected: [] }));
    }
  };

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

  const handleOpenInNewTab = () => {
    window.open(`/mail/${folder}?threadId=${threadId}`, '_blank');
  };

  const primaryActions: EmailAction[] = [
    {
      id: 'open-in-new-tab',
      label: m['common.mail.openInNewTab'](),
      icon: <ExternalLink className="mr-2.5 h-4 w-4" />,
      action: handleOpenInNewTab,
      disabled: false,
    },
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

  const handleDelete = () => () => {
    const targets = mail.bulkSelected.length ? mail.bulkSelected : [threadId];

    toast.promise(
      Promise.all(
        targets.map(async (id) => {
          return deleteThread({ id });
        }),
      ),
      {
        loading: 'Deleting...',
        success: 'Deleted',
        error: 'Failed to delete',
      },
    );
  };

  const getActions = (() => {
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
        },
      ];
    }

    if (isSnoozedFolder) {
      return [
        {
          id: 'unsnooze',
          label: 'Unsnooze',
          icon: <Inbox className="mr-2.5 h-4 w-4 opacity-60" />,
          action: () => {
            const targets = mail.bulkSelected.length ? mail.bulkSelected : [threadId];
            optimisticUnsnooze(targets, currentFolder);
            if (mail.bulkSelected.length) {
              setMail({ ...mail, bulkSelected: [] });
            }
          },
          disabled: false,
        },
        {
          id: 'move-to-bin',
          label: m['common.mail.moveToBin'](),
          icon: <Trash className="mr-2.5 h-4 w-4 opacity-60" />,
          action: handleMove(LABELS.SNOOZED, LABELS.TRASH),
          disabled: false,
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
  })();

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
      icon: <ExclamationCircle className="mr-2.5 h-4 w-4 fill-[#9D9D9D] dark:fill-[#9D9D9D]" />,
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
    {
      id: 'snooze',
      label: 'Snooze',
      icon: <Clock className="mr-2.5 h-4 w-4 opacity-60" />,
      action: onSnooze,
      disabled: false,
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
    <>
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

      {getActions.map(renderAction)}

      <ContextMenuSeparator className="bg-[#E7E7E7] dark:bg-[#252525]" />

      {otherActions.map(renderAction)}
    </>
  );
}
