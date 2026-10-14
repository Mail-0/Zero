import { ArrowUp, Clock, Pencil, X } from 'lucide-react';
import type { FocusEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export type QueuedMessageItem = { id: string; preview: string; attachmentCount: number };

const MAX_VISIBLE_STACK_CARDS = 3;
const COLLAPSED_STACK_OFFSET_PX = 8;
const PREVIEW_STACK_OFFSET_PX = 13;
const STACK_SCALE_STEP = 0.05;

/**
 * Orchid's queued-message stack: the next message as a card with the rest
 * fanned out behind it. Hovering above it peeks a "+N" badge that expands the
 * full list. Each card can be dismissed, edited or sent now.
 */
export function QueuedMessageStack({
  items,
  onDismiss,
  onEdit,
  onSendNow,
}: {
  items: QueuedMessageItem[];
  onDismiss: (id: string) => void;
  onEdit: (id: string) => void;
  onSendNow: (id: string) => void;
}) {
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (items.length <= 1) {
      setIsExpanded(false);
      setIsPreviewing(false);
    }
  }, [items.length]);

  if (items.length === 0) return null;

  const rowProps = { onDismiss, onEdit, onSendNow };

  if (isExpanded) {
    return (
      <div className="flex w-full flex-col gap-1.5">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="text-copy-sm text-neutral-subtle hover:text-neutral hover:bg-surface-strong cursor-pointer rounded-md px-2 py-0.5 transition-colors"
          >
            Collapse
          </button>
        </div>
        {items.map((item) => (
          <QueuedMessageRow key={item.id} item={item} {...rowProps} />
        ))}
      </div>
    );
  }

  const stacked = items.slice(0, MAX_VISIBLE_STACK_CARDS);
  const canExpand = items.length > 1;
  const offset = isPreviewing ? PREVIEW_STACK_OFFSET_PX : COLLAPSED_STACK_OFFSET_PX;
  const peekHeight = 40 + Math.max(0, stacked.length - 1) * PREVIEW_STACK_OFFSET_PX;
  const leave = (setter: (v: boolean) => void) => (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setter(false);
  };

  return (
    <div
      className="relative w-full"
      style={{ marginTop: (stacked.length - 1) * offset }}
      onMouseEnter={() => canExpand && setIsPreviewing(true)}
      onMouseLeave={() => setIsPreviewing(false)}
    >
      {canExpand && (
        <div
          className="absolute inset-x-0 bottom-full z-20 flex items-end justify-center py-1"
          style={{ height: peekHeight }}
          onFocusCapture={() => setIsPreviewing(true)}
          onBlurCapture={leave(setIsPreviewing)}
        >
          <button
            type="button"
            aria-label={`Show ${items.length - 1} more queued messages`}
            onClick={() => {
              setIsExpanded(true);
              setIsPreviewing(false);
            }}
            className={cn(
              'text-copy-sm text-neutral-subtle bg-surface border-neutral ease-out-expo grid size-7 cursor-pointer place-items-center rounded-full border-2 transition-[transform,opacity] duration-500 select-none',
              isPreviewing
                ? 'translate-y-0 scale-100 opacity-100'
                : 'translate-y-2 scale-50 opacity-0',
            )}
          >
            +{items.length - 1}
          </button>
        </div>
      )}
      <div className="relative">
        {stacked.map((item, index) => {
          const isPrimary = index === 0;
          return (
            <div
              key={item.id}
              className={isPrimary ? 'relative' : 'pointer-events-none absolute inset-x-0 bottom-0'}
              style={{ zIndex: stacked.length - index }}
            >
              <div
                className={cn(
                  !isPrimary && 'ease-out-expo origin-top transition-transform duration-700',
                )}
                style={
                  isPrimary
                    ? undefined
                    : {
                        transform: `scale(${1 - index * STACK_SCALE_STEP}) translateY(${-index * offset}px)`,
                        transitionDelay: `${index * 40}ms`,
                      }
                }
              >
                <QueuedMessageRow item={item} {...rowProps} previewOnly={!isPrimary} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QueuedMessageRow({
  item,
  onDismiss,
  onEdit,
  onSendNow,
  previewOnly = false,
}: {
  item: QueuedMessageItem;
  onDismiss: (id: string) => void;
  onEdit: (id: string) => void;
  onSendNow: (id: string) => void;
  previewOnly?: boolean;
}) {
  return (
    <div className="group/queued bg-surface/95 border-neutral-subtle flex items-center gap-2 overflow-hidden rounded-[14px] border py-1 pr-1 pl-2.5 shadow-xs backdrop-blur-sm">
      <Clock className="text-neutral-subtle size-3.5 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        <span className="text-copy text-neutral truncate">{item.preview}</span>
        {item.attachmentCount > 0 && (
          <span className="text-copy-sm text-neutral-subtle truncate">
            {item.attachmentCount} attachment{item.attachmentCount === 1 ? '' : 's'}
          </span>
        )}
      </div>
      {!previewOnly && (
        <div className="flex shrink-0 items-center">
          <RowButton
            label="Dismiss queued message"
            onClick={() => onDismiss(item.id)}
            className="opacity-0 group-focus-within/queued:opacity-100 group-hover/queued:opacity-100"
          >
            <X className="size-3.5" />
          </RowButton>
          <RowButton label="Edit queued message" onClick={() => onEdit(item.id)}>
            <Pencil className="size-3.5" />
          </RowButton>
          <RowButton label="Send queued message now" onClick={() => onSendNow(item.id)}>
            <ArrowUp className="size-3.5" />
          </RowButton>
        </div>
      )}
    </div>
  );
}

function RowButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'text-neutral-subtle hover:text-neutral hover:bg-surface-strong grid size-7 cursor-pointer place-items-center rounded-lg transition-[colors,opacity]',
        className,
      )}
    >
      {children}
    </button>
  );
}
