import { ParsedMessageSchema, type ParsedMessage } from '../types';
import type { IGetThreadResponse } from './driver/types';
import { z } from 'zod';

/**
 * What a mail-list row needs to render, without any message bodies.
 *
 * listThreads attaches one of these per thread so the list can paint a whole page from a
 * single request instead of one full `mail.get` (every message's HTML) per visible row.
 */
export const ThreadListSummarySchema = z.object({
  latest: ParsedMessageSchema,
  labels: z.array(z.object({ id: z.string(), name: z.string() })),
  hasUnread: z.boolean(),
  totalReplies: z.number(),
  hasDraft: z.boolean(),
  isGroupThread: z.boolean(),
});

export type ThreadListSummary = z.infer<typeof ThreadListSummarySchema>;

/**
 * Mirrors the client's derivation from `mail.get` (see useThreadById): `latest` is the last
 * non-draft message, a draft anywhere in the thread counts, and a thread is a "group" when
 * the latest message has more than one recipient. Returns null when there is nothing to show
 * yet (thread not imported), so the client falls back to fetching `mail.get` for that row.
 */
const stripBodies = (message: ParsedMessage): ParsedMessage => ({
  ...message,
  body: '',
  processedHtml: '',
  blobUrl: '',
  decodedBody: undefined,
  attachments: undefined,
});

export function toThreadListSummary(thread: IGetThreadResponse): ThreadListSummary | null {
  const latest = thread.latest ?? thread.messages.findLast((message) => message.isDraft !== true);
  if (!latest?.id) return null;

  const recipients =
    (latest.to?.length ?? 0) + (latest.cc?.length ?? 0) + (latest.bcc?.length ?? 0);

  return {
    latest: stripBodies(latest),
    labels: thread.labels,
    hasUnread: thread.hasUnread,
    totalReplies: thread.totalReplies,
    hasDraft: thread.messages.some((message) => message.isDraft === true),
    isGroupThread: recipients > 1,
  };
}

/**
 * Body-free snapshot written to the `threads` row whenever a thread is stored, so listing a
 * page doesn't read and parse every thread's full JSON (all message HTML) from R2.
 *
 * Only the parts that change when the thread's *content* changes are stored. Labels, unread
 * state and message deletions change independently (label store / outbox), so they are
 * re-applied from the label store on every read, exactly like getThreadFromDB does.
 */
export type StoredThreadSummary = {
  v: 1;
  /** Last non-draft message at write time, bodies stripped, original tags kept. */
  latest: ParsedMessage;
  messages: { id: string; isDraft: boolean }[];
};

export function toStoredThreadSummary(thread: IGetThreadResponse): StoredThreadSummary | null {
  const latest = thread.messages.findLast((message) => message.isDraft !== true);
  if (!latest?.id) return null;
  return {
    v: 1,
    latest: stripBodies(latest),
    messages: thread.messages.map((message) => ({
      id: message.id,
      isDraft: message.isDraft === true,
    })),
  };
}

export function parseStoredThreadSummary(json: unknown): StoredThreadSummary | null {
  if (typeof json !== 'string' || !json) return null;
  try {
    const parsed = JSON.parse(json) as StoredThreadSummary;
    return parsed?.v === 1 && parsed.latest?.id && Array.isArray(parsed.messages) ? parsed : null;
  } catch {
    return null;
  }
}

/** The label-store reads getThreadFromDB applies on top of stored thread content. */
export type ThreadLabelOverlay = {
  isThreadDeleted(threadId: string): boolean;
  isDeleted(messageId: string): boolean;
  messageLabels(messageId: string): string[] | undefined;
  threadLabels(threadId: string): string[];
};

/** Result of resolving a stored snapshot; `fallback` means "use the full R2 read". */
export type ResolvedThreadSummary =
  | { kind: 'summary'; summary: ThreadListSummary }
  | { kind: 'empty' }
  | { kind: 'fallback' };

/**
 * Equivalent of toThreadListSummary(getThreadFromDB(threadId, true)) using only the stored
 * snapshot plus the label store. Anything the snapshot can't answer exactly returns
 * `fallback` rather than guessing:
 * - the stored latest message was deleted (the real latest is an older message whose
 *   metadata isn't stored);
 * - the label store has no rows for the latest message yet (the full path hydrates them).
 */
export function resolveStoredThreadSummary(
  threadId: string,
  stored: StoredThreadSummary,
  overlay: ThreadLabelOverlay,
): ResolvedThreadSummary {
  // Deleted threads must never be served from a leftover snapshot.
  if (overlay.isThreadDeleted(threadId)) return { kind: 'empty' };

  const live = stored.messages.filter((message) => !overlay.isDeleted(message.id));
  const liveLatest = live.findLast((message) => !message.isDraft);
  if (!liveLatest) return { kind: 'empty' };
  if (liveLatest.id !== stored.latest.id) return { kind: 'fallback' };

  const latestLabels = overlay.messageLabels(stored.latest.id);
  if (!latestLabels) return { kind: 'fallback' };

  const latest: ParsedMessage = {
    ...stored.latest,
    unread: latestLabels.includes('UNREAD'),
    tags: latestLabels.map(
      (label) =>
        stored.latest.tags.find((tag) => tag.id === label) ?? {
          id: label,
          name: label,
          type: 'system',
        },
    ),
  };
  const threadLabels = overlay.threadLabels(threadId);
  const recipients =
    (latest.to?.length ?? 0) + (latest.cc?.length ?? 0) + (latest.bcc?.length ?? 0);

  return {
    kind: 'summary',
    summary: {
      latest,
      labels: threadLabels.map((id) => ({ id, name: id })),
      hasUnread: threadLabels.includes('UNREAD'),
      totalReplies: live.filter((message) => !message.isDraft).length,
      hasDraft: live.some((message) => message.isDraft),
      isGroupThread: recipients > 1,
    },
  };
}
