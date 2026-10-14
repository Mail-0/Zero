import { MailSearchStore, type MailSearch } from './mail-search-store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IGetThreadsResponse } from './driver/types';
import type { LabelStorage } from './mail-label-store';
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
  const store = new MailSearchStore(storage);
  store.initialize();
  return { db, store, reopen: () => new MailSearchStore(storage) };
}

const search: MailSearch = { folder: 'inbox', query: 'subject:"hello  world"' };
const page: IGetThreadsResponse = {
  threads: [{ id: 'a', historyId: null, $raw: { snippet: 'not stored' } }],
  nextPageToken: 'opaque+/=token',
};
const membership = { threads: [{ id: 'a', historyId: null }], nextPageToken: page.nextPageToken };

describe('mailbox search membership cache', () => {
  it('coalesces repeated searches, persists pages across restart, and expires them after 30 seconds', async () => {
    const { db, store, reopen } = fixture();
    let resolve!: (value: IGetThreadsResponse) => void;
    const load = vi.fn(
      () =>
        new Promise<IGetThreadsResponse>((done) => {
          resolve = done;
        }),
    );
    const first = store.read(search, 0, 'cursor-100', load);
    const second = store.read(search, 0, 'cursor-100', load);
    resolve(page);
    expect(await first).toEqual(membership);
    expect(await second).toEqual(membership);
    expect(await reopen().read(search, 1000, 'cursor-100', load)).toEqual(membership);
    expect(load).toHaveBeenCalledTimes(1);
    expect(
      String(db.prepare('SELECT response FROM mail_search_cache').get()?.response),
    ).not.toContain('snippet');
    load.mockImplementation(async () => page);
    await store.read(search, 30000, 'cursor-100', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('canonicalizes label sets but preserves quoted query whitespace and opaque page tokens', async () => {
    const { store } = fixture();
    const load = vi.fn<(params: MailSearch) => Promise<IGetThreadsResponse>>(async () => page);
    await store.read({ ...search, labelIds: ['Label_2', 'Label_1', 'Label_2'] }, 0, '100', load);
    await store.read(
      { ...search, query: `  ${search.query}  `, labelIds: ['Label_1', 'Label_2'] },
      1,
      '100',
      load,
    );
    expect(load).toHaveBeenCalledTimes(1);
    await store.read(
      { ...search, query: 'subject:"hello world"', labelIds: ['Label_1', 'Label_2'] },
      2,
      '100',
      load,
    );
    await store.read({ ...search, pageToken: 'opaque+/=token' }, 3, '100', load);
    expect(load).toHaveBeenCalledTimes(3);
    expect(load.mock.calls[2]?.[0].pageToken).toBe('opaque+/=token');
  });

  it('separates folder, page size, label filters, pages, and mailbox storage', async () => {
    const { store } = fixture();
    const other = fixture().store;
    const load = vi.fn(async () => page);
    for (const params of [
      search,
      { ...search, folder: 'spam' },
      { ...search, maxResults: 5 },
      { ...search, labelIds: ['Label_1'] },
      { ...search, pageToken: 'next' },
    ]) {
      await store.read(params, 0, '100', load);
    }
    await other.read(search, 0, '100', load);
    expect(load).toHaveBeenCalledTimes(6);
  });

  it('refreshes when history advances and fences an invalidated in-flight response', async () => {
    const { store } = fixture();
    const load = vi.fn(async () => page);
    await store.read(search, 0, '100', load);
    await store.read(search, 1, '101', load);
    expect(load).toHaveBeenCalledTimes(2);
    store.invalidate();
    let resolve!: (value: IGetThreadsResponse) => void;
    const delayed = vi.fn(
      () =>
        new Promise<IGetThreadsResponse>((done) => {
          resolve = done;
        }),
    );
    const stale = store.read(search, 2, '101', delayed);
    store.invalidate();
    const fresh = { threads: [{ id: 'b', historyId: '102' }], nextPageToken: null };
    load.mockResolvedValue(fresh);
    expect(await store.read(search, 3, '101', load)).toEqual(fresh);
    resolve(page);
    await stale;
    expect(await store.read(search, 4, '101', load)).toEqual(fresh);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('does not cache provider errors or substitute stale membership for a failed refresh', async () => {
    const { db, store } = fixture();
    const load = vi.fn(async () => page);
    await store.read(search, 0, '100', load);
    load.mockRejectedValueOnce(new Error('quota deferred'));
    await expect(store.read(search, 1, '101', load)).rejects.toThrow('quota deferred');
    expect(db.prepare('SELECT stamp FROM mail_search_cache').get()?.stamp).toBe('[0,"100"]');
    expect(await store.read(search, 2, '101', load)).toEqual(membership);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('bounds persistent cache growth and prunes expired pages on new searches', async () => {
    const { db, store } = fixture();
    const load = vi.fn(async () => page);
    for (let i = 0; i < 140; i++)
      await store.read({ ...search, query: `subject:${i}` }, i, '100', load);
    expect(db.prepare('SELECT COUNT(*) AS n FROM mail_search_cache').get()?.n).toBe(128);
    await store.read(search, 40000, '100', load);
    expect(db.prepare('SELECT COUNT(*) AS n FROM mail_search_cache').get()?.n).toBe(1);
  });
});
