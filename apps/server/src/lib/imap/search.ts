/**
 * Translates the app's Gmail-style search queries into IMAP SEARCH criteria (RFC 3501 §6.4.4).
 *
 * Supported: free text and "phrases" (TEXT), from:/to:/cc:/bcc:/subject:, is:unread/read/
 * starred/unstarred/important, has:attachment, after:/before:/newer_than:/older_than:, in:/label:
 * (selects the folder), -term / NOT term, and `a OR b`. Operators with no IMAP equivalent
 * (category:, is:personal, ...) are ignored rather than failing the search.
 */
import { formatSearchDate } from './client';
import type { CommandArg } from './client';

export interface TranslatedSearch {
  /** Folder label from in:/label:, e.g. `INBOX`, `SENT`, or a user label name. */
  folder?: string;
  criteria: CommandArg[];
  /** True when the query only had unsupported operators. */
  empty: boolean;
}

const FOLDER_ALIASES: Record<string, string> = {
  inbox: 'INBOX',
  sent: 'SENT',
  draft: 'DRAFT',
  drafts: 'DRAFT',
  spam: 'SPAM',
  junk: 'SPAM',
  trash: 'TRASH',
  bin: 'TRASH',
  archive: 'ARCHIVE',
};

const tokenize = (query: string) => {
  const tokens: string[] = [];
  const pattern = /(-?)(\w+:)?("([^"]*)"|\S+)/g;
  for (const match of query.replace(/[()]/g, ' ').matchAll(pattern)) tokens.push(match[0]);
  return tokens;
};

const parseDate = (value: string) => {
  const normalized = value.replace(/\//g, '-');
  const parsed = Date.parse(
    /^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized) ? `${normalized}T00:00:00Z` : normalized,
  );
  return Number.isFinite(parsed) ? new Date(parsed) : null;
};

const relativeDate = (value: string) => {
  const match = /^(\d+)([dmy])$/i.exec(value);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  const days = unit === 'd' ? amount : unit === 'm' ? amount * 30 : amount * 365;
  return new Date(Date.now() - days * 86_400_000);
};

const unquote = (value: string) => value.replace(/^"(.*)"$/, '$1');

/** One query term -> IMAP criteria (or null when unsupported). */
const termCriteria = (term: string, out: { folder?: string }): CommandArg[] | null => {
  const colon = term.indexOf(':');
  if (colon > 0 && !term.startsWith('"')) {
    const operator = term.slice(0, colon).toLowerCase();
    const value = unquote(term.slice(colon + 1));
    if (!value) return null;
    switch (operator) {
      case 'from':
      case 'to':
      case 'cc':
      case 'bcc':
      case 'subject':
        return [operator.toUpperCase(), { quoted: value }];
      case 'is':
        switch (value.toLowerCase()) {
          case 'unread':
            return ['UNSEEN'];
          case 'read':
            return ['SEEN'];
          case 'starred':
            return ['FLAGGED'];
          case 'unstarred':
            return ['UNFLAGGED'];
          // The driver stores IMPORTANT as the $Important keyword.
          case 'important':
            return ['KEYWORD', '$Important'];
          case 'draft':
            return ['DRAFT'];
          case 'inbox':
            out.folder = 'INBOX';
            return [];
          default:
            return null;
        }
      case 'has':
        return value.toLowerCase() === 'attachment'
          ? ['HEADER', { quoted: 'Content-Type' }, { quoted: 'multipart/mixed' }]
          : null;
      case 'after': {
        const date = parseDate(value);
        return date ? ['SINCE', formatSearchDate(date)] : null;
      }
      case 'before': {
        const date = parseDate(value);
        return date ? ['BEFORE', formatSearchDate(date)] : null;
      }
      case 'newer_than': {
        const date = relativeDate(value);
        return date ? ['SINCE', formatSearchDate(date)] : null;
      }
      case 'older_than': {
        const date = relativeDate(value);
        return date ? ['BEFORE', formatSearchDate(date)] : null;
      }
      case 'in':
      case 'label':
        out.folder = FOLDER_ALIASES[value.toLowerCase()] ?? value;
        return [];
      default:
        return null;
    }
  }
  const text = unquote(term);
  return text ? ['TEXT', { quoted: text }] : null;
};

export const translateSearch = (query: string): TranslatedSearch => {
  const out: { folder?: string } = {};
  const criteria: CommandArg[] = [];
  const tokens = tokenize(query);
  let negateNext = false;
  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i]!;
    if (token === 'AND') continue;
    if (token === 'NOT') {
      negateNext = true;
      continue;
    }
    let negate = negateNext;
    negateNext = false;
    if (token.startsWith('-') && token.length > 1) {
      negate = !negate;
      token = token.slice(1);
    }
    const folderBefore = out.folder;
    let term = termCriteria(token, out);
    // `-in:spam` / `NOT is:inbox` can't pick a folder; ignore rather than invert it.
    if (negate && out.folder !== folderBefore) {
      out.folder = folderBefore;
      continue;
    }
    // `a OR b` (left-associative pairs).
    while (tokens[i + 1] === 'OR' && tokens[i + 2]) {
      const right = termCriteria(tokens[i + 2]!, out);
      i += 2;
      if (term && right && term.length && right.length) term = ['OR', term, right];
      else term = term && term.length ? term : right;
    }
    if (!term || !term.length) continue;
    if (negate) criteria.push('NOT', term.length === 1 ? term[0]! : term);
    else criteria.push(...term);
  }
  return {
    folder: out.folder,
    criteria: criteria.length ? criteria : ['ALL'],
    empty: !criteria.length,
  };
};
