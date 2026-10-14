/**
 * Minimal IMAP4rev1 client (RFC 3501) with the extensions mailbox sync uses: UIDPLUS, MOVE,
 * CONDSTORE/QRESYNC, SPECIAL-USE, LITERAL+, SASL-IR, ENABLE, UTF8=ACCEPT, ID.
 *
 * Commands run strictly one at a time. Runs on any MailSocket (Cloudflare sockets in
 * production, scripted fakes in tests).
 */
import {
  asBytes,
  asList,
  asNumber,
  asString,
  expandSequenceSet,
  parseResponse,
  readResponseSegments,
  type DataResponse,
  type ImapResponse,
  type ImapValue,
  type StatusResponse,
} from './parser';
import {
  ByteReader,
  encodeUtf8,
  MailConnectionError,
  type MailSocket,
  type SocketFactory,
  type TransportSecurity,
} from '../mail-transport/socket';
import { decodeMailboxName, encodeMailboxName } from './utf7';

export type ImapAuth =
  | { method: 'password'; username: string; password: string }
  | { method: 'xoauth2'; username: string; accessToken: string };

export interface ImapClientOptions {
  host: string;
  port: number;
  security: TransportSecurity;
  auth: ImapAuth;
  socketFactory: SocketFactory;
  timeoutMs?: number;
  /** Client name sent with the ID command. */
  clientName?: string;
}

export class ImapCommandError extends Error {
  constructor(
    readonly command: string,
    readonly response: StatusResponse,
  ) {
    super(
      `IMAP ${command} failed: ${response.status}${response.code ? ` [${response.code.name}]` : ''} ${response.text}`.trim(),
    );
    this.name = 'ImapCommandError';
  }

  get code() {
    return this.response.code?.name;
  }
}

export class ImapAuthError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ImapAuthError';
  }
}

export interface ListEntry {
  path: string;
  /** Mailbox name as sent on the wire (for re-use in commands). */
  delimiter: string | null;
  flags: string[];
}

export interface MailboxInfo {
  path: string;
  exists: number;
  uidValidity: number;
  uidNext: number;
  highestModseq?: number;
  noModseq: boolean;
  /** Flags/keywords defined in the mailbox (untagged FLAGS). */
  flags: string[];
  permanentFlags: string[];
  readOnly: boolean;
  /** QRESYNC only: UIDs expunged since the supplied modseq. */
  vanished: number[];
  /** QRESYNC only: flag changes since the supplied modseq. */
  changed: FetchedMessage[];
}

export interface FetchedMessage {
  seq: number;
  uid: number;
  flags?: string[];
  modseq?: number;
  internalDate?: string;
  size?: number;
  /** Body sections keyed by the server's section name, e.g. `BODY[]`, `BODY[HEADER.FIELDS (...)]`. */
  sections: Record<string, Uint8Array>;
}

export interface CopyUidMap {
  uidValidity: number;
  /** Source UID -> destination UID. */
  map: Map<number, number>;
}

/** An unsolicited mailbox change reported during IDLE. */
export type IdleUpdate =
  | { kind: 'exists'; count: number }
  | { kind: 'expunge'; seq: number }
  | { kind: 'fetch'; message: FetchedMessage | null }
  | { kind: 'vanished' };

export type CommandArg =
  | string
  | { quoted: string }
  | { literal: Uint8Array }
  | { mailbox: string }
  | CommandArg[];

const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const fromBase64 = (value: string) => {
  try {
    return atob(value);
  } catch {
    return value;
  }
};

/** Section key without `.PEEK` and partial ranges, uppercased: `BODY[]`, `BODY[HEADER]`. */
const normalizeSectionKey = (key: string) => key.toUpperCase().replace(/<[\d.]+>$/, '');

export const findSection = (message: FetchedMessage, prefix: string) => {
  const wanted = prefix.toUpperCase();
  for (const [key, value] of Object.entries(message.sections)) {
    if (key === wanted || key.startsWith(wanted.replace(/\]$/, ''))) return value;
  }
  return undefined;
};

export const parseCopyUid = (code: StatusResponse['code']): CopyUidMap | null => {
  if (!code || code.name !== 'COPYUID') return null;
  const [validity, source, destination] = code.args.map((arg) => asString(arg));
  const from = expandSequenceSet(source ?? '');
  const to = expandSequenceSet(destination ?? '');
  if (!from.length || from.length !== to.length) return null;
  return { uidValidity: Number(validity), map: new Map(from.map((uid, i) => [uid, to[i]!])) };
};

export class ImapClient {
  capabilities = new Set<string>();
  enabled = new Set<string>();
  selected: MailboxInfo | null = null;
  private reader!: ByteReader;
  private socket!: MailSocket;
  private tagCounter = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private closed = false;

  private constructor(private options: ImapClientOptions) {}

  static async connect(options: ImapClientOptions): Promise<ImapClient> {
    const client = new ImapClient(options);
    await client.open();
    return client;
  }

  get isClosed() {
    return this.closed;
  }

  has(capability: string) {
    return this.capabilities.has(capability.toUpperCase());
  }

  get utf8() {
    return this.enabled.has('UTF8=ACCEPT');
  }

  private async open() {
    const { host, port, security, socketFactory, timeoutMs } = this.options;
    this.socket = await socketFactory({ host, port, security });
    this.reader = new ByteReader(this.socket, timeoutMs ?? 60_000);
    const greeting = parseResponse(await readResponseSegments(this.reader));
    if (greeting.kind !== 'status' || greeting.tag !== '*' || greeting.status === 'BYE') {
      throw new MailConnectionError('IMAP server rejected the connection', 'protocol');
    }
    this.applyCapabilityCode(greeting);
    const preauth = greeting.status === 'PREAUTH';

    if (security === 'starttls') {
      if (!this.capabilities.size) await this.refreshCapabilities();
      if (!this.has('STARTTLS'))
        throw new MailConnectionError('Server does not offer STARTTLS', 'tls');
      await this.run(['STARTTLS']);
      this.socket = await this.socket.startTls();
      this.reader.replaceSocket(this.socket);
      this.capabilities.clear();
    }

    if (!this.capabilities.size) await this.refreshCapabilities();
    if (!preauth) await this.authenticate();
    if (!this.capabilities.size || !this.has('IMAP4REV1')) await this.refreshCapabilities();

    if (this.has('ID')) {
      await this.run([
        'ID',
        [{ quoted: 'name' }, { quoted: this.options.clientName ?? 'Zero' }],
      ]).catch(() => {});
    }

    const toEnable = [
      this.has('QRESYNC') ? 'QRESYNC' : this.has('CONDSTORE') ? 'CONDSTORE' : null,
      this.has('UTF8=ACCEPT') ? 'UTF8=ACCEPT' : null,
    ].filter((cap): cap is string => !!cap);
    if (toEnable.length && this.has('ENABLE')) {
      const { untagged } = await this.run(['ENABLE', ...toEnable]).catch(() => ({
        untagged: [] as DataResponse[],
      }));
      for (const response of untagged) {
        if (asString(response.values[0]).toUpperCase() !== 'ENABLED') continue;
        for (const cap of response.values.slice(1)) this.enabled.add(asString(cap).toUpperCase());
      }
    }
  }

  private applyCapabilityCode(response: StatusResponse) {
    if (response.code?.name !== 'CAPABILITY') return;
    this.capabilities = new Set(response.code.args.map((arg) => asString(arg).toUpperCase()));
  }

  async refreshCapabilities() {
    const { untagged } = await this.run(['CAPABILITY']);
    for (const response of untagged) {
      if (asString(response.values[0]).toUpperCase() === 'CAPABILITY')
        this.capabilities = new Set(
          response.values.slice(1).map((value) => asString(value).toUpperCase()),
        );
    }
  }

  private async authenticate() {
    const { auth } = this.options;
    try {
      let result: { status: StatusResponse };
      if (auth.method === 'xoauth2') {
        if (!this.has('AUTH=XOAUTH2'))
          throw new ImapAuthError('Server does not support XOAUTH2 authentication');
        const token = toBase64(
          encodeUtf8(`user=${auth.username}\x01auth=Bearer ${auth.accessToken}\x01\x01`),
        );
        result = await this.saslAuthenticate('XOAUTH2', token);
      } else if (this.has('AUTH=PLAIN')) {
        const token = toBase64(encodeUtf8(`\0${auth.username}\0${auth.password}`));
        result = await this.saslAuthenticate('PLAIN', token);
      } else {
        if (this.has('LOGINDISABLED'))
          throw new ImapAuthError('Server disabled plaintext login on this connection');
        result = await this.run([
          'LOGIN',
          this.stringArg(auth.username),
          this.stringArg(auth.password),
        ]);
      }
      this.capabilities.clear();
      this.applyCapabilityCode(result.status);
    } catch (error) {
      if (error instanceof ImapCommandError) {
        throw new ImapAuthError(
          error.response.text || 'Authentication failed. Check the username and password.',
          { cause: error },
        );
      }
      throw error;
    }
  }

  private saslAuthenticate(mechanism: string, initial: string) {
    if (this.has('SASL-IR')) {
      return this.run(['AUTHENTICATE', mechanism, initial], {
        // XOAUTH2 failures send a base64 JSON challenge; reply empty to receive the NO.
        onContinue: async () => '',
      });
    }
    let sent = false;
    return this.run(['AUTHENTICATE', mechanism], {
      onContinue: async () => {
        if (sent) return '';
        sent = true;
        return initial;
      },
    });
  }

  /** A string argument: quoted when safe, otherwise a literal. */
  stringArg(value: string): CommandArg {
    const ascii = /^[\x20-\x7e]*$/.test(value);
    if ((ascii || this.utf8) && !/[\r\n]/.test(value) && value.length < 1024)
      return { quoted: value };
    return { literal: encodeUtf8(value) };
  }

  private mailboxArg(path: string): CommandArg {
    return this.stringArg(this.utf8 ? path : encodeMailboxName(path));
  }

  private decodeMailbox(value: ImapValue) {
    const name = asString(value);
    return this.utf8 ? name : decodeMailboxName(name);
  }

  /**
   * Splits a command into frames. Each frame's text is sent followed by CRLF; a frame with a
   * literal then sends the literal bytes (after a `+` continuation unless `sync` is false).
   */
  private serialize(args: CommandArg[]): { text: string; literal?: Uint8Array; sync?: boolean }[] {
    const frames: { text: string; literal?: Uint8Array; sync?: boolean }[] = [];
    let text = '';
    const push = (arg: CommandArg, first: boolean) => {
      if (!first) text += ' ';
      if (typeof arg === 'string') text += arg;
      else if (Array.isArray(arg)) {
        text += '(';
        arg.forEach((item, i) => push(item, i === 0));
        text += ')';
      } else if ('quoted' in arg) {
        text += `"${arg.quoted.replace(/[\\"]/g, (ch) => `\\${ch}`)}"`;
      } else if ('mailbox' in arg) {
        push(this.mailboxArg(arg.mailbox), true);
      } else {
        const nonSync =
          this.has('LITERAL+') || (this.has('LITERAL-') && arg.literal.length <= 4096);
        text += `{${arg.literal.length}${nonSync ? '+' : ''}}`;
        frames.push({ text, literal: arg.literal, sync: !nonSync });
        text = '';
      }
    };
    args.forEach((arg, i) => push(arg, i === 0));
    frames.push({ text });
    return frames;
  }

  /** Runs one command, resolving on its tagged OK and rejecting on NO/BAD. */
  run(
    args: CommandArg[],
    options: { onContinue?: (text: string) => Promise<string> } = {},
  ): Promise<{ untagged: DataResponse[]; statuses: StatusResponse[]; status: StatusResponse }> {
    const task = this.queue.then(() => this.execute(args, options));
    this.queue = task.catch(() => {});
    return task;
  }

  private async execute(
    args: CommandArg[],
    options: { onContinue?: (text: string) => Promise<string> },
  ) {
    if (this.closed) throw new MailConnectionError('IMAP connection is closed', 'closed');
    const tag = `Z${++this.tagCounter}`;
    const name = typeof args[0] === 'string' ? args[0] : 'command';
    const frames = this.serialize(args);
    frames[0]!.text = `${tag} ${frames[0]!.text}`;
    const untagged: DataResponse[] = [];
    const statuses: StatusResponse[] = [];

    // Sends frames until one needs a server continuation. Returns that frame's literal.
    let next = 0;
    const sendFrames = async (): Promise<Uint8Array | undefined> => {
      while (next < frames.length) {
        const frame = frames[next++]!;
        await this.socket.write(encodeUtf8(`${frame.text}\r\n`));
        if (!frame.literal) continue;
        if (frame.sync) return frame.literal;
        await this.socket.write(frame.literal);
      }
      return undefined;
    };

    let pendingLiteral = await sendFrames();
    try {
      for (;;) {
        const response: ImapResponse = parseResponse(await readResponseSegments(this.reader));
        if (response.kind === 'continue') {
          if (pendingLiteral) {
            await this.socket.write(pendingLiteral);
            pendingLiteral = await sendFrames();
          } else if (options.onContinue) {
            const reply = await options.onContinue(fromBase64(response.text));
            await this.socket.write(encodeUtf8(`${reply}\r\n`));
          } else {
            await this.socket.write(encodeUtf8('\r\n'));
          }
          continue;
        }
        if (response.kind === 'status' && response.tag === tag) {
          if (response.status !== 'OK') throw new ImapCommandError(name, response);
          return { untagged, statuses, status: response };
        }
        if (response.kind === 'status') {
          if (response.status === 'BYE' && name !== 'LOGOUT') {
            this.closed = true;
            throw new MailConnectionError(
              `IMAP server closed the connection: ${response.text}`,
              'closed',
            );
          }
          this.applyCapabilityCode(response);
          statuses.push(response);
        } else {
          untagged.push(response);
        }
      }
    } catch (error) {
      if (error instanceof MailConnectionError) this.closed = true;
      throw error;
    }
  }

  async list(): Promise<ListEntry[]> {
    const specialUse = this.has('SPECIAL-USE');
    const { untagged } = await this.run(
      specialUse
        ? ['LIST', { quoted: '' }, { quoted: '*' }, 'RETURN', ['SPECIAL-USE']]
        : ['LIST', { quoted: '' }, { quoted: '*' }],
    );
    const entries: ListEntry[] = [];
    for (const response of untagged) {
      if (asString(response.values[0]).toUpperCase() !== 'LIST') continue;
      const [, flags, delimiter, name] = response.values;
      entries.push({
        flags: asList(flags).map((flag) => asString(flag)),
        delimiter: delimiter === null ? null : asString(delimiter),
        path: this.decodeMailbox(name ?? ''),
      });
    }
    return entries;
  }

  async status(path: string, items: string[]): Promise<Record<string, number>> {
    const { untagged } = await this.run(['STATUS', { mailbox: path }, items]);
    const out: Record<string, number> = {};
    for (const response of untagged) {
      if (asString(response.values[0]).toUpperCase() !== 'STATUS') continue;
      const pairs = asList(response.values[2]);
      for (let i = 0; i + 1 < pairs.length; i += 2)
        out[asString(pairs[i]).toUpperCase()] = asNumber(pairs[i + 1]);
    }
    return out;
  }

  async select(
    path: string,
    options: { readOnly?: boolean; qresync?: { uidValidity: number; modseq: number } } = {},
  ): Promise<MailboxInfo> {
    const modifiers: CommandArg[] = [];
    if (options.qresync && this.enabled.has('QRESYNC')) {
      modifiers.push([
        'QRESYNC',
        [String(options.qresync.uidValidity), String(options.qresync.modseq)],
      ]);
    } else if (this.has('CONDSTORE')) {
      modifiers.push(['CONDSTORE']);
    }
    const { untagged, statuses, status } = await this.run([
      options.readOnly ? 'EXAMINE' : 'SELECT',
      { mailbox: path },
      ...modifiers,
    ]).catch((error) => {
      this.selected = null;
      throw error;
    });

    const info: MailboxInfo = {
      path,
      exists: 0,
      uidValidity: 0,
      uidNext: 0,
      noModseq: false,
      flags: [],
      permanentFlags: [],
      readOnly: status.code?.name === 'READ-ONLY',
      vanished: [],
      changed: [],
    };
    for (const response of statuses) {
      const code = response.code;
      if (!code) continue;
      if (code.name === 'UIDVALIDITY') info.uidValidity = asNumber(code.args[0]);
      else if (code.name === 'UIDNEXT') info.uidNext = asNumber(code.args[0]);
      else if (code.name === 'HIGHESTMODSEQ') info.highestModseq = asNumber(code.args[0]);
      else if (code.name === 'NOMODSEQ') info.noModseq = true;
      else if (code.name === 'PERMANENTFLAGS')
        info.permanentFlags = asList(code.args[0]).map((flag) => asString(flag));
    }
    for (const response of untagged) {
      const [first, second, third] = response.values;
      if (asString(first).toUpperCase() === 'FLAGS')
        info.flags = asList(second).map((flag) => asString(flag));
      else if (asString(second).toUpperCase() === 'EXISTS') info.exists = asNumber(first);
      else if (asString(first).toUpperCase() === 'VANISHED') {
        const set = Array.isArray(second) ? third : second;
        info.vanished.push(...expandSequenceSet(asString(set)));
      } else if (asString(second).toUpperCase() === 'FETCH') {
        const message = this.parseFetch(response);
        if (message) info.changed.push(message);
      }
    }
    this.selected = info;
    return info;
  }

  private parseFetch(response: DataResponse): FetchedMessage | null {
    const [seq, word, data] = response.values;
    if (asString(word).toUpperCase() !== 'FETCH') return null;
    const items = asList(data);
    const message: FetchedMessage = { seq: asNumber(seq), uid: 0, sections: {} };
    for (let i = 0; i + 1 < items.length; i += 2) {
      const key = asString(items[i]).toUpperCase();
      const value = items[i + 1];
      if (key === 'UID') message.uid = asNumber(value);
      else if (key === 'FLAGS') message.flags = asList(value).map((flag) => asString(flag));
      else if (key === 'MODSEQ') message.modseq = asNumber(asList(value)[0]);
      else if (key === 'INTERNALDATE') message.internalDate = asString(value);
      else if (key === 'RFC822.SIZE') message.size = asNumber(value);
      else if (key.startsWith('BODY[') || key.startsWith('BINARY[') || key === 'RFC822') {
        const bytes = asBytes(value);
        if (bytes) message.sections[normalizeSectionKey(key)] = bytes;
      }
    }
    return message;
  }

  /** UID SEARCH with raw criteria (caller-escaped). Returns matching UIDs. */
  async uidSearch(criteria: CommandArg[]): Promise<number[]> {
    const { untagged } = await this.run(['UID', 'SEARCH', ...criteria]);
    const uids: number[] = [];
    for (const response of untagged) {
      if (asString(response.values[0]).toUpperCase() !== 'SEARCH') continue;
      for (const value of response.values.slice(1)) {
        if (typeof value === 'string' && /^\d+$/.test(value)) uids.push(Number(value));
      }
    }
    return uids;
  }

  async uidFetch(
    set: string,
    items: string[],
    options: { changedSince?: number; vanished?: boolean } = {},
  ): Promise<FetchedMessage[]> {
    if (!set) return [];
    const modifiers: CommandArg[] = [];
    if (options.changedSince !== undefined) {
      const inner: CommandArg[] = ['CHANGEDSINCE', String(options.changedSince)];
      if (options.vanished && this.enabled.has('QRESYNC')) inner.push('VANISHED');
      modifiers.push(inner);
    }
    const { untagged } = await this.run(['UID', 'FETCH', set, items, ...modifiers]);
    return untagged
      .map((response) => this.parseFetch(response))
      .filter((message): message is FetchedMessage => !!message && message.uid > 0);
  }

  async uidStore(set: string, operation: '+FLAGS' | '-FLAGS', flags: string[]) {
    if (!set || !flags.length) return;
    await this.run(['UID', 'STORE', set, `${operation}.SILENT`, flags]);
  }

  async uidCopy(set: string, destination: string): Promise<CopyUidMap | null> {
    const { status } = await this.run(['UID', 'COPY', set, { mailbox: destination }]);
    return parseCopyUid(status.code);
  }

  /** Moves messages; falls back to COPY + \Deleted + expunge on servers without MOVE. */
  async uidMove(set: string, destination: string): Promise<CopyUidMap | null> {
    if (!set) return null;
    if (this.has('MOVE')) {
      const { statuses, status } = await this.run(['UID', 'MOVE', set, { mailbox: destination }]);
      // COPYUID arrives in an untagged OK before the tagged response.
      for (const response of [...statuses, status]) {
        const parsed = parseCopyUid(response.code);
        if (parsed) return parsed;
      }
      return null;
    }
    const copied = await this.uidCopy(set, destination);
    await this.uidStore(set, '+FLAGS', ['\\Deleted']);
    await this.uidExpunge(set);
    return copied;
  }

  /** Expunges only the given UIDs when UIDPLUS is available, otherwise every \Deleted message. */
  async uidExpunge(set: string) {
    if (!set) return;
    if (this.has('UIDPLUS')) await this.run(['UID', 'EXPUNGE', set]);
    else await this.run(['EXPUNGE']);
  }

  async append(
    path: string,
    raw: Uint8Array,
    flags: string[] = [],
    date?: Date,
  ): Promise<{ uidValidity: number; uid: number } | null> {
    const args: CommandArg[] = ['APPEND', { mailbox: path }];
    if (flags.length) args.push(flags);
    if (date) args.push({ quoted: formatInternalDate(date) });
    args.push({ literal: raw });
    const { status } = await this.run(args);
    if (status.code?.name === 'APPENDUID') {
      return {
        uidValidity: asNumber(status.code.args[0]),
        uid: asNumber(status.code.args[1]),
      };
    }
    return null;
  }

  async createMailbox(path: string) {
    await this.run(['CREATE', { mailbox: path }]);
    if (this.has('SPECIAL-USE')) return;
    await this.run(['SUBSCRIBE', { mailbox: path }]).catch(() => {});
  }

  async renameMailbox(from: string, to: string) {
    await this.run(['RENAME', { mailbox: from }, { mailbox: to }]);
  }

  async deleteMailbox(path: string) {
    if (this.selected?.path === path) {
      await this.run(['CLOSE']).catch(() => {});
      this.selected = null;
    }
    await this.run(['DELETE', { mailbox: path }]);
  }

  async noop() {
    await this.run(['NOOP']);
  }

  /**
   * IMAP IDLE (RFC 2177) on the selected mailbox. Calls `onUpdate` for every unsolicited
   * mailbox change (EXISTS, EXPUNGE, FETCH, VANISHED). Ends with DONE when `onUpdate`
   * returns true, `signal` aborts, or `maxMs` elapses (keep it under the RFC's 29 minutes).
   * Holds the command queue for its whole duration, so use a dedicated connection.
   */
  idle(options: {
    maxMs: number;
    signal?: AbortSignal;
    onUpdate: (update: IdleUpdate) => boolean | void;
    /** How often the abort signal is checked while waiting. */
    pollMs?: number;
  }): Promise<{ reason: 'update' | 'aborted' | 'timeout' }> {
    const task = this.queue.then(() => this.executeIdle(options));
    this.queue = task.catch(() => {});
    return task;
  }

  private async executeIdle({
    maxMs,
    signal,
    onUpdate,
    pollMs = 500,
  }: {
    maxMs: number;
    signal?: AbortSignal;
    onUpdate: (update: IdleUpdate) => boolean | void;
    pollMs?: number;
  }): Promise<{ reason: 'update' | 'aborted' | 'timeout' }> {
    if (this.closed) throw new MailConnectionError('IMAP connection is closed', 'closed');
    if (!this.has('IDLE')) throw new Error('Server does not support IDLE');
    const tag = `Z${++this.tagCounter}`;
    const toUpdate = (response: DataResponse): IdleUpdate | null => {
      const [first, second] = response.values;
      const word = asString(second).toUpperCase();
      if (word === 'EXISTS') return { kind: 'exists', count: asNumber(first) };
      if (word === 'EXPUNGE') return { kind: 'expunge', seq: asNumber(first) };
      if (word === 'FETCH') return { kind: 'fetch', message: this.parseFetch(response) };
      if (asString(first).toUpperCase() === 'VANISHED') return { kind: 'vanished' };
      return null;
    };
    const readOne = async () => {
      const response = parseResponse(await readResponseSegments(this.reader));
      if (response.kind === 'status' && response.tag === '*' && response.status === 'BYE') {
        this.closed = true;
        throw new MailConnectionError(
          `IMAP server closed the connection: ${response.text}`,
          'closed',
        );
      }
      return response;
    };

    try {
      await this.socket.write(encodeUtf8(`${tag} IDLE\r\n`));
      for (;;) {
        const response = await readOne();
        if (response.kind === 'continue') break;
        if (response.kind === 'status' && response.tag === tag)
          throw new ImapCommandError('IDLE', response);
        if (response.kind === 'data') {
          const update = toUpdate(response);
          if (update) onUpdate(update);
        }
      }

      const deadline = Date.now() + maxMs;
      let reason: 'update' | 'aborted' | 'timeout' = 'timeout';
      while (Date.now() < deadline) {
        if (signal?.aborted) {
          reason = 'aborted';
          break;
        }
        const ready = await this.reader.waitForData(Math.min(pollMs, deadline - Date.now()));
        if (!ready) continue;
        const response = await readOne();
        if (response.kind !== 'data') continue;
        const update = toUpdate(response);
        if (update && onUpdate(update) === true) {
          reason = 'update';
          break;
        }
      }

      await this.socket.write(encodeUtf8('DONE\r\n'));
      for (;;) {
        const response = await readOne();
        if (response.kind === 'status' && response.tag === tag) {
          if (response.status !== 'OK') throw new ImapCommandError('IDLE', response);
          return { reason };
        }
        if (response.kind === 'data') {
          const update = toUpdate(response);
          if (update) onUpdate(update);
        }
      }
    } catch (error) {
      if (error instanceof MailConnectionError) this.closed = true;
      throw error;
    }
  }

  async logout() {
    if (this.closed) return;
    try {
      await this.run(['LOGOUT']);
    } catch {
      // ignore
    } finally {
      await this.close();
    }
  }

  async close() {
    this.closed = true;
    await this.socket?.close().catch(() => {});
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** IMAP date-time: `17-Jul-1996 02:44:25 +0000`. */
export const formatInternalDate = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getUTCDate())}-${MONTHS[date.getUTCMonth()]}-${date.getUTCFullYear()} ${pad(
    date.getUTCHours(),
  )}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} +0000`;
};

/** IMAP search date: `1-Feb-1994`. */
export const formatSearchDate = (date: Date) =>
  `${date.getUTCDate()}-${MONTHS[date.getUTCMonth()]}-${date.getUTCFullYear()}`;
