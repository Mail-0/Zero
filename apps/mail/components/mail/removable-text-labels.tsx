import type { Label } from '@/types';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

const HIDDEN_LABELS = new Set(['unread', 'inbox']);

export function formatLabelDisplayName(name: string): string {
  return name.replace(/^category_/i, '').replace(/_/g, ' ');
}

type RemovableLabel = Pick<Label, 'id' | 'name'> & {
  color?: Label['color'];
};

interface RemovableTextLabelsProps {
  labels: RemovableLabel[];
  onRemove?: (label: RemovableLabel) => void;
  className?: string;
}

export function RemovableTextLabels({ labels, onRemove, className }: RemovableTextLabelsProps) {
  const visibleLabels = labels.filter(
    (label) => !HIDDEN_LABELS.has(label.name.toLowerCase()),
  );

  if (!visibleLabels.length) return null;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {visibleLabels.map((label) => (
        <span
          key={label.id}
          className="bg-subtleWhite text-foreground inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium"
          style={
            label.color
              ? {
                  backgroundColor: label.color.backgroundColor,
                  color: label.color.textColor,
                }
              : undefined
          }
        >
          <span>{formatLabelDisplayName(label.name)}</span>
          {onRemove ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                // TODO_doorman:implement_removal
                onRemove(label);
              }}
              className="hover:bg-foreground/10 rounded-full p-0.5"
              aria-label={`Remove ${formatLabelDisplayName(label.name)}`}
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}
