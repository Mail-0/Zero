import { FileText, Image as ImageIcon, Paperclip, X } from 'lucide-react';
import type { PendingAttachment } from './use-chat-attachments';
import type { ChatAttachment } from './chat-parts';
import { ZeroMark } from './thinking';
import { cn } from '@/lib/utils';

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(1)} ${units[unit]}`;
}

const isImage = (contentType?: string) => !!contentType?.startsWith('image/');

/** Orchid's file chip: icon, name and size, with a remove button when editable. */
export function AttachmentChip({
  name,
  size,
  contentType,
  isPending,
  href,
  onRemove,
}: {
  name: string;
  size?: number;
  contentType?: string;
  isPending?: boolean;
  href?: string;
  onRemove?: () => void;
}) {
  const Icon = isImage(contentType) ? ImageIcon : FileText;
  const body = (
    <>
      {isPending ? (
        <ZeroMark className="text-neutral-subtle size-3 shrink-0 animate-spin" />
      ) : (
        <Icon className="text-neutral-subtle size-3.5 shrink-0" />
      )}
      <span className="text-copy-sm text-neutral min-w-0 truncate">{name}</span>
      {size !== undefined && (
        <span className="text-copy-sm text-neutral-subtle shrink-0 whitespace-nowrap">
          {formatFileSize(size)}
        </span>
      )}
    </>
  );
  const className = cn(
    'bg-surface-subtle group relative inline-flex h-7 max-w-[220px] items-center gap-1.5 rounded-md px-2 transition-colors duration-150 select-none',
    isPending ? 'cursor-default opacity-60' : 'hover:bg-surface-strong',
  );

  return (
    <div className={className}>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 items-center gap-1.5"
        >
          {body}
        </a>
      ) : (
        body
      )}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
          className="bg-surface border-neutral text-neutral-subtle hover:text-neutral absolute -top-1.5 -right-1.5 grid size-4 cursor-pointer place-items-center rounded-full border opacity-0 shadow-xs transition-opacity group-hover:opacity-100"
        >
          <X className="size-2.5" />
        </button>
      )}
    </div>
  );
}

/** The files waiting to be sent, inside the composer card. */
export function ComposerAttachments({
  items,
  onRemove,
}: {
  items: PendingAttachment[];
  onRemove: (localId: string) => void;
}) {
  return (
    <div
      className={cn(
        'ease-out-expo grid overflow-hidden transition-[grid-template-rows] duration-300',
        items.length ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div className="min-h-0">
        <div className="flex flex-wrap gap-1.5 px-2.5 pt-2.5">
          {items.map((item) =>
            item.previewUrl ? (
              <ImageThumb
                key={item.localId}
                src={item.previewUrl}
                name={item.name}
                isPending={item.status === 'uploading'}
                onRemove={() => onRemove(item.localId)}
              />
            ) : (
              <AttachmentChip
                key={item.localId}
                name={item.name}
                size={item.size}
                contentType={item.contentType}
                isPending={item.status === 'uploading'}
                onRemove={() => onRemove(item.localId)}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function ImageThumb({
  src,
  name,
  isPending,
  onRemove,
}: {
  src: string;
  name: string;
  isPending: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="group relative">
      <img
        src={src}
        alt={name}
        title={name}
        className={cn(
          'border-neutral-subtle size-12 rounded-lg border object-cover',
          isPending && 'opacity-50',
        )}
      />
      {isPending && (
        <div className="absolute inset-0 grid place-items-center">
          <ZeroMark className="text-neutral size-3.5 animate-spin" />
        </div>
      )}
      <button
        type="button"
        aria-label={`Remove ${name}`}
        onClick={onRemove}
        className="bg-surface border-neutral text-neutral-subtle hover:text-neutral absolute -top-1.5 -right-1.5 grid size-4 cursor-pointer place-items-center rounded-full border opacity-0 shadow-xs transition-opacity group-hover:opacity-100"
      >
        <X className="size-2.5" />
      </button>
    </div>
  );
}

/** Files on a sent message: images as thumbnails, other files as chips. */
export function MessageAttachments({ attachments }: { attachments: ChatAttachment[] }) {
  if (attachments.length === 0) return null;
  const images = attachments.filter((a) => isImage(a.contentType));
  const files = attachments.filter((a) => !isImage(a.contentType));

  return (
    <div className="flex flex-col items-end gap-1.5">
      {images.length > 0 && (
        <div className="flex flex-wrap justify-end gap-1.5">
          {images.map((image) => (
            <a
              key={image.url}
              href={image.url}
              target="_blank"
              rel="noopener noreferrer"
              className="border-neutral-subtle hover:border-neutral block overflow-hidden rounded-lg border transition-colors"
            >
              <img
                src={image.url}
                alt={image.name ?? 'Attachment'}
                className="max-h-40 max-w-[200px] object-contain"
              />
            </a>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap justify-end gap-1.5">
          {files.map((file) => (
            <AttachmentChip
              key={file.url}
              name={file.name ?? 'File'}
              contentType={file.contentType}
              href={file.url}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Shown over the composer while files are dragged onto it. */
export function FileDropOverlay() {
  return (
    <>
      <div className="bg-surface/70 pointer-events-none absolute inset-0 z-20 rounded-xl backdrop-blur-[1px]" />
      <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-4">
        <div className="bg-surface border-neutral-subtle flex items-center gap-2 rounded-full border px-3 py-2 shadow-lg">
          <Paperclip className="text-neutral size-3.5 shrink-0" />
          <span className="text-copy-sm text-neutral font-medium whitespace-nowrap">
            Drop to attach
          </span>
        </div>
      </div>
    </>
  );
}
