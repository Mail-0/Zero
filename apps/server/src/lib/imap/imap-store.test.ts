import {
  ImapIndexStore,
  decodeEncodedWords,
  headersFromBlock,
  normalizeSubject,
  type ParsedHeaders,
} from './imap-store';
import { folderLabelId, folderPathFromLabelId, folderSyncOrder, mapFolders } from './folders';
import type { LabelStorage } from '../mail-label-store';
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

const fixture = () => {
  const db = new DatabaseSync(':memory:');
  const storage: LabelStorage = {
    exec: (query, ...args) => {
      const statement = db.prepare(query);
      return /^\s*(SELECT|PRAGMA)/i.test(query)
        ? (statement.all(...args) as Record<string, string | number | null>[])
        : (statement.run(...args), []);
    },
    transaction: (fn) => {
      db.exec('BEGIN');
      try {
        fn();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
  const store = new ImapIndexStore(storage);
  store.initialize();
  return store;
};

const headers = (overrides: Partial<ParsedHeaders>): ParsedHeaders => ({
  messageId: null,
  inReplyTo: null,
  references: [],
  subject: 'Hello',
  date: Date.parse('2026-01-01T00:00:00Z'),
  ...overrides,
});

let nextUid = 1;
const add = (
  store: ImapIndexStore,
  h: Partial<ParsedHeaders>,
  folder = 'INBOX',
  flags: string[] = [],
) => store.upsertMessage({ folder, uidValidity: 1, uid: nextUid++, flags, headers: headers(h) });

describe('mapFolders', () => {
  it('prefers SPECIAL-USE, falls back to names and skips virtual folders', () => {
    const folders = mapFolders([
      { path: 'INBOX', delimiter: '.', flags: [] },
      { path: 'INBOX.Sent', delimiter: '.', flags: [] },
      { path: 'Sent Messages', delimiter: '.', flags: ['\\Sent'] },
      { path: 'Papierkorb', delimiter: '.', flags: [] },
      { path: '[Gmail].All Mail', delimiter: '.', flags: ['\\All'] },
      { path: 'Projects.Zero', delimiter: '.', flags: [] },
      { path: 'Projects', delimiter: '.', flags: ['\\Noselect'] },
    ]);
    const by = (path: string) => folders.find((f) => f.path === path)!;
    expect(by('INBOX').labelId).toBe('INBOX');
    expect(by('Sent Messages').labelId).toBe('SENT');
    expect(by('INBOX.Sent').system).toBeNull();
    expect(by('INBOX.Sent').name).toBe('Sent');
    expect(by('Papierkorb').labelId).toBe('TRASH');
    expect(by('[Gmail].All Mail').skip).toBe(true);
    expect(by('Projects').skip).toBe(true);
    expect(by('Projects.Zero').name).toBe('Projects/Zero');
    expect(folderPathFromLabelId(by('Projects.Zero').labelId)).toBe('Projects.Zero');
    expect(folderSyncOrder(folders).map((f) => f.path)).toEqual([
      'INBOX',
      'Sent Messages',
      'Papierkorb',
      'INBOX.Sent',
      'Projects.Zero',
    ]);
  });

  it('label ids are URL safe and reversible for unicode paths', () => {
    const id = folderLabelId('Ünïcode/Földer');
    expect(id).toMatch(/^F_[A-Za-z0-9_-]+$/);
    expect(folderPathFromLabelId(id)).toBe('Ünïcode/Földer');
    expect(folderPathFromLabelId('INBOX')).toBeNull();
  });
});

describe('headers', () => {
  it('parses folded headers and encoded words', () => {
    const parsed = headersFromBlock(
      'Message-ID: <a@x>\r\nReferences: <r1@x>\r\n <r2@x>\r\nSubject: =?UTF-8?B?SMOpbGxv?= world\r\nDate: Thu, 01 Jan 2026 10:00:00 +0000\r\n',
    );
    expect(parsed).toMatchObject({
      messageId: 'a@x',
      inReplyTo: null,
      references: ['r1@x', 'r2@x'],
      subject: 'Héllo world',
      date: Date.parse('2026-01-01T10:00:00Z'),
    });
    expect(decodeEncodedWords('=?iso-8859-1?Q?caf=E9_ok?=')).toBe('café ok');
    expect(normalizeSubject('Re: AW: Fwd:  Plans  ')).toBe('plans');
  });
});

describe('ImapIndexStore threading', () => {
  it('threads replies by In-Reply-To and References', () => {
    const store = fixture();
    const root = add(store, { messageId: 'root@x' });
    const reply = add(
      store,
      { messageId: 'r1@x', inReplyTo: 'root@x', references: ['root@x'] },
      'SENT',
    );
    const reply2 = add(store, { messageId: 'r2@x', references: ['root@x', 'r1@x'] });
    expect(reply.threadId).toBe(root.threadId);
    expect(reply2.threadId).toBe(root.threadId);
    expect(store.threadMessages(root.threadId).map((m) => m.messageId)).toEqual([
      'root@x',
      'r1@x',
      'r2@x',
    ]);
  });

  it('merges threads when a parent arrives after its replies', () => {
    const store = fixture();
    const a = add(store, { messageId: 'c1@x', references: ['p@x'] });
    const b = add(store, { messageId: 'c2@x', inReplyTo: 'other@x' });
    expect(a.threadId).not.toBe(b.threadId);
    // Parent references other@x and is referenced by c1 -> links both threads.
    const parent = add(store, { messageId: 'p@x', references: ['other@x'] });
    const otherThread = parent.threadId === a.threadId ? b.threadId : a.threadId;
    expect(store.threadMessages(parent.threadId)).toHaveLength(3);
    expect(store.threadMessages(otherThread)).toHaveLength(0);
    expect(store.dirtyThreads(10)).toEqual(expect.arrayContaining([a.threadId, b.threadId]));
  });

  it('dedupes the same Message-ID across folders and keeps the key when moved', () => {
    const store = fixture();
    const inbox = store.upsertMessage({
      folder: 'INBOX',
      uidValidity: 1,
      uid: 5,
      flags: [],
      headers: headers({ messageId: 'self@x' }),
    });
    const sent = store.upsertMessage({
      folder: 'Sent',
      uidValidity: 1,
      uid: 9,
      flags: ['\\Seen'],
      headers: headers({ messageId: 'self@x' }),
    });
    expect(sent.key).toBe(inbox.key);
    expect(store.message(inbox.key)?.locations.map((l) => l.folder)).toEqual(['INBOX', 'Sent']);
    store.relocate({ folder: 'INBOX', uid: 5 }, { folder: 'Archive', uid: 40 });
    expect(store.message(inbox.key)?.locations.map((l) => l.folder)).toEqual(['Archive', 'Sent']);
  });

  it('falls back to subject for replies without references', () => {
    const store = fixture();
    const first = add(store, { messageId: 's1@x', subject: 'Quarterly plan' });
    const reply = add(store, { messageId: 's2@x', subject: 'RE: Quarterly plan' });
    const unrelated = add(store, { messageId: 's3@x', subject: 'Quarterly plan' });
    expect(reply.threadId).toBe(first.threadId);
    expect(unrelated.threadId).not.toBe(first.threadId);
  });

  it('removes messages with their last location and tracks flag changes', () => {
    const store = fixture();
    const m = store.upsertMessage({
      folder: 'INBOX',
      uidValidity: 1,
      uid: 1,
      flags: [],
      headers: headers({ messageId: 'gone@x' }),
    });
    store.clearDirty(store.dirtyThreads(10));
    expect(store.updateFlags('INBOX', 1, ['\\Seen'])).toBe(true);
    expect(store.updateFlags('INBOX', 1, ['\\Seen'])).toBe(false);
    expect(store.dirtyThreads(10)).toEqual([m.threadId]);
    store.removeLocations('INBOX', [1]);
    expect(store.message(m.key)).toBeNull();
    expect(store.threadMessages(m.threadId)).toEqual([]);
  });
});
