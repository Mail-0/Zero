import { ComposerAttachments, FileDropOverlay } from './attachments';
import type { PendingAttachment } from './use-chat-attachments';
import { useRef, useState, type ReactNode } from 'react';
import { Clock, Paperclip, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

const hasFiles = (event: React.DragEvent) => event.dataTransfer.types.includes('Files');

/**
 * Chat input chrome from Orchid: a subtle frame around a raised card holding
 * attachments and the input, with a footer for secondary actions (left) and
 * the primary action (right): Go, Queue while a reply is running, or Stop.
 */
export function ChatComposer({
  input,
  leading,
  attachments,
  onAddFiles,
  onRemoveAttachment,
  isLoading,
  hasContent,
  submitDisabled,
  onSubmit,
  onStop,
  className,
}: {
  input: ReactNode;
  leading?: ReactNode;
  attachments: PendingAttachment[];
  onAddFiles: (files: File[]) => void;
  onRemoveAttachment: (localId: string) => void;
  isLoading: boolean;
  /** The composer holds text or files. While loading, this turns Stop into Queue. */
  hasContent: boolean;
  submitDisabled: boolean;
  onSubmit: () => void;
  onStop: () => void;
  className?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const dragDepth = useRef(0);
  const showStop = isLoading && !hasContent;
  const showQueue = isLoading && hasContent;

  return (
    <div
      className={cn(
        'bg-surface-subtle relative w-full overflow-hidden rounded-xl p-0.5',
        className,
      )}
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragDepth.current++;
        setIsDragActive(true);
      }}
      onDragOver={(e) => hasFiles(e) && e.preventDefault()}
      onDragLeave={(e) => {
        if (!hasFiles(e)) return;
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setIsDragActive(false);
      }}
      onDropCapture={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.stopPropagation();
        dragDepth.current = 0;
        setIsDragActive(false);
        onAddFiles(Array.from(e.dataTransfer.files));
      }}
      onPasteCapture={(e) => {
        const files = Array.from(e.clipboardData.files);
        if (files.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        onAddFiles(files);
      }}
    >
      {isDragActive && <FileDropOverlay />}
      <div className="bg-surface border-neutral-subtle shadow-chat rounded-xl border">
        <ComposerAttachments items={attachments} onRemove={onRemoveAttachment} />
        <div className="px-3 pt-2.5 pb-2">{input}</div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onAddFiles(Array.from(e.target.files));
          e.target.value = '';
        }}
      />
      <div className="flex items-center justify-between p-1.5">
        <div className="flex items-center gap-1">
          <ComposerIconButton title="Attach files" onClick={() => fileInputRef.current?.click()}>
            <Paperclip className="size-4" />
          </ComposerIconButton>
          {leading}
        </div>
        {showStop ? (
          <ComposerButton onClick={onStop} title="Stop generating">
            <Square className="size-3 fill-current" />
            Stop
          </ComposerButton>
        ) : (
          <ComposerButton
            onClick={onSubmit}
            disabled={submitDisabled}
            title={showQueue ? 'Send after this reply' : 'Send'}
          >
            {showQueue && <Clock className="size-3.5" />}
            {showQueue ? 'Queue' : 'Go'}
            <span className="bg-surface-weak border-neutral text-neutral-weak text-copy-sm flex h-4 items-center rounded border px-1 shadow-xs">
              ↵
            </span>
          </ComposerButton>
        )}
      </div>
    </div>
  );
}

function ComposerButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'text-copy text-neutral bg-surface border-neutral flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border px-2 shadow-xs transition-colors select-none',
        'hover:bg-surface-weak disabled:hover:bg-surface active:shadow-none disabled:cursor-default disabled:opacity-50',
      )}
    >
      {children}
    </button>
  );
}

/** Low-emphasis icon button for the composer footer (voice, etc.). */
export function ComposerIconButton({
  children,
  onClick,
  title,
  pressed,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      className={cn(
        'text-neutral-weak hover:text-neutral hover:bg-surface-strong flex size-7 cursor-pointer items-center justify-center rounded-lg transition-colors',
        pressed && 'bg-surface-strong text-neutral',
      )}
    >
      {children}
    </button>
  );
}
