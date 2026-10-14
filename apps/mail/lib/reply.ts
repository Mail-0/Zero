import type { ParsedMessage, Sender } from '@/types';

export type ReplyMode = 'reply' | 'replyAll' | 'forward';

export const isReplyMode = (mode: string | null | undefined): mode is ReplyMode =>
  mode === 'reply' || mode === 'replyAll' || mode === 'forward';

const REPLY_PREFIX = /^\s*(re|aw|sv|antw)\s*(\[\d+\])?\s*:\s*/i;
const FORWARD_PREFIX = /^\s*(fwd?|fw|wg|tr)\s*(\[\d+\])?\s*:\s*/i;

/** Strip any stack of Re:/Fwd: prefixes ("RE: Fwd: re: Hello" -> "Hello"). */
export const stripSubjectPrefixes = (subject: string): string => {
  let current = subject ?? '';
  for (;;) {
    const next = current.replace(REPLY_PREFIX, '').replace(FORWARD_PREFIX, '');
    if (next === current) return current.trim();
    current = next;
  }
};

/**
 * Reply keeps an existing Re: as-is (so threading subjects stay identical) but never stacks;
 * forward always gets exactly one Fwd: in front of the original subject.
 */
export const buildReplySubject = (subject: string | undefined, mode: ReplyMode): string => {
  const original = (subject ?? '').trim();
  if (mode === 'forward') return `Fwd: ${stripSubjectPrefixes(original)}`.trim();
  if (REPLY_PREFIX.test(original)) return `Re: ${original.replace(REPLY_PREFIX, '')}`.trim();
  return `Re: ${original}`.trim();
};

/** Parse an address-list header like `"Doe, Jane" <jane@x.com>, bob@y.com`. */
export const parseAddressList = (header: string | undefined | null): Sender[] => {
  if (!header) return [];
  const out: Sender[] = [];
  // Split on commas that are not inside quotes or angle brackets.
  let depthAngle = 0;
  let inQuote = false;
  let buf = '';
  const parts: string[] = [];
  for (const ch of header) {
    if (ch === '"') inQuote = !inQuote;
    else if (!inQuote && ch === '<') depthAngle++;
    else if (!inQuote && ch === '>') depthAngle = Math.max(0, depthAngle - 1);
    if (ch === ',' && !inQuote && depthAngle === 0) {
      parts.push(buf);
      buf = '';
    } else buf += ch;
  }
  parts.push(buf);

  for (const raw of parts) {
    const part = raw.trim();
    if (!part) continue;
    const angle = part.match(/^(.*?)<\s*([^>]+?)\s*>\s*$/);
    if (angle) {
      const name = angle[1]!
        .trim()
        .replace(/^"(.*)"$/, '$1')
        .trim();
      const email = angle[2]!.trim();
      if (email.includes('@')) out.push(name ? { name, email } : { email });
    } else if (part.includes('@')) {
      out.push({ email: part.replace(/^mailto:/i, '') });
    }
  }
  return out;
};

const norm = (email: string) => email.trim().toLowerCase();

/**
 * Work out To/Cc for a reply.
 * - Honors Reply-To.
 * - Replying to your own message goes back to its original recipients.
 * - Never includes any of your own addresses (all aliases) and dedupes case-insensitively.
 * - Never copies the original Bcc (that would expose blind recipients).
 */
export const buildReplyRecipients = (
  message: Pick<ParsedMessage, 'sender' | 'to' | 'cc' | 'replyTo'>,
  mode: ReplyMode,
  ownAddresses: string[],
): { to: Sender[]; cc: Sender[] } => {
  if (mode === 'forward') return { to: [], cc: [] };

  const own = new Set(ownAddresses.filter(Boolean).map(norm));
  const seen = new Set<string>();
  const take = (list: Sender[], allowOwn = false) =>
    list.filter((r) => {
      if (!r?.email) return false;
      const key = norm(r.email);
      if (seen.has(key) || (!allowOwn && own.has(key))) return false;
      seen.add(key);
      return true;
    });

  const sentByMe = own.has(norm(message.sender?.email ?? ''));
  const replyTo = parseAddressList(message.replyTo);
  const originalTo = message.to ?? [];
  const originalCc = message.cc ?? [];

  if (sentByMe) {
    // Following up on something I sent: talk to the same people again.
    const to = take(originalTo);
    const cc = mode === 'replyAll' ? take(originalCc) : [];
    // Note-to-self: everything was me, so reply to myself.
    if (to.length === 0 && cc.length === 0 && message.sender?.email) {
      return { to: [message.sender], cc: [] };
    }
    return { to, cc };
  }

  const primary = replyTo.length > 0 ? replyTo : message.sender ? [message.sender] : [];
  const to = take(primary);
  if (mode === 'reply') return { to, cc: [] };

  // Reply all: everyone else on To stays on To, Cc stays Cc (same as Gmail).
  to.push(...take(originalTo));
  const cc = take(originalCc);
  return { to, cc };
};

/** Which of my addresses was this message sent to? Used to pick the From address. */
export const pickFromAddress = (
  message: Pick<ParsedMessage, 'to' | 'cc' | 'bcc' | 'sender'> | undefined,
  aliases: { email: string; primary?: boolean }[] | undefined,
): string | undefined => {
  if (!message || !aliases?.length) return undefined;
  const candidates = [
    ...(message.to ?? []),
    ...(message.cc ?? []),
    ...(message.bcc ?? []),
    message.sender,
  ].filter(Boolean) as Sender[];
  for (const c of candidates) {
    const hit = aliases.find((a) => norm(a.email) === norm(c.email));
    if (hit) return hit.email;
  }
  return undefined;
};

const NO_REPLY_LOCAL =
  /^(no[-_.]?reply|do[-_.]?not[-_.]?reply|donotreply|mailer[-_.]?daemon|bounces?|notifications?|notify|newsletter|news|marketing|alerts?|automated|postmaster)([-_.+].*)?$/i;
// Only subdomains that are essentially always bulk-sending infrastructure.
const NO_REPLY_DOMAIN =
  /(^|\.)(mailer|mailers|bounce|bounces|newsletter|newsletters|notifications?|mkt|marketing|campaigns?)\.[^.]+\.[^.]+$/i;

/** Heuristic: does this address look like an unattended bulk/automated sender? */
export const isLikelyNoReply = (email: string | undefined): boolean => {
  if (!email || !email.includes('@')) return false;
  const [local, domain] = norm(email).split('@') as [string, string];
  return NO_REPLY_LOCAL.test(local) || NO_REPLY_DOMAIN.test(domain);
};

export const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const formatAddress = (s: Sender | undefined) => {
  if (!s?.email) return '';
  const name = s.name?.trim();
  return name && norm(name) !== norm(s.email)
    ? `${escapeHtml(name)} &lt;${escapeHtml(s.email)}&gt;`
    : escapeHtml(s.email);
};

/**
 * HTML that is appended after the user's text: an attribution line plus the original message
 * inside a blockquote. Uses Gmail's `gmail_quote` classes so Gmail (and many other clients)
 * collapse it behind "…" for the recipient.
 */
export const buildQuotedOriginal = (original: {
  sender?: Sender;
  date: string;
  body?: string;
}): string => {
  const attribution = `On ${escapeHtml(original.date)}, ${formatAddress(original.sender) || 'Unknown sender'} wrote:`;
  return `<br><div class="gmail_quote"><div dir="ltr" class="gmail_attr">${attribution}<br></div><blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex">${original.body ?? ''}</blockquote></div>`;
};

export const buildForwardedOriginal = (original: {
  sender?: Sender;
  date: string;
  subject?: string;
  to?: Sender[];
  cc?: Sender[] | null;
  body?: string;
}): string => {
  const lines = [
    '---------- Forwarded message ---------',
    `From: ${formatAddress(original.sender) || 'Unknown sender'}`,
    `Date: ${escapeHtml(original.date)}`,
    `Subject: ${escapeHtml(original.subject || '(no subject)')}`,
    `To: ${(original.to ?? []).map(formatAddress).join(', ')}`,
  ];
  if (original.cc?.length) lines.push(`Cc: ${original.cc.map(formatAddress).join(', ')}`);
  return `<br><div class="gmail_quote"><div dir="ltr" class="gmail_attr">${lines.join('<br>')}<br></div><br>${original.body ?? ''}</div>`;
};

/** Build a lookup so recipients keep their display names when we send. */
export const buildNameDirectory = (
  messages: Pick<ParsedMessage, 'sender' | 'to' | 'cc' | 'bcc' | 'replyTo'>[],
) => {
  const names = new Map<string, string>();
  for (const m of messages) {
    for (const s of [
      m.sender,
      ...(m.to ?? []),
      ...(m.cc ?? []),
      ...(m.bcc ?? []),
      ...parseAddressList(m.replyTo),
    ]) {
      if (s?.email && s.name && norm(s.name) !== norm(s.email)) names.set(norm(s.email), s.name);
    }
  }
  return names;
};

export const toSender = (email: string, names: Map<string, string>): Sender => {
  const parsed = parseAddressList(email)[0];
  const address = parsed?.email ?? email.trim();
  const name = parsed?.name ?? names.get(norm(address));
  return name ? { email: address, name } : { email: address };
};

const bareMessageId = (id: string | undefined) =>
  (id ?? '').trim().replace(/^<|>$/g, '').toLowerCase();

/**
 * Which existing draft in the thread should a new reply resume (if any)?
 * - A draft that is explicitly In-Reply-To the message being answered wins.
 * - Otherwise, when answering the latest message, the newest draft that isn't clearly a reply
 *   to some *other* message (older drafts never recorded In-Reply-To).
 * - Forward drafts are only resumed by forwards, and reply drafts only by replies.
 */
export const pickResumableDraft = <
  T extends Pick<ParsedMessage, 'id' | 'isDraft' | 'inReplyTo' | 'subject' | 'messageId'>,
>(
  messages: T[],
  replyTo: Pick<ParsedMessage, 'id' | 'messageId'>,
  mode: ReplyMode,
  isReplyingToLatest: boolean,
): T | undefined => {
  const isForwardSubject = (s: string | undefined) => FORWARD_PREFIX.test(s ?? '');
  const drafts = messages.filter(
    (m) => m.isDraft && isForwardSubject(m.subject) === (mode === 'forward'),
  );
  if (!drafts.length) return undefined;

  const target = bareMessageId(replyTo.messageId);
  if (target) {
    const exact = drafts.findLast((d) => bareMessageId(d.inReplyTo) === target);
    if (exact) return exact;
  }
  if (!isReplyingToLatest) return undefined;

  const otherIds = new Set(
    messages
      .filter((m) => !m.isDraft && m.id !== replyTo.id)
      .map((m) => bareMessageId(m.messageId))
      .filter(Boolean),
  );
  return drafts.findLast((d) => !d.inReplyTo || !otherIds.has(bareMessageId(d.inReplyTo)));
};

/** Inline images are already part of the forwarded body; only list real attachments. */
export const isInlineAttachment = (attachment: {
  headers?: { name?: string | null; value?: string | null }[];
}) => {
  const header = (name: string) =>
    attachment.headers?.find((h) => h.name?.toLowerCase() === name)?.value?.toLowerCase() ?? '';
  return header('content-disposition').startsWith('inline') && !!header('content-id');
};

/**
 * Drop a quoted original from a draft body (Gmail's `gmail_quote`, Outlook's `divRplyFwdMsg`
 * and what follows it). We append our own quote when sending, so a draft written in another
 * client would otherwise quote the original twice. Browser-only; returns input unchanged
 * elsewhere.
 */
export const stripQuotedOriginal = (html: string): string => {
  if (!html || typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('div.gmail_quote, blockquote.gmail_quote').forEach((el) => el.remove());
  const outlook = doc.getElementById('divRplyFwdMsg');
  if (outlook) {
    // Outlook puts an <hr> before the header block; everything from there on is the original.
    const prev = outlook.previousElementSibling;
    let node: Node | null = prev?.tagName === 'HR' ? prev : outlook;
    while (node) {
      const next: Node | null = node.nextSibling;
      node.parentNode?.removeChild(node);
      node = next;
    }
  }
  return doc.body.innerHTML.trim();
};

/**
 * Place each draft in the thread timeline: under the message it replies to (by In-Reply-To),
 * or, if that's unknown, after the latest message. Drafts keep their relative order.
 */
export const anchorDrafts = <
  M extends Pick<ParsedMessage, 'id' | 'messageId'>,
  D extends Pick<ParsedMessage, 'id' | 'inReplyTo'>,
>(
  messages: M[],
  drafts: D[],
): Map<string, D[]> => {
  const byMessageId = new Map<string, string>();
  for (const m of messages) {
    const key = bareMessageId(m.messageId);
    if (key) byMessageId.set(key, m.id);
  }
  const lastId = messages[messages.length - 1]?.id;
  const anchored = new Map<string, D[]>();
  for (const d of drafts) {
    const anchor = byMessageId.get(bareMessageId(d.inReplyTo)) ?? lastId;
    if (!anchor) continue;
    anchored.set(anchor, [...(anchored.get(anchor) ?? []), d]);
  }
  return anchored;
};

/** Which composer mode best matches an existing draft. */
export const modeForDraft = (draft: Pick<ParsedMessage, 'subject' | 'to' | 'cc'>): ReplyMode => {
  if (FORWARD_PREFIX.test(draft.subject ?? '')) return 'forward';
  return (draft.to?.length ?? 0) + (draft.cc?.length ?? 0) > 1 ? 'replyAll' : 'reply';
};
