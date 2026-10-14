/**
 * Tag labels for IMAP mailboxes, stored as IMAP keywords (RFC 3501 flag-keyword atoms).
 *
 * IMAP has two places a label can live: a folder (moving the message) or a keyword on the
 * message (a tag, like Gmail labels). Labels the app creates as tags (AI labels and learned
 * topics) use keywords, so labeling never moves mail and never creates mailboxes.
 *
 * Label ids are `K_<base64url(keyword)>`, mirroring `F_` folder ids. Keywords the app
 * creates are `Zero_<slug>`; the human-readable name lives in the mailbox's keyword
 * registry (ImapIndexStore).
 */
import { fromBase64Url, toBase64Url } from './folders';

export const KEYWORD_LABEL_PREFIX = 'K_';
export const APP_KEYWORD_PREFIX = 'Zero_';

export const keywordLabelId = (keyword: string) => `${KEYWORD_LABEL_PREFIX}${toBase64Url(keyword)}`;

export const keywordFromLabelId = (labelId: string): string | null => {
  if (!labelId.startsWith(KEYWORD_LABEL_PREFIX)) return null;
  try {
    const keyword = fromBase64Url(labelId.slice(KEYWORD_LABEL_PREFIX.length));
    return isKeywordAtom(keyword) ? keyword : null;
  } catch {
    return null;
  }
};

export const isKeywordLabel = (labelId: string) => keywordFromLabelId(labelId) !== null;

/** A valid flag-keyword: an atom (no specials, no `\`), at most 64 characters. */
export const isKeywordAtom = (value: string) =>
  value.length > 0 &&
  value.length <= 64 &&
  /^[\x21-\x7e]+$/.test(value) &&
  !/[(){%*"\\\]]/.test(value);

/** Keywords servers or clients use internally; never surfaced as labels. */
const RESERVED =
  /^(\$(Important|Forwarded|MDNSent|Junk|NotJunk|Phishing|Label[1-5]|Submit(ted|Pending)|MailFlagBit\d|HasAttachment|HasNoAttachment|Muted|Unsubscribed|AutoSent)|Junk|NonJunk|NotJunk|\$Fwd|Forwarded|Redirected)$/i;

export const isReservedKeyword = (keyword: string) =>
  keyword.startsWith('\\') || RESERVED.test(keyword);

const fnv1a = (value: string) => {
  let hash = 0x811c9dc5;
  for (const char of value) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
};

/**
 * The keyword for a new tag label: `Zero_` plus an ASCII slug of the name. Names that slug
 * badly (non-Latin scripts) or collide with an existing keyword get a short hash suffix.
 */
export const keywordForName = (name: string, taken: (keyword: string) => boolean) => {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  const base = `${APP_KEYWORD_PREFIX}${slug || 'label'}`;
  if (slug && !taken(base)) return base;
  for (let attempt = 0; ; attempt++) {
    const candidate = `${base}_${fnv1a(`${name}\n${attempt}`).slice(0, 6)}`;
    if (!taken(candidate)) return candidate;
  }
};

/**
 * Whether a mailbox accepts a keyword permanently: PERMANENTFLAGS lists `\*` (any new
 * keyword) or the keyword itself. An empty list means the server didn't say; treat that
 * as unsupported so the label is kept app-side instead of silently dropped.
 */
export const canStoreKeyword = (permanentFlags: string[], keyword: string) =>
  permanentFlags.some((flag) => flag === '\\*' || flag.toLowerCase() === keyword.toLowerCase());

/** Display name for a keyword nobody registered (e.g. a Thunderbird tag). */
export const keywordDisplayName = (keyword: string) =>
  keyword.startsWith('$') ? keyword.slice(1) : keyword;
