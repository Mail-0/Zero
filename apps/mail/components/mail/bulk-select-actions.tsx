import React from 'react';
import { Button } from '@/components/ui/button';
import { Archive, ArchiveX, Trash } from 'lucide-react';
import { useMail } from './use-mail';
import { useParams } from 'react-router';
import { useOptimisticActions } from '@/hooks/use-optimistic-actions';
import { type ThreadDestination } from '@/lib/thread-actions';

const LABELS = {
  SPAM: 'spam',
  TRASH: 'bin',
};

export function BulkSelectActions() {
  const [mail, setMail] = useMail();
  const { folder } = useParams<{ folder?: string }>();
  const { optimisticMoveThreadsTo } = useOptimisticActions();

  const handleMove = (to: ThreadDestination) => () => {
    if (mail.bulkSelected.length === 0) return;
    // Assume we move from the current folder. Default to 'inbox' if no folder is present.
    optimisticMoveThreadsTo(mail.bulkSelected, folder || 'inbox', to);
    // Clear selection after action
    setMail((prev) => ({ ...prev, selected: null, bulkSelected: [] }));
  };

  if (mail.bulkSelected.length === 0) {
    return null;
  }

  // Simplified actions based on your feedback.
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
        >
          {action.icon}
          <span className="sr-only">{action.label}</span>
        </Button>
      ))}
    </div>
  );
} 