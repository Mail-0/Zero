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
} from "lucide-react";
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
} from "../ui/context-menu";
import { useParams, useRouter } from "next/navigation";
import { ReactNode } from "react";
import { useMailMutation } from "@/hooks/use-mail-mutation";
import { toast } from "sonner";

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
  children: React.ReactNode;
  emailId: string;
  threadId?: string;
  hasInboxLabel?: boolean;
  hasSpamLabel?: boolean;
  hasSentLabel?: boolean;
  refreshCallback?: () => void;
}

export function EmailContextMenu({
  children,
  emailId,
  threadId = emailId,
  hasInboxLabel = true,
  hasSpamLabel = false,
  hasSentLabel = false,
  refreshCallback,
}: EmailContextMenuProps) {
  const params = useParams();
  const currentFolder = typeof params?.folder === 'string' ? params.folder : '';
  const isArchiveFolder = currentFolder === 'archive';
  const { archiveMail, moveToSpam, moveToInbox } = useMailMutation(currentFolder);

  const noopAction = () => {
    console.log('Action will be implemented later');
  };

  const handleArchive = async () => {
    try {
      const targetId = threadId ? `thread:${threadId}` : emailId;
      console.log(`🗃️ EmailContextMenu: Archiving ${threadId ? 'thread' : 'email'}: ${targetId}`);
      
      const success = await archiveMail(targetId);
      if (success) {
        toast.success(`${threadId ? 'Email' : 'Thread'} archived`);
        if (refreshCallback) refreshCallback();
      } else {
        throw new Error(`Failed to archive ${threadId ? 'email' : 'thread'}`);
      }
    } catch (error) {
      console.error(`Error archiving ${threadId ? 'email' : 'thread'}:`, error);
      toast.error(`Error archiving ${threadId ? 'email' : 'thread'}`);
    }
  };

  const handleMoveToSpam = async () => {
    try {
      const targetId = threadId ? `thread:${threadId}` : emailId;
      console.log(`EmailContextMenu: Moving ${threadId ? 'email' : 'thread'} to spam: ${targetId}`);
      
      const success = await moveToSpam(targetId);
      if (success) {
        toast.success(`${threadId ? 'Email' : 'Thread'} marked as spam`);
        if (refreshCallback) refreshCallback();
      } else {
        throw new Error(`Failed to mark ${threadId ? 'email' : 'thread'} as spam`);
      }
    } catch (error) {
      console.error(`Error marking ${threadId ? 'email' : 'thread'} as spam:`, error);
      toast.error(`Error marking ${threadId ? 'email' : 'thread'} as spam`);
    }
  };

  const handleMoveToInbox = async () => {
    try {
      const targetId = threadId ? `thread:${threadId}` : emailId;
      console.log(`EmailContextMenu: Moving ${threadId ? 'email' : 'thread'} to inbox: ${targetId}`);
      
      const success = await moveToInbox(targetId);
      if (success) {
        toast.success(`${threadId ? 'Email' : 'Thread'} moved to inbox`);
        if (refreshCallback) refreshCallback();
      } else {
        throw new Error(`Failed to move ${threadId ? 'email' : 'thread'} to inbox`);
      }
    } catch (error) {
      console.error(`Error moving ${threadId ? 'email' : 'thread'} to inbox:`, error);
      toast.error(`Error moving ${threadId ? 'email' : 'thread'} to inbox`);
    }
  };

  const primaryActions: EmailAction[] = [
    {
      id: "reply",
      label: "Reply",
      icon: <Reply className="mr-2.5 h-4 w-4" />,
      shortcut: "R",
      action: noopAction,
      disabled: true, // TODO: Reply functionality to be implemented
    },
    {
      id: "reply-all",
      label: "Reply All",
      icon: <ReplyAll className="mr-2.5 h-4 w-4" />,
      shortcut: "⇧R",
      action: noopAction,
      disabled: true, // TODO: Reply All functionality to be implemented
    },
    {
      id: "forward",
      label: "Forward",
      icon: <Forward className="mr-2.5 h-4 w-4" />,
      shortcut: "F",
      action: noopAction,
      disabled: true, // TODO: Forward functionality to be implemented
    },
  ];

  const getActions = () => {
    if (hasSpamLabel) {
      return [
        {
          id: "move-to-inbox",
          label: "Move to Inbox",
          icon: <Inbox className="mr-2.5 h-4 w-4" />,
          action: handleMoveToInbox,
          disabled: false,
        }
      ];
    }
    
    if (isArchiveFolder || !hasInboxLabel) {
      return [
        {
          id: "move-to-inbox",
          label: "Move to Inbox",
          icon: <Inbox className="mr-2.5 h-4 w-4" />,
          action: handleMoveToInbox,
          disabled: false,
        }
      ];
    }
    
    if (hasSentLabel) {
      return [
        {
          id: "archive",
          label: "Archive",
          icon: <Archive className="mr-2.5 h-4 w-4" />,
          shortcut: "E",
          action: handleArchive,
          disabled: false,
        }
      ];
    }
    
    return [
      {
        id: "archive",
        label: "Archive",
        icon: <Archive className="mr-2.5 h-4 w-4" />,
        shortcut: "E",
        action: handleArchive,
        disabled: false,
      },
      {
        id: "move-to-spam",
        label: "Move to Spam",
        icon: <ArchiveX className="mr-2.5 h-4 w-4" />,
        action: handleMoveToSpam,
        disabled: !hasInboxLabel,
      }
    ];
  };

  const moveActions: EmailAction[] = [
    {
      id: "move-to-trash",
      label: "Move to Trash",
      icon: <Trash className="mr-2.5 h-4 w-4" />,
      action: noopAction,
      disabled: true, // TODO: Move to trash functionality to be implemented
    },
  ];

  const otherActions: EmailAction[] = [
    {
      id: "mark-unread",
      label: "Mark as Unread",
      icon: <Mail className="mr-2.5 h-4 w-4" />,
      shortcut: "U",
      action: noopAction,
      disabled: true, // TODO: Mark as unread functionality to be implemented
    },
    {
      id: "star",
      label: "Add Star",
      icon: <Star className="mr-2.5 h-4 w-4" />,
      shortcut: "S",
      action: noopAction,
      disabled: true, // TODO: Star functionality to be implemented
    },
    {
      id: "mute",
      label: "Mute Thread",
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
      <ContextMenuTrigger className="w-full">{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {primaryActions.map(renderAction)}
        
        <ContextMenuSeparator />
        
        {getActions().map(renderAction)}
        {moveActions.filter(action => action.id !== 'move-to-spam').map(renderAction)}
        
        <ContextMenuSeparator />
        
        {otherActions.map(renderAction)}
        
        <ContextMenuSeparator />
        
        <ContextMenuSub>
          <ContextMenuSubTrigger className="font-normal">
            <Tag className="mr-2.5 h-4 w-4" />
            Labels
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem className="font-normal">
              <MailPlus className="mr-2.5 h-4 w-4" />
              Create New Label
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem disabled className="italic text-muted-foreground">
              No labels available
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  );
} 