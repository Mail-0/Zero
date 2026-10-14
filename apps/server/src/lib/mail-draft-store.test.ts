import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LabelStorage } from './mail-label-store';
import { MailDraftStore } from './mail-draft-store';
import type { ParsedDraft } from './driver/types';
import { DatabaseSync } from 'node:sqlite';

const databases: DatabaseSync[] = [];
afterEach(() => databases.splice(0).forEach((db) => db.close()));

function fixture() {
  const db = new DatabaseSync(':memory:');
  databases.push(db);
  const storage: LabelStorage = {
    exec(query, ...args) {
      const statement = db.prepare(query);
      return /^\s*SELECT/i.test(query)
        ? (statement.all(...args) as Record<string, string | number | null>[])
        : (statement.run(...args), []);
    },
    transaction(fn) {
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
  const store = new MailDraftStore(storage);
  store.initialize();
  return { db, store, reopen: () => new MailDraftStore(storage) };
}

const draft: ParsedDraft = { id: 'd', subject: 'draft', content: 'first' };
const page = {
  threads: [{ id: 'd', historyId: 'm', $raw: { receivedOn: new Date(0) } }],
  nextPageToken: 'next+/=',
};

describe('short-lived durable draft reads', () => {
  it('coalesces detail reads, persists them across restart, and expires them after five seconds', async () => {
    const { store, reopen } = fixture();
    const load = vi.fn(async () => draft);
    expect(
      await Promise.all(Array.from({ length: 8 }, () => store.get('d', 0, '100', load))),
    ).toEqual(Array(8).fill(draft));
    expect(await reopen().get('d', 1000, '100', load)).toEqual(draft);
    expect(load).toHaveBeenCalledTimes(1);
    await store.get('d', 5000, '100', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('preserves draft-list dates and page tokens while isolating query, size and page', async () => {
    const { store, reopen } = fixture();
    const load = vi.fn(async () => page);
    await store.list({}, 0, '100', load);
    expect(await reopen().list({ maxResults: 20, q: '' }, 1, '100', load)).toEqual(page);
    expect(load).toHaveBeenCalledTimes(1);
    for (const params of [
      { q: 'subject:"hello  world"' },
      { maxResults: 5 },
      { pageToken: 'next+/=' },
    ])
      await store.list(params, 2, '100', load);
    await store.list({}, 10000, '100', load);
    expect(load).toHaveBeenCalledTimes(5);
  });

  it('fences detail/list caches on edits, sends or deletes, including older in-flight reads', async () => {
    const { store } = fixture();
    let resolve!: (value: ParsedDraft) => void;
    const old = store.get(
      'd',
      0,
      '100',
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const list = vi.fn(async () => page);
    await store.list({}, 0, '100', list);
    store.invalidate();
    const updated = { ...draft, content: 'updated' };
    const load = vi.fn(async () => updated);
    expect(await store.get('d', 1, '100', load)).toEqual(updated);
    resolve(draft);
    await old;
    expect(await store.get('d', 2, '100', load)).toEqual(updated);
    await store.list({}, 2, '100', list);
    expect(list).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('invalidates external history changes and never caches failed draft reads', async () => {
    const { store } = fixture();
    const load = vi.fn(async () => draft);
    await store.get('d', 0, '100', load);
    load.mockRejectedValueOnce(new Error('not found'));
    await expect(store.get('d', 1, '101', load)).rejects.toThrow('not found');
    expect(await store.get('d', 2, '101', load)).toEqual(draft);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('keeps oversized UTF-8 drafts readable without storing oversized SQLite rows', async () => {
    const { db, store } = fixture();
    const large = { ...draft, content: '😀'.repeat(300000) };
    const load = vi.fn(async () => large);
    expect(await store.get('d', 0, '100', load)).toEqual(large);
    expect(db.prepare('SELECT COUNT(*) AS n FROM mail_draft_cache').get()?.n).toBe(0);
  });

  it('isolates mailbox storage and caps the number of cached draft entries', async () => {
    const { db, store } = fixture();
    const other = fixture().store;
    const load = vi.fn(async () => draft);
    for (let i = 0; i < 140; i++) await store.get(`d${i}`, 0, '100', load);
    expect(db.prepare('SELECT COUNT(*) AS n FROM mail_draft_cache').get()?.n).toBe(128);
    await other.get('d139', 0, '100', load);
    expect(load).toHaveBeenCalledTimes(141);
  });
});
