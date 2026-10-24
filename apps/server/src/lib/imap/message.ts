/**
 * Converts raw RFC 5322 messages (from IMAP FETCH BODY[]) into the app's ParsedMessage.
 */
import PostalMime, { type Address, type Email } from 'postal-mime';
import type { ParsedMessage } from '../../types';
import { wasSentWithTLS } from '../email-utils';
import * as he from 'he';

export const ZERO_SUGGESTION_HEADER_LC = 'x-zero-suggestion';

const flatten = (addresses: Address[] | Address | undefined) => {
  const list = !addresses ? [] : Array.isArray(addresses) ? addresses : [addresses];
  return list.flatMap((address) =>
    address.group
      ? address.group.map((member) => ({ name: member.name || undefined, email: member.address }))
      : [{ name: address.name || undefined, email: address.address ?? '' }],
  );
};

const header = (email: Email, name: string) =>
  email.headers.find((h) => h.key === name)?.value ?? undefined;

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const toBase64 = (content: ArrayBuffer | Uint8Array | string) => {
  if (typeof content === 'string') return content;
  const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

const byteLength = (content: ArrayBuffer | Uint8Array | string) =>
  typeof content === 'string' ? content.length : content.byteLength;

export const parseRawMessage = (raw: Uint8Array) =>
  PostalMime.parse(raw, { attachmentEncoding: 'arraybuffer' });

/** Attachments that are real files (not inline images referenced by the HTML body). */
export const listedAttachments = (email: Email) =>
  email.attachments
    .map((attachment, index) => ({ attachment, index }))
    .filter(({ attachment }) => !(attachment.related && attachment.contentId));

export const attachmentId = (index: number) => String(index);

export interface MessageContext {
  id: string;
  threadId: string;
  connectionId?: string;
  tags: { id: string; name: string; type: string }[];
  unread: boolean;
  isDraft: boolean;
  internalDate?: number;
}

/** Full ParsedMessage including decoded HTML body (inline images become data: URIs). */
export const toParsedMessage = (email: Email, context: MessageContext): ParsedMessage => {
  let html = email.html ?? (email.text ? escapeHtml(email.text).replace(/\r?\n/g, '<br>') : '');
  for (const attachment of email.attachments) {
    if (!attachment.contentId) continue;
    const cid = attachment.contentId.replace(/[<>]/g, '');
    const escaped = cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(
      new RegExp(`cid:${escaped}`, 'g'),
      `data:${attachment.mimeType};base64,${toBase64(attachment.content)}`,
    );
  }

  const from = flatten(email.from)[0] ?? { email: 'unknown', name: undefined };
  const receivedHeaders = email.headers.filter((h) => h.key === 'received').map((h) => h.value);
  const date = email.date && !Number.isNaN(Date.parse(email.date)) ? email.date : undefined;
  const snippet = he
    .decode((email.text ?? html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' '))
    .trim()
    .slice(0, 200);

  return {
    id: context.id,
    connectionId: context.connectionId,
    threadId: context.threadId,
    title: snippet,
    subject: email.subject?.trim() || '(no subject)',
    tags: context.tags,
    sender: { name: from.name, email: from.email },
    to: flatten(email.to),
    cc: email.cc ? flatten(email.cc) : null,
    bcc: email.bcc ? flatten(email.bcc) : [],
    tls: wasSentWithTLS(receivedHeaders) || !!header(email, 'tls-report'),
    listUnsubscribe: header(email, 'list-unsubscribe'),
    listUnsubscribePost: header(email, 'list-unsubscribe-post'),
    receivedOn:
      date ??
      (context.internalDate
        ? new Date(context.internalDate).toISOString()
        : new Date().toISOString()),
    unread: context.unread,
    body: '',
    processedHtml: '',
    blobUrl: '',
    decodedBody: html,
    references: email.references,
    inReplyTo: email.inReplyTo,
    replyTo: email.replyTo ? flatten(email.replyTo)[0]?.email : undefined,
    messageId: email.messageId,
    attachments: listedAttachments(email).map(({ attachment, index }) => ({
      attachmentId: attachmentId(index),
      filename: attachment.filename ?? `attachment-${index + 1}`,
      mimeType: attachment.mimeType,
      size: byteLength(attachment.content),
      body: '',
      headers: [
        { name: 'Content-Type', value: attachment.mimeType },
        ...(attachment.disposition
          ? [{ name: 'Content-Disposition', value: attachment.disposition }]
          : []),
      ],
    })),
    isDraft: context.isDraft,
    isZeroSuggestion: context.isDraft && !!header(email, ZERO_SUGGESTION_HEADER_LC),
  };
};

export const attachmentPayload = (email: Email, id: string) => {
  const attachment = email.attachments[Number(id)];
  if (!attachment) return undefined;
  return {
    filename: attachment.filename ?? `attachment-${Number(id) + 1}`,
    mimeType: attachment.mimeType,
    size: byteLength(attachment.content),
    attachmentId: id,
    headers: [
      { name: 'Content-Type', value: attachment.mimeType },
      ...(attachment.contentId ? [{ name: 'Content-ID', value: attachment.contentId }] : []),
    ],
    body: toBase64(attachment.content),
  };
};
