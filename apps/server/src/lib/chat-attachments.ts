import { parseFileToMarkdown } from './context-dev';
import { env } from '../env';

/**
 * Files attached to AI chat messages. Stored in R2 under the mailbox
 * (connection) they were uploaded to, so the chat agent for that mailbox is
 * the only one that can resolve them.
 *
 * Images go to the model as-is. Everything else is converted to Markdown once
 * at upload time (context.dev Parse) and stored alongside the original.
 */

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_MARKDOWN_CHARS = 100_000;
const PREFIX = 'chat-attachments';

const NATIVE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const TEXT_TYPES = new Set(['text/plain', 'text/markdown', 'text/csv', 'application/json']);
const PARSEABLE_EXTENSIONS = new Set([
  'pdf',
  'docx',
  'doc',
  'xlsx',
  'xls',
  'pptx',
  'ppt',
  'rtf',
  'html',
  'htm',
  'csv',
  'tsv',
  'txt',
  'md',
  'markdown',
  'json',
  'xml',
  'yaml',
  'yml',
]);

export type StoredAttachment = { name: string; contentType: string; size: number; url: string };

const key = (connectionId: string, id: string) => `${PREFIX}/${connectionId}/${id}`;
const markdownKey = (connectionId: string, id: string) => `${key(connectionId, id)}.md`;

export const attachmentUrl = (connectionId: string, id: string) =>
  `${env.VITE_PUBLIC_BACKEND_URL}/api/chat-attachments/${connectionId}/${id}`;

const extension = (name: string) =>
  name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';

export function isSupportedAttachment(file: File): boolean {
  return (
    NATIVE_IMAGE_TYPES.has(file.type) ||
    TEXT_TYPES.has(file.type) ||
    file.type.startsWith('text/') ||
    PARSEABLE_EXTENSIONS.has(extension(file.name))
  );
}

export async function storeAttachment(connectionId: string, file: File): Promise<StoredAttachment> {
  const id = crypto.randomUUID();
  const bytes = await file.arrayBuffer();
  const contentType = file.type || 'application/octet-stream';

  let markdown: string | null = null;
  if (!NATIVE_IMAGE_TYPES.has(contentType)) {
    markdown =
      TEXT_TYPES.has(contentType) || contentType.startsWith('text/')
        ? new TextDecoder().decode(bytes)
        : await parseFileToMarkdown(bytes, file.name, contentType);
    markdown = markdown.slice(0, MAX_MARKDOWN_CHARS);
  }

  const metadata = { name: file.name };
  await Promise.all([
    env.THREADS_BUCKET.put(key(connectionId, id), bytes, {
      httpMetadata: { contentType },
      customMetadata: metadata,
    }),
    markdown !== null &&
      env.THREADS_BUCKET.put(markdownKey(connectionId, id), markdown, {
        httpMetadata: { contentType: 'text/markdown' },
      }),
  ]);

  return { name: file.name, contentType, size: file.size, url: attachmentUrl(connectionId, id) };
}

export async function readAttachment(connectionId: string, id: string) {
  return env.THREADS_BUCKET.get(key(connectionId, id));
}

type Attachment = { name?: string; contentType?: string; url: string };

const ID_PATTERN = /^[0-9a-f-]{36}$/;

/**
 * Resolves a message's attachments to what the model reads: images become data
 * URLs, documents become their Markdown as a text attachment. Only attachments
 * belonging to `connectionId` are resolved; anything else is dropped, so a
 * client can't make the agent fetch arbitrary URLs or another mailbox's files.
 */
export async function resolveAttachmentsForModel(
  connectionId: string,
  attachments: Attachment[],
): Promise<Attachment[]> {
  const prefix = attachmentUrl(connectionId, '');
  const resolved = await Promise.all(
    attachments.map(async (attachment): Promise<Attachment | null> => {
      if (!attachment.url.startsWith(prefix)) return null;
      const id = attachment.url.slice(prefix.length);
      if (!ID_PATTERN.test(id)) return null;
      const name = attachment.name ?? 'attachment';

      if (attachment.contentType && NATIVE_IMAGE_TYPES.has(attachment.contentType)) {
        const object = await readAttachment(connectionId, id);
        if (!object) return null;
        const base64 = bytesToBase64(new Uint8Array(await object.arrayBuffer()));
        return {
          name,
          contentType: attachment.contentType,
          url: `data:${attachment.contentType};base64,${base64}`,
        };
      }

      const markdown = await env.THREADS_BUCKET.get(markdownKey(connectionId, id));
      if (!markdown) return null;
      const text = `<attachment name="${name.replace(/"/g, "'")}">\n${await markdown.text()}\n</attachment>`;
      return {
        name,
        contentType: 'text/plain',
        url: `data:text/plain;base64,${bytesToBase64(new TextEncoder().encode(text))}`,
      };
    }),
  );
  return resolved.filter((a): a is Attachment => a !== null);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Attachment ids referenced in serialized messages for this mailbox. */
export function referencedAttachmentIds(connectionId: string, ...texts: string[]): Set<string> {
  const pattern = new RegExp(`/api/chat-attachments/${connectionId}/([0-9a-f-]{36})`, 'g');
  const ids = new Set<string>();
  for (const text of texts) for (const match of text.matchAll(pattern)) ids.add(match[1]!);
  return ids;
}

/** Deletes attachments (original + Markdown) by id. */
export async function deleteAttachments(connectionId: string, ids: Iterable<string>) {
  const keys = [...ids].flatMap((id) => [key(connectionId, id), markdownKey(connectionId, id)]);
  for (let i = 0; i < keys.length; i += 1000) {
    await env.THREADS_BUCKET.delete(keys.slice(i, i + 1000));
  }
}

async function listAttachments(connectionId: string) {
  const prefix = `${PREFIX}/${connectionId}/`;
  const objects: { id: string; uploaded: Date }[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.THREADS_BUCKET.list({ prefix, cursor, limit: 1000 });
    for (const object of page.objects) {
      const id = object.key.slice(prefix.length).replace(/\.md$/, '');
      if (ID_PATTERN.test(id)) objects.push({ id, uploaded: object.uploaded });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return objects;
}

/**
 * Deletes attachments no conversation references. Files uploaded within
 * `graceMs` are kept: they may still be in the composer or a queued message.
 */
export async function sweepOrphanedAttachments(
  connectionId: string,
  referenced: Set<string>,
  graceMs: number,
): Promise<number> {
  const cutoff = Date.now() - graceMs;
  const orphans = new Set<string>();
  for (const { id, uploaded } of await listAttachments(connectionId)) {
    if (!referenced.has(id) && uploaded.getTime() < cutoff) orphans.add(id);
  }
  await deleteAttachments(connectionId, orphans);
  return orphans.size;
}

/** Deletes every attachment for a mailbox (e.g. when it's removed). */
export async function deleteAllAttachments(connectionId: string) {
  await deleteAttachments(
    connectionId,
    new Set((await listAttachments(connectionId)).map((o) => o.id)),
  );
}

/** Drops a mailbox's AI chat history and attachments. Never throws. */
export async function clearMailboxChatData(connectionId: string) {
  try {
    const agent = env.ZERO_AGENT.get(env.ZERO_AGENT.idFromName(connectionId));
    await agent.setName(connectionId);
    await agent.clearChatData();
  } catch (error) {
    console.warn('[chat] clearing chat data failed; deleting attachments directly', error);
    await deleteAllAttachments(connectionId).catch(() => {});
  }
}
