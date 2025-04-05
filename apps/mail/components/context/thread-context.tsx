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
  Trash,
} from 'lucide-react';
import { moveThreadsTo, ThreadDestination } from '@/lib/thread-actions';
import { useSearchValue } from '@/hooks/use-search-value';
import { useThreads } from '@/hooks/use-threads';
import { LABELS, FOLDERS } from '@/lib/utils';
import { useStats } from '@/hooks/use-stats';
import { useParams } from 'next/navigation';
import { useMail } from '../mail/use-mail';
import { useTranslations } from 'use-intl';
import { type ReactNode } from 'react';

interface EmailAction {
  id: string;
  label: string | ReactNode;
  icon?: ReactNode;
  shortcut?: string;
  action: () => () => Promise<void>;
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
	refreshCallback?: () => void;
}

export function ThreadContextMenu({
  children,
  emailId,
  threadId = emailId,
  isInbox = true,
  isSpam = false,
  isSent = false,
  refreshCallback,
}: EmailContextMenuProps) {
  const { folder } = useParams<{ folder: string }>();
  const [mail, setMail] = useMail();
  const { mutate, isLoading, isValidating } = useThreads();
  const currentFolder = folder ?? '';
	const isArchiveFolder = currentFolder === FOLDERS.ARCHIVE;
  const { mutate: mutateStats } = useStats();
  const t = useTranslations();

	const noopAction = () => async () => {
		console.log('Action will be implemented later');
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
			else if (from && !to) destination = FOLDERS.ARCHIVE;

			return moveThreadsTo({
				threadIds: targets,
				currentFolder: currentFolder,
				destination
			}).then(async () => {
        await Promise.all([mutate(), mutateStats()])
        setMail({ ...mail, bulkSelected: [] });
      });
		} catch (error) {
			console.error(`Error moving ${threadId ? 'email' : 'thread'}`, error);
		}
	};

	const primaryActions: EmailAction[] = [
		{
			id: 'reply',
			label: t('common.mail.reply'),
			icon: <Reply className="mr-2.5 h-4 w-4" />,
			shortcut: 'R',
			action: noopAction,
			disabled: true, // TODO: Reply functionality to be implemented
		},
		{
			id: 'reply-all',
			label: t('common.mail.replyAll'),
			icon: <ReplyAll className="mr-2.5 h-4 w-4" />,
			shortcut: '⇧R',
			action: noopAction,
			disabled: true, // TODO: Reply All functionality to be implemented
		},
		{
			id: 'forward',
			label: t('common.mail.forward'),
			icon: <Forward className="mr-2.5 h-4 w-4" />,
			shortcut: 'F',
			action: noopAction,
			disabled: true, // TODO: Forward functionality to be implemented
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
      ];
    }

    if (isSent) {
      return [
        {
          id: 'archive',
          label: t('common.mail.archive'),
          icon: <Archive className="mr-2.5 h-4 w-4" />,
          shortcut: 'E',
          action: handleMove(LABELS.SENT, ''),
          disabled: false,
        },
      ];
    }

    return [
      {
        id: 'archive',
        label: t('common.mail.archive'),
        icon: <Archive className="mr-2.5 h-4 w-4" />,
        shortcut: 'E',
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
    ];
  };

  const moveActions: EmailAction[] = [
    {
      id: 'move-to-trash',
      label: t('common.mail.moveToTrash'),
      icon: <Trash className="mr-2.5 h-4 w-4" />,
      action: noopAction,
      disabled: true, // TODO: Move to trash functionality to be implemented
    },
  ];

  const otherActions: EmailAction[] = [
    {
      id: 'mark-unread',
      label: t('common.mail.markAsUnread'),
      icon: <Mail className="mr-2.5 h-4 w-4" />,
      shortcut: 'U',
      action: noopAction,
      disabled: true, // TODO: Mark as unread functionality to be implemented
    },
    {
      id: 'star',
      label: t('common.mail.addStar'),
      icon: <Star className="mr-2.5 h-4 w-4" />,
      shortcut: 'S',
      action: noopAction,
      disabled: true, // TODO: Star functionality to be implemented
    },
    {
      id: 'mute',
      label: t('common.mail.muteThread'),
      icon: <BellOff className="mr-2.5 h-4 w-4" />,
      action: noopAction,
      disabled: true, // TODO: Mute functionality to be implemented
    },
  ];

  const renderAction = (action: EmailAction) => {
    return (
      <ContextMenuItem
        key={action.id}
        onClick={() => action.action()}
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
			<ContextMenuTrigger disabled={isLoading || isValidating} className="w-full">{children}</ContextMenuTrigger>
			<ContextMenuContent className="w-56" onContextMenu={(e) => e.preventDefault()}>
				{primaryActions.map(renderAction)}

        <ContextMenuSeparator />

        {getActions().map(renderAction as any)}
        {moveActions.filter((action) => action.id !== 'move-to-spam').map(renderAction)}

        <ContextMenuSeparator />

        {otherActions.map(renderAction)}

        <ContextMenuSeparator />

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
				</ContextMenuSub>
			</ContextMenuContent>
		</ContextMenu>
	);
}
