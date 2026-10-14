/**
 * Per-mailbox IMAP index, stored in the ZeroDriver Durable Object's SQLite. It maps IMAP
 * locations (folder + UID) to stable message keys and builds conversation threads, which
 * IMAP does not have.
 *
 * - A message key is derived from its Message-ID, so the same message in several folders
 *   (e.g. a note to self in Sent and Inbox) is one message, and it keeps its key when moved.
 *   Messages without a Message-ID fall back to a per-location key.
 * - Threads are built from In-Reply-To / References (JWZ-style, incremental). When a new
 *   message links two threads they are merged. Replies with no resolvable references fall
 *   back to the normalized subject within a 30-day window.
 * - Threads touched by any change are queued as "dirty" until the mailbox re-imports them.
 */
import {
  classifyMessage,
  emailAddress,
  emailAddresses,
  isMailCategory,
  type MailCategory,
} from './categorize';
import { isKeywordAtom, isReservedKeyword, keywordDisplayName } from './keywords';
import type { LabelStorage } from '../mail-label-store';

type Row = Record<string, string | number | null>;

export interface ParsedHeaders {
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  subject: string;
  date: number | null;
  /** Sender address (lowercase), when the From header was fetched. */
  from?: string | null;
  /** To + Cc addresses (lowercase). */
  recipients?: string[];
  /** Every parsed header, for categorization. */
  fields?: Map<string, string[]>;
}

export interface FolderState {
  path: string;
  labelId: string;
  system: string | null;
  delimiter: string | null;
  skip: boolean;
  uidValidity: number;
  uidNext: number;
  highestModseq: number;
  messages: number;
  /** Lowest UID fetched by the backfill; 0 = not started. */
  backfillCursor: number;
  backfillDone: boolean;
  polls: number;
}

export interface StoredLocation {
  folder: string;
  uid: number;
  flags: string[];
  size: number;
}

export interface StoredMessage {
  key: string;
  messageId: string | null;
  threadId: string;
  date: number;
  subject: string;
  /** Header-based category; null for messages indexed before categorization existed. */
  category: MailCategory | null;
  /** AI/user override for the whole thread, which wins over `category`. */
  threadCategory: MailCategory | null;
  locations: StoredLocation[];
}

const DAY = 86_400_000;
const REPLY_PREFIX = /^\s*((re|fw|fwd|aw|wg|sv|vs|antw|rif|r|tr|ref)\s*(\[\d+\])?\s*:\s*)+/i;

/** 53-bit string hash (cyrb53), hex. Two seeds give ~106 bits for ids. */
const cyrb53 = (value: string, seed: number) => {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
};

export const stableId = (prefix: string, value: string) =>
  `${prefix}${cyrb53(value, 1)}${cyrb53(value, 2)}`;

/** `<abc@host>` -> `abc@host`. */
export const normalizeMessageId = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const match = /<([^<>\s]+)>/.exec(value);
  const id = (match ? match[1] : value.trim().split(/\s+/)[0])?.trim();
  return id ? id : null;
};

export const parseMessageIdList = (value: string | null | undefined): string[] => {
  if (!value) return [];
  const ids = [...value.matchAll(/<([^<>\s]+)>/g)].map((m) => m[1]!);
  if (ids.length) return ids;
  return value
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter((id) => id.includes('@'));
};

export const normalizeSubject = (subject: string) =>
  subject.replace(REPLY_PREFIX, '').replace(/\s+/g, ' ').trim().toLowerCase();

export const isReplySubject = (subject: string) => REPLY_PREFIX.test(subject);

/** Unfolds and parses an RFC 5322 header block into lowercase name -> values. */
export const parseHeaderBlock = (block: string): Map<string, string[]> => {
  const headers = new Map<string, string[]>();
  const unfolded = block.replace(/\r?\n[ \t]+/g, ' ');
  for (const line of unfolded.split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    headers.set(name, [...(headers.get(name) ?? []), value]);
  }
  return headers;
};

/** Decodes RFC 2047 encoded-words (`=?utf-8?B?...?=`) in a header value. */
export const decodeEncodedWords = (value: string) =>
  value
    .replace(/(=\?[^?]+\?[bq]\?[^?]*\?=)\s+(?==\?[^?]+\?[bq]\?[^?]*\?=)/gi, '$1')
    .replace(
      /=\?([^?]+)\?([bq])\?([^?]*)\?=/gi,
      (whole, charset: string, enc: string, text: string) => {
        try {
          let bytes: Uint8Array;
          if (enc.toLowerCase() === 'b') {
            const binary = atob(text);
            bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
          } else {
            const decoded = text
              .replace(/_/g, ' ')
              .replace(/=([0-9a-f]{2})/gi, (_, hex: string) =>
                String.fromCharCode(parseInt(hex, 16)),
              );
            bytes = Uint8Array.from(decoded, (ch) => ch.charCodeAt(0));
          }
          return new TextDecoder(charset.toLowerCase()).decode(bytes);
        } catch {
          return whole;
        }
      },
    );

export const headersFromBlock = (block: string): ParsedHeaders => {
  const headers = parseHeaderBlock(block);
  const first = (name: string) => headers.get(name)?.[0] ?? null;
  const dateValue = first('date');
  const date = dateValue ? Date.parse(dateValue) : NaN;
  return {
    messageId: normalizeMessageId(first('message-id')),
    inReplyTo: normalizeMessageId(first('in-reply-to')),
    references: parseMessageIdList(first('references')),
    subject: decodeEncodedWords(first('subject') ?? ''),
    date: Number.isFinite(date) ? date : null,
    from: emailAddress(first('from')),
    recipients: emailAddresses([...(headers.get('to') ?? []), ...(headers.get('cc') ?? [])]),
    fields: headers,
  };
};

export class ImapIndexStore {
  constructor(private storage: LabelStorage) {}

  initialize() {
    const exec = (sql: string) => this.storage.exec(sql);
    exec(`CREATE TABLE IF NOT EXISTS imap_folders (
      path TEXT PRIMARY KEY, label_id TEXT NOT NULL, system TEXT, delimiter TEXT,
      skip INTEGER NOT NULL DEFAULT 0, uidvalidity INTEGER NOT NULL DEFAULT 0,
      uidnext INTEGER NOT NULL DEFAULT 0, highestmodseq INTEGER NOT NULL DEFAULT 0,
      messages INTEGER NOT NULL DEFAULT 0, backfill_cursor INTEGER NOT NULL DEFAULT 0,
      backfill_done INTEGER NOT NULL DEFAULT 0, polls INTEGER NOT NULL DEFAULT 0
    )`);
    exec(`CREATE TABLE IF NOT EXISTS imap_messages (
      key TEXT PRIMARY KEY, message_id TEXT, thread_id TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT '', subject_norm TEXT NOT NULL DEFAULT '',
      date INTEGER NOT NULL DEFAULT 0
    )`);
    const columns = new Set(this.rows('PRAGMA table_info(imap_messages)').map((row) => row.name));
    if (!columns.has('category')) exec('ALTER TABLE imap_messages ADD COLUMN category TEXT');
    // Sender and mass-mailing signal, so learning a contact can re-categorize their mail.
    if (!columns.has('sender')) exec('ALTER TABLE imap_messages ADD COLUMN sender TEXT');
    if (!columns.has('bulk')) exec('ALTER TABLE imap_messages ADD COLUMN bulk INTEGER');
    exec('CREATE INDEX IF NOT EXISTS imap_messages_sender ON imap_messages(sender)');
    exec('CREATE INDEX IF NOT EXISTS imap_messages_thread ON imap_messages(thread_id)');
    // A thread's category chosen by the AI workflow (or the user); wins over header rules.
    exec(`CREATE TABLE IF NOT EXISTS imap_thread_category (
      thread_id TEXT PRIMARY KEY, category TEXT NOT NULL, source TEXT NOT NULL
    )`);
    // Addresses the user has written to (from Sent), so their replies stay Personal.
    exec('CREATE TABLE IF NOT EXISTS imap_contacts (address TEXT PRIMARY KEY)');
    exec('CREATE INDEX IF NOT EXISTS imap_messages_message_id ON imap_messages(message_id)');
    exec('CREATE INDEX IF NOT EXISTS imap_messages_subject ON imap_messages(subject_norm, date)');
    exec(`CREATE TABLE IF NOT EXISTS imap_refs (
      key TEXT NOT NULL, ref TEXT NOT NULL, PRIMARY KEY (key, ref)
    )`);
    exec('CREATE INDEX IF NOT EXISTS imap_refs_ref ON imap_refs(ref)');
    exec(`CREATE TABLE IF NOT EXISTS imap_locations (
      folder TEXT NOT NULL, uid INTEGER NOT NULL, key TEXT NOT NULL,
      flags TEXT NOT NULL DEFAULT '[]', modseq INTEGER NOT NULL DEFAULT 0,
      size INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (folder, uid)
    )`);
    exec('CREATE INDEX IF NOT EXISTS imap_locations_key ON imap_locations(key)');
    exec(`CREATE TABLE IF NOT EXISTS imap_dirty_threads (
      thread_id TEXT PRIMARY KEY, queued_at INTEGER NOT NULL
    )`);
    // Threads that received a never-seen message during live sync (not backfill), so the
    // mailbox can run the AI thread workflow on them. Drained by takeNewMail().
    exec(`CREATE TABLE IF NOT EXISTS imap_new_mail (
      thread_id TEXT PRIMARY KEY, queued_at INTEGER NOT NULL
    )`);
    // Tag labels stored as IMAP keywords: ones the app created (AI labels, topics) and
    // ones discovered on messages (e.g. Thunderbird tags).
    exec(`CREATE TABLE IF NOT EXISTS imap_keyword_labels (
      keyword TEXT PRIMARY KEY COLLATE NOCASE, name TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'app', created_at INTEGER NOT NULL
    )`);
  }

  // ---- keyword (tag) labels ----

  keywordLabels(): { keyword: string; name: string; source: string }[] {
    return this.rows('SELECT keyword, name, source FROM imap_keyword_labels ORDER BY name').map(
      (row) => ({
        keyword: String(row.keyword),
        name: String(row.name),
        source: String(row.source),
      }),
    );
  }

  keywordLabel(keyword: string) {
    const row = this.rows(
      'SELECT keyword, name, source FROM imap_keyword_labels WHERE keyword = ?',
      keyword,
    )[0];
    return row
      ? { keyword: String(row.keyword), name: String(row.name), source: String(row.source) }
      : undefined;
  }

  keywordByName(name: string) {
    return this.rows(
      'SELECT keyword FROM imap_keyword_labels WHERE lower(name) = lower(?) LIMIT 1',
      name,
    ).map((row) => String(row.keyword))[0];
  }

  registerKeyword(keyword: string, name: string, source: 'app' | 'server' = 'app') {
    this.storage.exec(
      'INSERT OR IGNORE INTO imap_keyword_labels (keyword, name, source, created_at) VALUES (?, ?, ?, ?)',
      keyword,
      name,
      source,
      Date.now(),
    );
  }

  renameKeyword(keyword: string, name: string) {
    this.storage.exec('UPDATE imap_keyword_labels SET name = ? WHERE keyword = ?', name, keyword);
  }

  forgetKeyword(keyword: string) {
    this.storage.exec('DELETE FROM imap_keyword_labels WHERE keyword = ?', keyword);
  }

  /** Registers keywords seen on messages so other clients' tags show up as labels. */
  private noteKeywords(flags: string[]) {
    for (const flag of flags) {
      if (!isKeywordAtom(flag) || isReservedKeyword(flag)) continue;
      this.registerKeyword(flag, keywordDisplayName(flag), 'server');
    }
  }

  /** Locations of a thread's messages carrying a keyword, for bulk removal. */
  keywordLocations(keyword: string): { folder: string; uid: number; flags: string[] }[] {
    return this.rows(
      `SELECT l.folder, l.uid, l.flags FROM imap_locations l, json_each(l.flags) f
       WHERE lower(f.value) = lower(?)`,
      keyword,
    ).map((row) => ({
      folder: String(row.folder),
      uid: Number(row.uid),
      flags: JSON.parse(String(row.flags)) as string[],
    }));
  }

  private rows(sql: string, ...args: (string | number | null)[]): Row[] {
    return [...this.storage.exec(sql, ...args)];
  }

  private markDirty(threadId: string) {
    this.storage.exec(
      'INSERT OR IGNORE INTO imap_dirty_threads (thread_id, queued_at) VALUES (?, ?)',
      threadId,
      Date.now(),
    );
  }

  // ---- folders ----

  folders(): FolderState[] {
    return this.rows('SELECT * FROM imap_folders ORDER BY path').map((row) => ({
      path: String(row.path),
      labelId: String(row.label_id),
      system: row.system === null ? null : String(row.system),
      delimiter: row.delimiter === null ? null : String(row.delimiter),
      skip: !!row.skip,
      uidValidity: Number(row.uidvalidity),
      uidNext: Number(row.uidnext),
      highestModseq: Number(row.highestmodseq),
      messages: Number(row.messages),
      backfillCursor: Number(row.backfill_cursor),
      backfillDone: !!row.backfill_done,
      polls: Number(row.polls),
    }));
  }

  folder(path: string) {
    return this.folders().find((folder) => folder.path === path);
  }

  folderByLabel(labelId: string) {
    return this.folders().find((folder) => folder.labelId === labelId && !folder.skip);
  }

  upsertFolder(folder: Pick<FolderState, 'path' | 'labelId' | 'system' | 'delimiter' | 'skip'>) {
    this.storage.exec(
      `INSERT INTO imap_folders (path, label_id, system, delimiter, skip) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET label_id = excluded.label_id, system = excluded.system,
       delimiter = excluded.delimiter, skip = excluded.skip`,
      folder.path,
      folder.labelId,
      folder.system,
      folder.delimiter,
      folder.skip ? 1 : 0,
    );
  }

  updateFolderState(
    path: string,
    state: Partial<
      Pick<
        FolderState,
        | 'uidValidity'
        | 'uidNext'
        | 'highestModseq'
        | 'messages'
        | 'backfillCursor'
        | 'backfillDone'
        | 'polls'
      >
    >,
  ) {
    const columns: Record<string, string> = {
      uidValidity: 'uidvalidity',
      uidNext: 'uidnext',
      highestModseq: 'highestmodseq',
      messages: 'messages',
      backfillCursor: 'backfill_cursor',
      backfillDone: 'backfill_done',
      polls: 'polls',
    };
    for (const [field, value] of Object.entries(state)) {
      const column = columns[field];
      if (!column || value === undefined) continue;
      this.storage.exec(
        `UPDATE imap_folders SET ${column} = ? WHERE path = ?`,
        typeof value === 'boolean' ? (value ? 1 : 0) : value,
        path,
      );
    }
  }

  /** Drops a folder and every location in it (folder deleted or UIDVALIDITY changed). */
  resetFolder(path: string, { forget = false } = {}) {
    const uids = this.rows('SELECT uid FROM imap_locations WHERE folder = ?', path).map((row) =>
      Number(row.uid),
    );
    this.removeLocations(path, uids);
    if (forget) this.storage.exec('DELETE FROM imap_folders WHERE path = ?', path);
    else
      this.storage.exec(
        `UPDATE imap_folders SET uidvalidity = 0, uidnext = 0, highestmodseq = 0, messages = 0,
         backfill_cursor = 0, backfill_done = 0 WHERE path = ?`,
        path,
      );
  }

  knownUids(folder: string): number[] {
    return this.rows('SELECT uid FROM imap_locations WHERE folder = ? ORDER BY uid', folder).map(
      (row) => Number(row.uid),
    );
  }

  /** Newest known UIDs in a folder, for flag rescans on servers without CONDSTORE. */
  recentUids(folder: string, limit: number): number[] {
    return this.rows(
      'SELECT uid FROM imap_locations WHERE folder = ? ORDER BY uid DESC LIMIT ?',
      folder,
      limit,
    ).map((row) => Number(row.uid));
  }

  // ---- messages ----

  hasLocation(folder: string, uid: number) {
    return (
      this.rows('SELECT 1 FROM imap_locations WHERE folder = ? AND uid = ?', folder, uid).length > 0
    );
  }

  /** Records a message at a location, threading it if new. Returns its key and thread. */
  upsertMessage(input: {
    folder: string;
    uidValidity: number;
    uid: number;
    flags: string[];
    modseq?: number;
    size?: number;
    internalDate?: number | null;
    headers: ParsedHeaders;
  }): { key: string; threadId: string; created: boolean; category: MailCategory | null } {
    const { folder, uid, headers } = input;
    const key = headers.messageId
      ? stableId('m', headers.messageId)
      : stableId('u', `${folder}\n${input.uidValidity}\n${uid}`);

    let result!: { key: string; threadId: string; created: boolean; category: MailCategory | null };
    this.storage.transaction(() => {
      const existingAt = this.rows(
        'SELECT key FROM imap_locations WHERE folder = ? AND uid = ?',
        folder,
        uid,
      )[0];
      if (existingAt && existingAt.key !== key) this.removeLocationsUnsafe(folder, [uid]);

      let threadId = this.threadOf(key);
      const created = !threadId;
      if (!threadId) {
        threadId = this.assignThread(key, headers);
        const date = headers.date ?? input.internalDate ?? Date.now();
        this.storage.exec(
          `INSERT INTO imap_messages (key, message_id, thread_id, subject, subject_norm, date)
           VALUES (?, ?, ?, ?, ?, ?)`,
          key,
          headers.messageId,
          threadId,
          headers.subject,
          normalizeSubject(headers.subject),
          date,
        );
        const refs = new Set([
          ...headers.references,
          ...(headers.inReplyTo ? [headers.inReplyTo] : []),
        ]);
        for (const ref of refs)
          this.storage.exec('INSERT OR IGNORE INTO imap_refs (key, ref) VALUES (?, ?)', key, ref);
      }

      this.storage.exec(
        `INSERT INTO imap_locations (folder, uid, key, flags, modseq, size) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(folder, uid) DO UPDATE SET key = excluded.key, flags = excluded.flags,
         modseq = excluded.modseq, size = excluded.size`,
        folder,
        uid,
        key,
        JSON.stringify(input.flags),
        input.modseq ?? 0,
        input.size ?? 0,
      );
      this.noteKeywords(input.flags);
      const category = this.categorize(key, folder, headers);
      this.markDirty(threadId);
      result = { key, threadId, created, category };
    });
    return result;
  }

  /**
   * Sets a message's header category once the categorization headers were fetched (new
   * mail, or the categorization backfill re-fetching older mail). Sent mail records its
   * recipients as contacts instead. Returns the message's category.
   */
  private categorize(key: string, folder: string, headers: ParsedHeaders): MailCategory | null {
    const system = this.rows('SELECT system FROM imap_folders WHERE path = ?', folder)[0]?.system;
    if (system === 'SENT' || system === 'DRAFT') {
      if (system === 'SENT')
        for (const address of headers.recipients ?? []) this.addContact(address);
      return null;
    }
    const current = this.rows('SELECT category FROM imap_messages WHERE key = ?', key)[0]?.category;
    if (isMailCategory(current)) return current;
    // Header sets parsed by headersFromBlock always include the categorization fields.
    if (!headers.fields) return null;
    const knownContact =
      !!headers.from &&
      this.rows('SELECT 1 FROM imap_contacts WHERE address = ?', headers.from).length > 0;
    const category = classifyMessage({ headers: headers.fields, knownContact });
    const bulk =
      headers.fields.has('list-unsubscribe') ||
      /^(bulk|junk)$/i.test(headers.fields.get('precedence')?.[0] ?? '');
    this.storage.exec(
      'UPDATE imap_messages SET category = ?, sender = ?, bulk = ? WHERE key = ?',
      category,
      headers.from ?? null,
      bulk ? 1 : 0,
      key,
    );
    return category;
  }

  /**
   * Records someone the user wrote to. Their earlier non-bulk mail becomes Personal (the
   * initial sync can index the inbox before Sent).
   */
  private addContact(address: string) {
    if (this.rows('SELECT 1 FROM imap_contacts WHERE address = ?', address).length) return;
    this.storage.exec('INSERT INTO imap_contacts VALUES (?)', address);
    const threads = this.rows(
      `SELECT DISTINCT thread_id FROM imap_messages
       WHERE sender = ? AND bulk = 0 AND category IS NOT NULL AND category != 'personal'`,
      address,
    ).map((row) => String(row.thread_id));
    if (!threads.length) return;
    this.storage.exec(
      `UPDATE imap_messages SET category = 'personal'
       WHERE sender = ? AND bulk = 0 AND category IS NOT NULL AND category != 'personal'`,
      address,
    );
    for (const threadId of threads) this.markDirty(threadId);
  }

  /** Inbox UIDs whose messages predate categorization, newest first, for the backfill. */
  uncategorizedUids(folder: string, limit: number): number[] {
    return this.rows(
      `SELECT l.uid FROM imap_locations l JOIN imap_messages m ON m.key = l.key
       WHERE l.folder = ? AND m.category IS NULL ORDER BY l.uid DESC LIMIT ?`,
      folder,
      limit,
    ).map((row) => Number(row.uid));
  }

  /** The AI workflow's (or user's) category for a thread, overriding header rules. */
  setThreadCategory(threadId: string, category: MailCategory, source: 'ai' | 'user') {
    const current = this.rows(
      'SELECT category, source FROM imap_thread_category WHERE thread_id = ?',
      threadId,
    )[0];
    // A user's choice is never overwritten by the AI.
    if (current?.source === 'user' && source === 'ai') return false;
    if (current?.category === category && current?.source === source) return false;
    this.storage.exec(
      `INSERT INTO imap_thread_category VALUES (?, ?, ?) ON CONFLICT(thread_id)
       DO UPDATE SET category = excluded.category, source = excluded.source`,
      threadId,
      category,
      source,
    );
    this.markDirty(threadId);
    return true;
  }

  /** Queues a thread that received new incoming mail for the AI workflow. */
  recordNewMail(threadId: string) {
    this.storage.exec(
      'INSERT OR IGNORE INTO imap_new_mail (thread_id, queued_at) VALUES (?, ?)',
      threadId,
      Date.now(),
    );
  }

  /** Returns and clears the threads queued by recordNewMail. */
  takeNewMail(): string[] {
    let ids: string[] = [];
    this.storage.transaction(() => {
      ids = this.rows('SELECT thread_id FROM imap_new_mail ORDER BY queued_at').map((row) =>
        String(row.thread_id),
      );
      this.storage.exec('DELETE FROM imap_new_mail');
    });
    return ids;
  }

  private threadOf(key: string): string | null {
    const row = this.rows('SELECT thread_id FROM imap_messages WHERE key = ?', key)[0];
    return row ? String(row.thread_id) : null;
  }

  private assignThread(key: string, headers: ParsedHeaders): string {
    const parents = [
      ...new Set([...headers.references, ...(headers.inReplyTo ? [headers.inReplyTo] : [])]),
    ];
    const candidates: string[] = [];
    const add = (rows: Row[]) => {
      for (const row of rows) {
        const id = String(row.thread_id);
        if (!candidates.includes(id)) candidates.push(id);
      }
    };

    if (parents.length) {
      const placeholders = parents.map(() => '?').join(',');
      // Ancestors we already have.
      add(
        this.rows(
          `SELECT thread_id, MIN(date) AS first FROM imap_messages WHERE message_id IN (${placeholders})
           GROUP BY thread_id ORDER BY first`,
          ...parents,
        ),
      );
      // Siblings that reference the same ancestors (root may be outside the synced window).
      add(
        this.rows(
          `SELECT m.thread_id, MIN(m.date) AS first FROM imap_refs r JOIN imap_messages m ON m.key = r.key
           WHERE r.ref IN (${placeholders}) GROUP BY m.thread_id ORDER BY first`,
          ...parents,
        ),
      );
    }
    if (headers.messageId) {
      // Replies that arrived before this message.
      add(
        this.rows(
          `SELECT m.thread_id, MIN(m.date) AS first FROM imap_refs r JOIN imap_messages m ON m.key = r.key
           WHERE r.ref = ? GROUP BY m.thread_id ORDER BY first`,
          headers.messageId,
        ),
      );
    }
    if (!candidates.length && isReplySubject(headers.subject)) {
      const subject = normalizeSubject(headers.subject);
      const date = headers.date ?? Date.now();
      if (subject.length >= 3)
        add(
          this.rows(
            `SELECT thread_id FROM imap_messages WHERE subject_norm = ? AND date BETWEEN ? AND ?
             ORDER BY date DESC LIMIT 1`,
            subject,
            date - 30 * DAY,
            date + DAY,
          ),
        );
    }

    if (!candidates.length) {
      const root = parents[0] ?? headers.messageId ?? key;
      return stableId('t', root);
    }
    const [target, ...others] = candidates as [string, ...string[]];
    for (const other of others) {
      this.storage.exec(
        'UPDATE imap_messages SET thread_id = ? WHERE thread_id = ?',
        target,
        other,
      );
      // The merged-away thread is now empty; re-importing it lets the mailbox delete it.
      this.markDirty(other);
      // New mail owed to the merged-away thread is owed to the surviving one.
      if (this.rows('SELECT 1 FROM imap_new_mail WHERE thread_id = ?', other).length) {
        this.storage.exec('DELETE FROM imap_new_mail WHERE thread_id = ?', other);
        this.recordNewMail(target);
      }
    }
    return target;
  }

  updateFlags(folder: string, uid: number, flags: string[], modseq?: number) {
    const row = this.rows(
      `SELECT l.flags, m.thread_id FROM imap_locations l JOIN imap_messages m ON m.key = l.key
       WHERE l.folder = ? AND l.uid = ?`,
      folder,
      uid,
    )[0];
    if (!row) return false;
    const next = JSON.stringify([...flags].sort());
    const previous = JSON.stringify([...(JSON.parse(String(row.flags)) as string[])].sort());
    this.storage.exec(
      'UPDATE imap_locations SET flags = ?, modseq = ? WHERE folder = ? AND uid = ?',
      JSON.stringify(flags),
      modseq ?? 0,
      folder,
      uid,
    );
    if (next === previous) return false;
    this.noteKeywords(flags);
    this.markDirty(String(row.thread_id));
    return true;
  }

  keyAt(folder: string, uid: number): string | null {
    const row = this.rows(
      'SELECT key FROM imap_locations WHERE folder = ? AND uid = ?',
      folder,
      uid,
    )[0];
    return row ? String(row.key) : null;
  }

  /** Moves a location after a MOVE/COPY with known destination UID (keeps the message key). */
  relocate(from: { folder: string; uid: number }, to: { folder: string; uid: number }) {
    const row = this.rows(
      'SELECT key, flags, size FROM imap_locations WHERE folder = ? AND uid = ?',
      from.folder,
      from.uid,
    )[0];
    if (!row) return;
    this.storage.transaction(() => {
      this.storage.exec(
        'DELETE FROM imap_locations WHERE folder = ? AND uid = ?',
        from.folder,
        from.uid,
      );
      this.storage.exec(
        `INSERT OR REPLACE INTO imap_locations (folder, uid, key, flags, modseq, size)
         VALUES (?, ?, ?, ?, 0, ?)`,
        to.folder,
        to.uid,
        String(row.key),
        String(row.flags),
        Number(row.size),
      );
      const threadId = this.threadOf(String(row.key));
      if (threadId) this.markDirty(threadId);
    });
  }

  removeLocations(folder: string, uids: number[]) {
    if (!uids.length) return;
    this.storage.transaction(() => this.removeLocationsUnsafe(folder, uids));
  }

  /** removeLocations without its own transaction, for use inside one. */
  private removeLocationsUnsafe(folder: string, uids: number[]) {
    for (const uid of uids) {
      const row = this.rows(
        'SELECT key FROM imap_locations WHERE folder = ? AND uid = ?',
        folder,
        uid,
      )[0];
      if (!row) continue;
      const key = String(row.key);
      this.storage.exec('DELETE FROM imap_locations WHERE folder = ? AND uid = ?', folder, uid);
      const threadId = this.threadOf(key);
      if (threadId) this.markDirty(threadId);
      if (!this.rows('SELECT 1 FROM imap_locations WHERE key = ? LIMIT 1', key).length) {
        this.storage.exec('DELETE FROM imap_messages WHERE key = ?', key);
        this.storage.exec('DELETE FROM imap_refs WHERE key = ?', key);
      }
    }
  }

  threadMessages(threadId: string): StoredMessage[] {
    const messages = this.rows(
      `SELECT m.key, m.message_id, m.thread_id, m.date, m.subject, m.category,
        c.category AS thread_category FROM imap_messages m
        LEFT JOIN imap_thread_category c ON c.thread_id = m.thread_id WHERE m.thread_id = ? ORDER BY m.date, m.rowid`,
      threadId,
    );
    return messages.map((row) => this.withLocations(row));
  }

  message(key: string): StoredMessage | null {
    const row = this.rows(
      `SELECT m.key, m.message_id, m.thread_id, m.date, m.subject, m.category,
        c.category AS thread_category FROM imap_messages m
        LEFT JOIN imap_thread_category c ON c.thread_id = m.thread_id WHERE m.key = ?`,
      key,
    )[0];
    return row ? this.withLocations(row) : null;
  }

  private withLocations(row: Row): StoredMessage {
    const locations = this.rows(
      'SELECT folder, uid, flags, size FROM imap_locations WHERE key = ? ORDER BY folder, uid',
      String(row.key),
    ).map((location) => ({
      folder: String(location.folder),
      uid: Number(location.uid),
      flags: JSON.parse(String(location.flags)) as string[],
      size: Number(location.size),
    }));
    return {
      key: String(row.key),
      messageId: row.message_id === null ? null : String(row.message_id),
      threadId: String(row.thread_id),
      date: Number(row.date),
      subject: String(row.subject),
      category: isMailCategory(row.category) ? row.category : null,
      threadCategory: isMailCategory(row.thread_category) ? row.thread_category : null,
      locations,
    };
  }

  /** Thread ids for locations in a folder (e.g. search hits). */
  threadsForUids(folder: string, uids: number[]): string[] {
    const out: string[] = [];
    for (let i = 0; i < uids.length; i += 500) {
      const chunk = uids.slice(i, i + 500);
      const placeholders = chunk.map(() => '?').join(',');
      for (const row of this.rows(
        `SELECT DISTINCT m.thread_id, MAX(m.date) AS latest FROM imap_locations l
         JOIN imap_messages m ON m.key = l.key
         WHERE l.folder = ? AND l.uid IN (${placeholders}) GROUP BY m.thread_id`,
        folder,
        ...chunk,
      ))
        out.push(String(row.thread_id));
    }
    return out;
  }

  /** Thread ids with a message in `folder`, newest first. */
  threadsInFolder(folder: string, limit: number, before?: number) {
    return this.rows(
      `SELECT m.thread_id, MAX(m.date) AS latest FROM imap_locations l
       JOIN imap_messages m ON m.key = l.key WHERE l.folder = ?
       GROUP BY m.thread_id HAVING (? IS NULL OR latest < ?) ORDER BY latest DESC LIMIT ?`,
      folder,
      before ?? null,
      before ?? null,
      limit,
    ).map((row) => ({ threadId: String(row.thread_id), latest: Number(row.latest) }));
  }

  /** All thread ids, newest first. */
  threadsByDate(limit: number, offset: number): string[] {
    return this.rows(
      `SELECT thread_id, MAX(date) AS latest FROM imap_messages GROUP BY thread_id
       ORDER BY latest DESC LIMIT ? OFFSET ?`,
      limit,
      offset,
    ).map((row) => String(row.thread_id));
  }

  dirtyThreads(limit: number): string[] {
    return this.rows(
      'SELECT thread_id FROM imap_dirty_threads ORDER BY queued_at LIMIT ?',
      limit,
    ).map((row) => String(row.thread_id));
  }

  dirtyCount() {
    return Number(this.rows('SELECT COUNT(*) AS n FROM imap_dirty_threads')[0]?.n ?? 0);
  }

  clearDirty(threadIds: string[]) {
    for (const id of threadIds)
      this.storage.exec('DELETE FROM imap_dirty_threads WHERE thread_id = ?', id);
  }

  dropAll() {
    for (const table of [
      'imap_folders',
      'imap_messages',
      'imap_refs',
      'imap_locations',
      'imap_dirty_threads',
      'imap_new_mail',
      'imap_keyword_labels',
      'imap_thread_category',
      'imap_contacts',
    ])
      this.storage.exec(`DELETE FROM ${table}`);
  }
}
