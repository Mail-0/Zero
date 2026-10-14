/**
 * In-memory IMAP server for tests. Implements the subset of IMAP4rev1 + UIDPLUS + MOVE +
 * SPECIAL-USE that the client, sync engine and driver use. Not for production.
 */
import { asList, asString, expandSequenceSet, parseValues, type ImapValue } from '../parser';
import { FakeMailServer } from '../../mail-transport/fake-socket';

export interface MemoryMessage {
  uid: number;
  flags: string[];
  raw: string;
  internalDate: Date;
}

export interface MemoryFolder {
  path: string;
  specialUse?: string;
  uidValidity: number;
  uidNext: number;
  messages: MemoryMessage[];
}

const quote = (value: string) => `"${value.replace(/[\\"]/g, (ch) => `\\${ch}`)}"`;

const parseRange = (set: string, folder: MemoryFolder) => {
  const max = Math.max(0, ...folder.messages.map((m) => m.uid));
  const out = new Set<number>();
  for (const part of set.split(',')) {
    const [a, b] = part.split(':');
    const start = a === '*' ? max : Number(a);
    const end = b === undefined ? start : b === '*' ? max : Number(b);
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    for (const message of folder.messages)
      if (message.uid >= lo && message.uid <= hi) out.add(message.uid);
  }
  return out;
};

const headerBlock = (raw: string) => {
  const split = raw.search(/\r?\n\r?\n/);
  return split === -1 ? raw : raw.slice(0, split);
};

export class MemoryImapServer {
  folders = new Map<string, MemoryFolder>();
  password = 'pw';
  /** Accepted XOAUTH2 bearer token. */
  accessToken = 'token-1';
  capabilities = ['IMAP4rev1', 'SASL-IR', 'AUTH=PLAIN', 'UIDPLUS', 'MOVE', 'SPECIAL-USE'];
  /** PERMANENTFLAGS sent on SELECT; drop `\\*` to model servers without custom keywords. */
  permanentFlags = ['\\Seen', '\\Flagged', '\\Deleted', '\\Draft', '\\*'];
  readonly fake: FakeMailServer;
  /** Selected mailbox per connection (keyed by the connection's send function). */
  private selections = new Map<(data: string) => void, MemoryFolder>();
  /** Connections currently in IDLE, with the tag to answer on DONE. */
  private idlers = new Map<(data: string) => void, { tag: string; folder: MemoryFolder }>();
  private current: ((data: string) => void) | null = null;

  constructor() {
    this.addFolder('INBOX');
    this.fake = new FakeMailServer(
      () => `* OK [CAPABILITY ${this.capabilities.join(' ')}] memory imap\r\n`,
      (line, { literals, send }) => {
        this.current = send;
        return this.handle(line, literals, send);
      },
    );
  }

  /** The mailbox selected on the connection whose command is being handled. */
  get selected(): MemoryFolder | null {
    return (this.current && this.selections.get(this.current)) ?? null;
  }

  /** Number of connections currently idling. */
  get idleCount() {
    return this.idlers.size;
  }

  get factory() {
    return this.fake.factory;
  }

  addFolder(path: string, specialUse?: string) {
    const folder: MemoryFolder = { path, specialUse, uidValidity: 1, uidNext: 1, messages: [] };
    this.folders.set(path, folder);
    return folder;
  }

  deliver(path: string, raw: string, flags: string[] = [], date = new Date()) {
    const folder = this.folders.get(path)!;
    const message = {
      uid: folder.uidNext++,
      flags,
      raw: raw.replace(/\r?\n/g, '\r\n'),
      internalDate: date,
    };
    folder.messages.push(message);
    // Push the new message count to clients idling on this folder.
    for (const [send, idle] of this.idlers)
      if (idle.folder === folder) send(`* ${folder.messages.length} EXISTS\r\n`);
    return message;
  }

  private handle(line: string, literals: Uint8Array[], send: (data: string) => void): string[] {
    const idle = this.idlers.get(send);
    if (idle) {
      if (line.toUpperCase() !== 'DONE') return [];
      this.idlers.delete(send);
      return [`${idle.tag} OK idle done\r\n`];
    }
    const tag = line.slice(0, line.indexOf(' '));
    const rest = line.slice(tag.length + 1);
    // Re-split around literal markers so the shared parser sees literal bytes.
    const pieces = rest.split(/(?<=\{\d+\+?\})/);
    const segments = pieces.map((text, i) => ({ text, literal: literals[i] }));
    const values = parseValues(segments.filter((s) => s.text.length || s.literal));
    const command = asString(values[0]).toUpperCase();
    const ok = (text = 'done') => `${tag} OK ${text}\r\n`;
    try {
      switch (command) {
        case 'CAPABILITY':
          return [`* CAPABILITY ${this.capabilities.join(' ')}\r\n`, ok()];
        case 'AUTHENTICATE': {
          const decoded = atob(asString(values[2]));
          if (asString(values[1]).toUpperCase() === 'XOAUTH2') {
            const token = decoded
              .split('\u0001')
              .find((part) => part.startsWith('auth=Bearer '))
              ?.slice(12);
            return token === this.accessToken
              ? [ok('authenticated')]
              : [`${tag} NO [AUTHENTICATIONFAILED] bad token\r\n`];
          }
          return decoded.split('\0')[2] === this.password
            ? [ok('authenticated')]
            : [`${tag} NO [AUTHENTICATIONFAILED] bad\r\n`];
        }
        case 'NOOP':
          return [ok()];
        case 'IDLE': {
          if (!this.capabilities.includes('IDLE')) return [`${tag} BAD unsupported IDLE\r\n`];
          const folder = this.selections.get(send);
          if (!folder) return [`${tag} BAD no mailbox selected\r\n`];
          this.idlers.set(send, { tag, folder });
          return ['+ idling\r\n'];
        }
        case 'LOGOUT':
          return ['* BYE\r\n', ok()];
        case 'LIST':
          return [
            ...[...this.folders.values()].map(
              (f) =>
                `* LIST (\\HasNoChildren${f.specialUse ? ` ${f.specialUse}` : ''}) "/" ${quote(f.path)}\r\n`,
            ),
            ok(),
          ];
        case 'STATUS': {
          const folder = this.folders.get(asString(values[1]));
          if (!folder) return [`${tag} NO no such mailbox\r\n`];
          return [
            `* STATUS ${quote(folder.path)} (MESSAGES ${folder.messages.length} UIDNEXT ${folder.uidNext} UIDVALIDITY ${folder.uidValidity} UNSEEN ${folder.messages.filter((m) => !m.flags.includes('\\Seen')).length})\r\n`,
            ok(),
          ];
        }
        case 'SELECT':
        case 'EXAMINE': {
          const folder = this.folders.get(asString(values[1]));
          if (!folder) return [`${tag} NO no such mailbox\r\n`];
          this.selections.set(send, folder);
          const keywords = [
            ...new Set(folder.messages.flatMap((m) => m.flags.filter((f) => !f.startsWith('\\')))),
          ];
          return [
            `* FLAGS (\\Seen \\Flagged \\Deleted \\Draft \\Answered${keywords.map((k) => ` ${k}`).join('')})\r\n`,
            `* ${folder.messages.length} EXISTS\r\n`,
            `* OK [UIDVALIDITY ${folder.uidValidity}] ok\r\n`,
            `* OK [UIDNEXT ${folder.uidNext}] ok\r\n`,
            `* OK [PERMANENTFLAGS (${this.permanentFlags.join(' ')})] ok\r\n`,
            ok(command === 'EXAMINE' ? '[READ-ONLY] examined' : '[READ-WRITE] selected'),
          ];
        }
        case 'CREATE':
          this.addFolder(asString(values[1]));
          return [ok()];
        case 'DELETE':
          this.folders.delete(asString(values[1]));
          return [ok()];
        case 'RENAME': {
          const folder = this.folders.get(asString(values[1]))!;
          this.folders.delete(folder.path);
          folder.path = asString(values[2]);
          this.folders.set(folder.path, folder);
          return [ok()];
        }
        case 'APPEND': {
          const folder = this.folders.get(asString(values[1]));
          if (!folder) return [`${tag} NO [TRYCREATE] no such mailbox\r\n`];
          const flags = Array.isArray(values[2]) ? asList(values[2]).map(asString) : [];
          const raw = new TextDecoder().decode(values.at(-1) as Uint8Array);
          const message = this.deliver(folder.path, raw, flags);
          return [ok(`[APPENDUID ${folder.uidValidity} ${message.uid}] appended`)];
        }
        case 'EXPUNGE':
          return [...this.expunge(), ok()];
        case 'UID':
          return this.uidCommand(tag, values.slice(1));
        default:
          return [`${tag} BAD unsupported ${command}\r\n`];
      }
    } catch (error) {
      return [`${tag} BAD ${String(error)}\r\n`];
    }
  }

  private expunge(uids?: Set<number>) {
    const folder = this.selected!;
    const out: string[] = [];
    folder.messages = folder.messages.filter((message, index) => {
      const remove = message.flags.includes('\\Deleted') && (!uids || uids.has(message.uid));
      if (remove) out.push(`* ${index + 1} EXPUNGE\r\n`);
      return !remove;
    });
    return out;
  }

  private search(folder: MemoryFolder, criteria: ImapValue[]) {
    let matches = new Set(folder.messages.map((m) => m.uid));
    for (let i = 0; i < criteria.length; i++) {
      const key = asString(criteria[i]).toUpperCase();
      const next = () => asString(criteria[++i]);
      const filter = (predicate: (m: MemoryMessage) => boolean) => {
        matches = new Set(
          folder.messages.filter((m) => matches.has(m.uid) && predicate(m)).map((m) => m.uid),
        );
      };
      if (key === 'UID') {
        const range = parseRange(next(), folder);
        filter((m) => range.has(m.uid));
      } else if (key === 'SINCE') {
        const since = Date.parse(next());
        filter((m) => m.internalDate.getTime() >= since - 86_400_000);
      } else if (key === 'TEXT' || key === 'BODY') {
        const needle = next().toLowerCase();
        filter((m) => m.raw.toLowerCase().includes(needle));
      } else if (key === 'SUBJECT' || key === 'FROM' || key === 'TO') {
        const needle = next().toLowerCase();
        filter((m) =>
          headerBlock(m.raw)
            .split(/\r\n/)
            .some(
              (h) =>
                h.toLowerCase().startsWith(`${key.toLowerCase()}:`) &&
                h.toLowerCase().includes(needle),
            ),
        );
      } else if (key === 'HEADER') {
        const name = next().toLowerCase();
        const needle = next().toLowerCase();
        filter((m) =>
          headerBlock(m.raw)
            .split(/\r\n/)
            .some(
              (h) => h.toLowerCase().startsWith(`${name}:`) && h.toLowerCase().includes(needle),
            ),
        );
      } else if (key === 'UNSEEN') filter((m) => !m.flags.includes('\\Seen'));
      else if (key === 'FLAGGED') filter((m) => m.flags.includes('\\Flagged'));
      else if (key === 'KEYWORD') {
        const keyword = next().toLowerCase();
        filter((m) => m.flags.some((flag) => flag.toLowerCase() === keyword));
      } else if (key === 'ALL') continue;
    }
    return [...matches].sort((a, b) => a - b);
  }

  private uidCommand(tag: string, values: ImapValue[]): string[] {
    const folder = this.selected;
    if (!folder) return [`${tag} BAD no mailbox selected\r\n`];
    const sub = asString(values[0]).toUpperCase();
    const ok = (text = 'done') => `${tag} OK ${text}\r\n`;
    if (sub === 'SEARCH')
      return [
        `* SEARCH ${this.search(folder, values.slice(1)).join(' ')}\r\n`.replace(' \r', '\r'),
        ok(),
      ];
    const set = parseRange(asString(values[1]), folder);
    const targets = folder.messages.filter((m) => set.has(m.uid));
    if (sub === 'FETCH') {
      const items = asList(values[2]).map((item) => asString(item).toUpperCase());
      const lines = targets.map((message) => {
        const seq = folder.messages.indexOf(message) + 1;
        const parts: string[] = [`UID ${message.uid}`];
        const literals: string[] = [];
        for (const item of items) {
          if (item === 'FLAGS') parts.push(`FLAGS (${message.flags.join(' ')})`);
          else if (item === 'RFC822.SIZE')
            parts.push(`RFC822.SIZE ${new TextEncoder().encode(message.raw).length}`);
          else if (item === 'INTERNALDATE')
            parts.push(`INTERNALDATE "${message.internalDate.toUTCString()}"`);
          else if (
            item.startsWith('BODY.PEEK[HEADER.FIELDS') ||
            item.startsWith('BODY[HEADER.FIELDS')
          ) {
            const names = /\(([^)]*)\)/.exec(item)![1]!.toLowerCase().split(' ');
            const block = headerBlock(message.raw)
              .split(/\r\n(?![ \t])/)
              .filter((h) => names.includes(h.slice(0, h.indexOf(':')).toLowerCase()))
              .join('\r\n');
            const body = `${block}\r\n\r\n`;
            literals.push(body);
            parts.push(
              `BODY[HEADER.FIELDS (${names.join(' ').toUpperCase()})] {${new TextEncoder().encode(body).length}}`,
            );
          } else if (item === 'BODY.PEEK[]' || item === 'BODY[]') {
            literals.push(message.raw);
            parts.push(`BODY[] {${new TextEncoder().encode(message.raw).length}}`);
            if (item === 'BODY[]' && !message.flags.includes('\\Seen'))
              message.flags.push('\\Seen');
          }
        }
        // Each literal marker ends a line; the literal bytes follow it.
        let out = `* ${seq} FETCH (`;
        let literalIndex = 0;
        parts.forEach((part, i) => {
          out += (i ? ' ' : '') + part;
          if (/\{\d+\}$/.test(part)) out += `\r\n${literals[literalIndex++]}`;
        });
        return `${out})\r\n`;
      });
      return [...lines, ok()];
    }
    if (sub === 'STORE') {
      const op = asString(values[2]).toUpperCase();
      const flags = asList(values[3]).map(asString);
      for (const message of targets) {
        if (op.startsWith('+')) message.flags = [...new Set([...message.flags, ...flags])];
        else message.flags = message.flags.filter((flag) => !flags.includes(flag));
      }
      return [ok()];
    }
    if (sub === 'COPY' || sub === 'MOVE') {
      const destination = this.folders.get(asString(values[2]));
      if (!destination) return [`${tag} NO [TRYCREATE] no such mailbox\r\n`];
      const from: number[] = [];
      const to: number[] = [];
      for (const message of targets) {
        const copy = this.deliver(
          destination.path,
          message.raw,
          [...message.flags],
          message.internalDate,
        );
        from.push(message.uid);
        to.push(copy.uid);
      }
      const code = `[COPYUID ${destination.uidValidity} ${from.join(',')} ${to.join(',')}]`;
      if (sub === 'COPY') return [ok(`${code} copied`)];
      folder.messages = folder.messages.filter((m) => !set.has(m.uid));
      return [`* OK ${code} moved\r\n`, ok()];
    }
    if (sub === 'EXPUNGE') return [...this.expunge(set), ok()];
    return [`${tag} BAD unsupported UID ${sub}\r\n`];
  }
}

export const sampleMessage = (options: {
  messageId: string;
  subject?: string;
  from?: string;
  to?: string;
  inReplyTo?: string;
  references?: string[];
  date?: Date;
  body?: string;
  /** Extra raw header lines, e.g. `List-Unsubscribe: <https://x/u>`. */
  headers?: string[];
}) =>
  [
    `From: ${options.from ?? 'Alice <alice@example.com>'}`,
    `To: ${options.to ?? 'me@example.com'}`,
    `Subject: ${options.subject ?? 'Hello'}`,
    `Date: ${(options.date ?? new Date()).toUTCString()}`,
    `Message-ID: <${options.messageId}>`,
    ...(options.inReplyTo ? [`In-Reply-To: <${options.inReplyTo}>`] : []),
    ...(options.references?.length
      ? [`References: ${options.references.map((r) => `<${r}>`).join(' ')}`]
      : []),
    ...(options.headers ?? []),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    options.body ?? 'Hi there',
    '',
  ].join('\r\n');

export { expandSequenceSet };
