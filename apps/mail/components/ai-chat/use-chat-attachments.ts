import { useActiveConnection } from '@/hooks/use-connections';
import { useCallback, useMemo, useState } from 'react';
import type { ChatAttachment } from './chat-parts';
import { toast } from 'sonner';

export type PendingAttachment = {
  localId: string;
  name: string;
  size: number;
  contentType: string;
  status: 'uploading' | 'ready';
  url?: string;
  /** Local object URL so image thumbnails show before the upload finishes. */
  previewUrl?: string;
};

export type AttachmentSnapshot = PendingAttachment[];

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 10;

/** Upload state for the chat composer's attachments. */
export function useChatAttachments() {
  const { data: activeConnection } = useActiveConnection();
  const [items, setItems] = useState<PendingAttachment[]>([]);

  const upload = useCallback(
    async (files: File[]) => {
      const connectionId = activeConnection?.id;
      if (!connectionId || files.length === 0) return;

      const accepted = files.slice(0, Math.max(0, MAX_FILES - items.length));
      if (accepted.length < files.length) toast.error(`You can attach up to ${MAX_FILES} files.`);

      for (const file of accepted) {
        if (file.size > MAX_BYTES) {
          toast.error(`"${file.name}" is larger than 10 MB.`);
          continue;
        }
        const localId = crypto.randomUUID();
        setItems((current) => [
          ...current,
          {
            localId,
            name: file.name,
            size: file.size,
            contentType: file.type || 'application/octet-stream',
            status: 'uploading',
            previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
          },
        ]);

        const body = new FormData();
        body.set('connectionId', String(connectionId));
        body.set('file', file);
        try {
          const res = await fetch(
            `${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/chat-attachments`,
            {
              method: 'POST',
              body,
              credentials: 'include',
            },
          );
          const json = (await res.json().catch(() => ({}))) as {
            url?: string;
            contentType?: string;
            error?: string;
          };
          if (!res.ok || !json.url)
            throw new Error(json.error ?? `Couldn't upload "${file.name}".`);
          setItems((current) =>
            current.map((item) =>
              item.localId === localId
                ? {
                    ...item,
                    status: 'ready',
                    url: json.url,
                    contentType: json.contentType ?? item.contentType,
                  }
                : item,
            ),
          );
        } catch (error) {
          setItems((current) => current.filter((item) => item.localId !== localId));
          toast.error(error instanceof Error ? error.message : `Couldn't upload "${file.name}".`);
        }
      }
    },
    [activeConnection?.id, items.length],
  );

  const remove = useCallback((localId: string) => {
    setItems((current) => current.filter((item) => item.localId !== localId));
  }, []);

  const snapshot = useCallback((): AttachmentSnapshot => items, [items]);
  const restore = useCallback((next: AttachmentSnapshot) => setItems(next), []);
  const reset = useCallback(() => setItems([]), []);

  const isUploading = items.some((item) => item.status === 'uploading');
  const attachments = useMemo(() => toChatAttachments(items), [items]);

  return { items, attachments, isUploading, upload, remove, reset, snapshot, restore };
}

export function toChatAttachments(items: PendingAttachment[]): ChatAttachment[] {
  return items
    .filter((item) => item.status === 'ready' && item.url)
    .map((item) => ({ name: item.name, contentType: item.contentType, url: item.url! }));
}

export type ChatAttachments = ReturnType<typeof useChatAttachments>;
