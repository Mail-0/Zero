/**
 * IMAP4rev1 response parsing (RFC 3501 §7, §9). A response is a CRLF-terminated line that may
 * embed `{n}` literals; the reader assembles those into segments and the tokenizer turns them
 * into values:
 *
 *  - atoms, numbers and quoted strings -> string (atom `NIL` -> null)
 *  - literals -> Uint8Array (raw bytes, e.g. message bodies)
 *  - parenthesized lists -> ImapValue[]
 *
 * Atoms keep any `[...]` section and `<...>` partial suffix, so `BODY[HEADER.FIELDS (A B)]`
 * is a single atom.
 */
import type { ByteReader } from '../mail-transport/socket';

export type ImapValue = string | Uint8Array | null | ImapValue[];

export interface ResponseSegment {
  text: string;
  /** Literal bytes that follow `text` (whose last token was the `{n}` marker). */
  literal?: Uint8Array;
}

export type ImapStatus = 'OK' | 'NO' | 'BAD' | 'BYE' | 'PREAUTH';

export interface StatusResponse {
  kind: 'status';
  tag: string;
  status: ImapStatus;
  code?: { name: string; args: ImapValue[] };
  text: string;
}

export interface DataResponse {
  kind: 'data';
  /** `*` for untagged data. */
  tag: string;
  values: ImapValue[];
}

export interface ContinueResponse {
  kind: 'continue';
  text: string;
}

export type ImapResponse = StatusResponse | DataResponse | ContinueResponse;

const LITERAL_MARKER = /\{(\d+)\+?\}$/;
const STATUS_WORDS = new Set(['OK', 'NO', 'BAD', 'BYE', 'PREAUTH']);

/** Reads one full response (line plus any literals) from the server. */
export const readResponseSegments = async (
  reader: ByteReader,
  maxLiteral = 64 * 1024 * 1024,
): Promise<ResponseSegment[]> => {
  const segments: ResponseSegment[] = [];
  for (;;) {
    const text = await reader.readLine();
    const match = LITERAL_MARKER.exec(text);
    if (!match) {
      segments.push({ text });
      return segments;
    }
    const length = Number(match[1]);
    if (length > maxLiteral) throw new Error(`IMAP literal of ${length} bytes exceeds limit`);
    segments.push({ text, literal: await reader.readBytes(length) });
  }
};

class Tokenizer {
  private segment = 0;
  private pos = 0;

  constructor(private segments: ResponseSegment[]) {}

  private get text() {
    return this.segments[this.segment]?.text ?? '';
  }

  get done() {
    return this.segment >= this.segments.length - 1 && this.pos >= this.text.length;
  }

  peek() {
    return this.text[this.pos];
  }

  skipSpaces() {
    while (this.text[this.pos] === ' ') this.pos++;
  }

  /** Everything left on the current line, verbatim. */
  rest() {
    const out = this.text.slice(this.pos);
    this.pos = this.text.length;
    return out;
  }

  readValue(): ImapValue {
    this.skipSpaces();
    const ch = this.text[this.pos];
    if (ch === undefined) throw new Error('Unexpected end of IMAP response');
    if (ch === '(') return this.readList();
    if (ch === '"') return this.readQuoted();
    if (ch === '{') {
      const literal = this.tryReadLiteral();
      if (literal) return literal;
    }
    const atom = this.readAtom();
    return atom.toUpperCase() === 'NIL' ? null : atom;
  }

  private readList(): ImapValue[] {
    this.pos++; // (
    const items: ImapValue[] = [];
    for (;;) {
      this.skipSpaces();
      const ch = this.text[this.pos];
      if (ch === ')') {
        this.pos++;
        return items;
      }
      if (ch === undefined) throw new Error('Unterminated IMAP list');
      items.push(this.readValue());
    }
  }

  private readQuoted() {
    this.pos++; // opening quote
    let out = '';
    for (;;) {
      const ch = this.text[this.pos++];
      if (ch === undefined) throw new Error('Unterminated IMAP quoted string');
      if (ch === '"') return out;
      if (ch === '\\') {
        out += this.text[this.pos++] ?? '';
        continue;
      }
      out += ch;
    }
  }

  private tryReadLiteral(): Uint8Array | undefined {
    const remaining = this.text.slice(this.pos);
    const match = /^\{(\d+)\+?\}$/.exec(remaining);
    const literal = this.segments[this.segment]?.literal;
    if (!match || !literal) return undefined;
    this.segment++;
    this.pos = 0;
    return literal;
  }

  private readAtom() {
    const start = this.pos;
    let depth = 0;
    for (;;) {
      const ch = this.text[this.pos];
      if (ch === undefined) break;
      if (ch === '[') depth++;
      else if (ch === ']') depth = Math.max(0, depth - 1);
      else if (depth === 0 && (ch === ' ' || ch === '(' || ch === ')')) {
        // `BODY[]<0>` style partial suffix and `[...]` are part of the atom; parens end it.
        break;
      }
      this.pos++;
    }
    // A section like `BODY[HEADER.FIELDS (A B)]` is followed directly by `<n>` or a space.
    if (this.pos === start) throw new Error(`Unexpected "${this.text[this.pos]}" in IMAP response`);
    return this.text.slice(start, this.pos);
  }
}

export const parseValues = (segments: ResponseSegment[]): ImapValue[] => {
  const tokenizer = new Tokenizer(segments);
  const values: ImapValue[] = [];
  for (;;) {
    tokenizer.skipSpaces();
    if (tokenizer.done) return values;
    values.push(tokenizer.readValue());
  }
};

const parseStatusTail = (
  tag: string,
  status: ImapStatus,
  tail: string,
  segments: ResponseSegment[],
): StatusResponse => {
  let text = tail.trimStart();
  let code: StatusResponse['code'];
  if (text.startsWith('[')) {
    let depth = 0;
    let end = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '[') depth++;
      else if (text[i] === ']' && --depth === 0) {
        end = i;
        break;
      }
    }
    if (end > 0) {
      const inner = text.slice(1, end);
      const values = parseValues([{ text: inner }]);
      const [name, ...args] = values;
      if (typeof name === 'string') code = { name: name.toUpperCase(), args };
      text = text.slice(end + 1).trimStart();
    }
  }
  // Human-readable text could carry a literal on broken servers; keep only the line text.
  void segments;
  return { kind: 'status', tag, status, code, text };
};

export const parseResponse = (segments: ResponseSegment[]): ImapResponse => {
  const first = segments[0]?.text ?? '';
  if (first.startsWith('+')) return { kind: 'continue', text: first.slice(1).trim() };
  const space = first.indexOf(' ');
  if (space <= 0) throw new Error(`Malformed IMAP response: ${first.slice(0, 80)}`);
  const tag = first.slice(0, space);
  const afterTag = first.slice(space + 1);
  const wordEnd = afterTag.indexOf(' ');
  const word = (wordEnd === -1 ? afterTag : afterTag.slice(0, wordEnd)).toUpperCase();
  if (STATUS_WORDS.has(word) && segments.length === 1) {
    return parseStatusTail(
      tag,
      word as ImapStatus,
      wordEnd === -1 ? '' : afterTag.slice(wordEnd + 1),
      segments,
    );
  }
  const values = parseValues([{ ...segments[0], text: afterTag }, ...segments.slice(1)]);
  return { kind: 'data', tag, values };
};

// ---- helpers for consumers ----

export const asString = (value: ImapValue | undefined): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Uint8Array) return new TextDecoder().decode(value);
  return '';
};

export const asList = (value: ImapValue | undefined): ImapValue[] =>
  Array.isArray(value) ? value : [];

export const asNumber = (value: ImapValue | undefined): number => {
  const n = Number(asString(value));
  return Number.isFinite(n) ? n : 0;
};

export const asBytes = (value: ImapValue | undefined): Uint8Array | null => {
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') return new TextEncoder().encode(value);
  return null;
};

/** Expands a UID set like `1:3,7,9:10` into numbers. `*` is not allowed here. */
export const expandSequenceSet = (set: string, max = 1_000_000): number[] => {
  const out: number[] = [];
  for (const part of set.split(',')) {
    if (!part) continue;
    const [a, b] = part.split(':');
    const start = Number(a);
    const end = b === undefined ? start : Number(b);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    for (let n = lo; n <= hi && out.length < max; n++) out.push(n);
  }
  return out;
};

/** Compresses UIDs into an IMAP sequence set (`1:3,7`). */
export const toSequenceSet = (uids: Iterable<number>): string => {
  const sorted = [...new Set(uids)].filter((n) => n > 0).sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(i === j ? `${sorted[i]}` : `${sorted[i]}:${sorted[j]}`);
    i = j + 1;
  }
  return parts.join(',');
};
