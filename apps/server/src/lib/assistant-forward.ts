import { escapeXml } from '../thread-workflow-utils/workflow-utils';
import { AssistantToolError, digest } from './assistant-utils';
import type { ParsedMessage } from '../types';

export type ForwardAttachment = {
  filename: string;
  mimeType: string;
  size: number;
  body: string;
  headers: { name: string; value: string }[];
};
export type ForwardSource = { message: ParsedMessage; attachments: ForwardAttachment[] };

export async function forwardSourceVersion(source: ForwardSource) {
  const { message } = source;
  return digest(
    JSON.stringify({
      id: message.id,
      subject: message.subject,
      sender: message.sender,
      to: message.to,
      cc: message.cc,
      receivedOn: message.receivedOn,
      body: message.decodedBody || message.body || '',
      attachments: source.attachments.map(({ filename, mimeType, size, body, headers }) => ({
        filename,
        mimeType,
        size,
        body,
        headers,
      })),
    }),
  );
}

export function buildForwardContent(source: ForwardSource, note = '') {
  const { message, attachments } = source;
  const original = message.decodedBody || message.body || '';
  if (
    original.length + note.length > 64_000 ||
    attachments.reduce((sum, file) => sum + file.body.length, 0) > 14_000_000
  )
    throw new AssistantToolError(
      'This message is too large to forward safely through the assistant. Use the mailbox UI.',
      'forward_requires_mailbox_ui',
    );
  const available = [...attachments];
  for (const expected of message.attachments ?? []) {
    const index = available.findIndex(
      (file) => file.filename === expected.filename && file.size === expected.size,
    );
    if (index < 0)
      throw new AssistantToolError(
        'An original attachment is unavailable. Nothing was saved; do not create a text-only substitute.',
        'forward_attachment_unavailable',
        409,
      );
    available.splice(index, 1);
  }
  for (const file of attachments) {
    if (file.size > 0 && !file.body)
      throw new AssistantToolError(
        'Original attachment content is unavailable. Nothing was saved.',
        'forward_attachment_unavailable',
        409,
      );
  }
  const address = (person: { email: string; name?: string }) =>
    escapeXml(person.name ? `${person.name} <${person.email}>` : person.email);
  const list = (people: { email: string; name?: string }[] | null) =>
    (people ?? []).map(address).join(', ');
  const headers = [
    `From: ${address(message.sender)}`,
    `Date: ${escapeXml(message.receivedOn)}`,
    `Subject: ${escapeXml(message.subject)}`,
    `To: ${list(message.to)}`,
    ...(message.cc?.length ? [`Cc: ${list(message.cc)}`] : []),
  ].join('<br>');
  return {
    subject: `Fwd: ${message.subject.replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/i, '')}`,
    message: `${note ? `<p>${escapeXml(note).replace(/\n/g, '<br>')}</p>` : ''}<div>---------- Forwarded message ----------<br>${headers}</div><blockquote>${original}</blockquote>`,
  };
}

export function materializeForwardAttachments(body: string, files: ForwardAttachment[]) {
  const usedInline = new Set<ForwardAttachment>();
  const contentId = (file: ForwardAttachment) =>
    file.headers
      .find((header) => header.name.toLowerCase() === 'content-id')
      ?.value.trim()
      .replace(/^<|>$/g, '');
  const message = body.replace(
    /\bsrc\s*=\s*(?:(["'])cid:([^"']+)\1|cid:([^\s>]+))/gi,
    (
      _match,
      quote: string | undefined,
      quoted: string | undefined,
      unquoted: string | undefined,
    ) => {
      const cid = quoted ?? unquoted;
      const file = files.find((item) => contentId(item) === cid);
      if (
        !file ||
        !/^image\/[a-z0-9.+-]+$/i.test(file.mimeType) ||
        !/^[a-z0-9+/=_\-\s]+$/i.test(file.body)
      )
        throw new AssistantToolError(
          'An inline image cannot be preserved. Forward this message in the mailbox UI.',
          'forward_requires_mailbox_ui',
        );
      usedInline.add(file);
      return `src=${quote || '"'}data:${file.mimeType};base64,${file.body.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '')}${quote || '"'}`;
    },
  );
  if (/\bcid:/i.test(message))
    throw new AssistantToolError(
      'An inline image reference cannot be preserved. Forward this message in the mailbox UI.',
      'forward_requires_mailbox_ui',
    );
  const attachments = files
    .filter(
      (file) => !usedInline.has(file) && !(contentId(file) && body.includes(`base64,${file.body}`)),
    )
    .map((file) => ({
      name: file.filename,
      type: file.mimeType,
      size: file.size,
      base64: file.body,
      lastModified: 0,
    }));
  return { message, attachments };
}
