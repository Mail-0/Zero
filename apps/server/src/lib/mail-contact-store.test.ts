import { afterEach, describe, expect, it } from 'vitest';
import { MailContactStore } from './mail-contact-store';
import type { LabelStorage } from './mail-label-store';
import { DatabaseSync } from 'node:sqlite';

const dbs: DatabaseSync[] = [];
function setup() {
  const db = new DatabaseSync(':memory:');
  dbs.push(db);
  const storage: LabelStorage = {
    exec(query, ...args) {
      const statement = db.prepare(query);
      return /^\s*(SELECT|PRAGMA)/i.test(query)
        ? (statement.all(...args) as Record<string, string | number | null>[])
        : (statement.run(...args), []);
    },
    transaction(run) {
      db.exec('BEGIN');
      try {
        const result = run();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
  db.exec('CREATE TABLE threads (thread_id TEXT PRIMARY KEY, summary_json TEXT)');
  const store = new MailContactStore(storage);
  store.initialize();
  return { db, store };
}
afterEach(() => {
  for (const db of dbs.splice(0)) db.close();
});

describe('mailbox-scoped known contacts', () => {
  it('finds stored correspondent names/addresses without exposing message bodies or Bcc', () => {
    const { store } = setup();
    store.observe([
      {
        sender: { email: 'sarah@example.com', name: 'Sarah Chen' },
        to: [{ email: 'second@example.com', name: 'Sarah Jones' }],
        cc: [],
        bcc: [{ email: 'private@example.com', name: 'Sarah Private' }],
      },
    ]);
    expect(store.search('Sarah', 10).contacts).toEqual([
      { email: 'sarah@example.com', name: 'Sarah Chen' },
      { email: 'second@example.com', name: 'Sarah Jones' },
    ]);
  });
  it('isolates mailboxes and bounds results, returning ambiguity instead of choosing a person', () => {
    const a = setup().store,
      b = setup().store;
    a.observe([
      { sender: { email: 'a@example.com', name: 'Sam A' }, to: [], cc: [] },
      { sender: { email: 'b@example.com', name: 'Sam B' }, to: [], cc: [] },
    ]);
    expect(a.search('Sam', 1)).toMatchObject({
      contacts: [{ email: 'a@example.com', name: 'Sam A' }],
      hasMore: true,
    });
    expect(b.search('Sam', 10).contacts).toEqual([]);
  });
  it('backfills existing body-free thread summaries in bounded batches and reports incomplete coverage', () => {
    const { db, store } = setup();
    for (let i = 0; i < 3; i++)
      db.prepare('INSERT INTO threads VALUES (?,?)').run(
        String(i),
        JSON.stringify({
          v: 1,
          latest: { sender: { email: `sam${i}@example.com`, name: `Sam ${i}` }, to: [], cc: [] },
        }),
      );
    expect(store.backfill(2)).toBe(false);
    expect(store.backfill(2)).toBe(true);
    expect(store.search('Sam', 10).contacts).toHaveLength(3);
  });
  it('escapes wildcard input, rejects invented addresses and updates known names', () => {
    const { store } = setup();
    store.observe([
      { sender: { email: 'sam@example.com', name: 'Old' }, to: [], cc: [] },
      { sender: { email: 'invalid', name: 'Sam' }, to: [], cc: [] },
    ]);
    store.observe([{ sender: { email: 'SAM@example.com', name: 'Sam New' }, to: [], cc: [] }]);
    expect(store.search('%', 10).contacts).toEqual([]);
    expect(store.search('Sam', 10).contacts).toEqual([
      { email: 'sam@example.com', name: 'Sam New' },
    ]);
  });
});
