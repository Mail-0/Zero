import React from 'react';
import { Button } from '@/components/ui/button';
import { Archive, ArchiveX, Trash } from 'lucide-react';
import { useMail } from './use-mail';
import { useParams } from 'react-router';
import { useOptimisticActions } from '@/hooks/use-optimistic-actions';
import { type ThreadDestination } from '@/lib/thread-actions';
import { FOLDERS, type Folder } from '@/lib/utils';
import { toast } from 'sonner';

export function BulkSelectActions() {
  const [mail, setMail] = useMail();
  const { folder: rawFolder } = useParams<{ folder?: string }>();
  const { optimisticMoveThreadsTo } = useOptimisticActions();

  const currentFolder: Folder =
    rawFolder && Object.values(FOLDERS).includes(rawFolder as Folder)
      ? (rawFolder as Folder)
      : FOLDERS.INBOX;

  const handleMove = (to: ThreadDestination) => () => {
    if (mail.bulkSelected.length === 0) return;

    try {
      optimisticMoveThreadsTo(mail.bulkSelected, currentFolder, to);
      setMail((prev) => ({ ...prev, selected: null, bulkSelected: [] }));
    } catch (error) {
      console.error(`Failed to ${to} emails:`, error);
      let errorMessage = 'Failed to move emails. Please try again.';
      if (to === 'archive') {
        errorMessage = 'Failed to archive emails. Please try again.';
      } else if (to === 'spam') {
        errorMessage = 'Failed to move emails to spam. Please try again.';
      } else if (to === 'bin') {
        errorMessage = 'Failed to move emails to bin. Please try again.';
      }
      toast.error(errorMessage);
    }
  };

  if (mail.bulkSelected.length === 0) {
    return null;
  }

  const actions = [
    {
      id: 'archive',
      label: 'Archive',
      icon: <Archive className="h-4 w-4" />,
      action: handleMove('archive'),
    },
    {
      id: 'move-to-spam',
      label: 'Move to Spam',
      icon: <ArchiveX className="h-4 w-4" />,
      action: handleMove('spam'),
    },
    {
      id: 'move-to-bin',
      label: 'Move to Bin',
      icon: <Trash className="h-4 w-4 text-red-500" />,
      action: handleMove('bin'),
    },
  ];

  return (
    <div className="flex items-center gap-1 rounded-full border bg-background p-1 shadow-md">
      {actions.map((action) => (
        <Button
          key={action.id}
          variant="ghost"
          size="icon"
          onClick={action.action}
          className="h-8 w-8 rounded-full"
          title={action.label}
          aria-label={action.label}
        >
          {action.icon}
          <span className="sr-only">{action.label}</span>
        </Button>
      ))}
    </div>
  );
} 