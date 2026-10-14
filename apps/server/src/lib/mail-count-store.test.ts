import { MailLabelStore, type LabelStorage } from './mail-label-store';
import { MailCountStore, type MailCount } from './mail-count-store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MailHistoryStore } from './mail-history-store';
import { DatabaseSync } from 'node:sqlite';

const databases: DatabaseSync[] = [];
afterEach(() => databases.splice(0).forEach((db) => db.close()));

function fixture() {
  const db = new DatabaseSync(':memory:');
  databases.push(db);
  const storage: LabelStorage = {
    exec(query, ...args) {
      const statement = db.prepare(query);
      return /^\s*(SELECT|PRAGMA|WITH)/i.test(query)
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
  db.exec('CREATE TABLE threads (thread_id TEXT PRIMARY KEY)');
  const labels = new MailLabelStore(storage);
  labels.initialize();
  const history = new MailHistoryStore(storage);
  history.initialize();
  const counts = new MailCountStore(storage);
  counts.initialize();
  return { db, labels, history, counts, reopen: () => new MailCountStore(storage) };
}

const catalogue = ['INBOX', 'UNREAD', 'STARRED', 'IMPORTANT', 'SPAM', 'TRASH', 'DRAFT', 'SENT'].map(
  (id) => ({ id, name: id }),
);
const baseline: MailCount[] = [
  { labelId: 'INBOX', label: 'inbox', count: 12000 },
  { labelId: 'DRAFT', label: 'drafts', count: 8 },
  { label: 'archive', count: 34000 },
];
const values = (rows: MailCount[]) => Object.fromEntries(rows.map((row) => [row.label, row.count]));

describe('storage-backed mailbox counts', () => {
  it('persists a throttled refresh and a retryable notification after the browser invalidation is consumed', async () => {
    const { counts, reopen } = fixture();
    const load = vi.fn(async () => baseline);
    const names = vi.fn(async () => catalogue);
    await counts.read(0, '100', load, names);
    await counts.read(1000, '101', load, names);
    expect(counts.pendingRefresh()).toEqual({ due: 30000, ready: false });
    const restored = reopen();
    restored.initialize();
    expect(restored.pendingRefresh()).toEqual({ due: 30000, ready: false });
    await restored.read(29000, '101', load, names);
    expect(load).toHaveBeenCalledTimes(1);
    const changed = baseline.map((row) => ({ ...row, count: row.count + 1 }));
    load.mockResolvedValueOnce(changed);
    expect(await restored.read(30000, '101', load, names)).toEqual(changed);
    expect(restored.pendingRefresh()?.ready).toBe(true);
    // Delivery can fail or the worker can restart after refreshing the snapshot.
    // Retain the notification without making another provider request.
    const notified = reopen();
    notified.initialize();
    expect(notified.pendingRefresh()?.ready).toBe(true);
    await notified.read(31000, '101', load, names);
    expect(load).toHaveBeenCalledTimes(2);
    notified.acknowledgeRefreshNotification();
    expect(notified.pendingRefresh()).toBeUndefined();
  });

  it('defers failed background count refreshes across restart without serving them as complete', async () => {
    const { counts, reopen } = fixture();
    const load = vi.fn(async () => baseline);
    const names = vi.fn(async () => catalogue);
    await counts.read(0, '100', load, names);
    await counts.read(1000, '101', load, names);
    load.mockRejectedValueOnce(new Error('quota unavailable'));
    await counts.read(30000, '101', load, names);
    expect(counts.pendingRefresh()).toEqual({ due: 60000, ready: false });
    const restored = reopen();
    restored.initialize();
    await restored.read(59999, '101', load, names);
    expect(load).toHaveBeenCalledTimes(2);
    await restored.read(60000, '101', load, names);
    expect(load).toHaveBeenCalledTimes(3);
    expect(restored.pendingRefresh()?.ready).toBe(true);
  });

  it('counts distinct threads with label-scoped unread messages, totals drafts/sent, and excludes inbox/spam/trash from archive', () => {
    const { labels, counts } = fixture();
    counts.saveCatalogue([...catalogue, { id: 'Label_123', name: 'Work/Projects' }], 0);
    labels.importMessages('a', [
      { id: 'a1', labels: ['INBOX', 'Label_123'] },
      { id: 'a2', labels: ['SENT', 'UNREAD'] },
    ]);
    labels.importMessages('b', [
      { id: 'b1', labels: ['INBOX', 'UNREAD', 'Label_123'] },
      { id: 'b2', labels: ['INBOX', 'UNREAD', 'Label_123'] },
    ]);
    labels.importMessages('archive', [{ id: 'c', labels: ['SENT'] }]);
    labels.importMessages('draft', [{ id: 'd', labels: ['DRAFT', 'UNREAD'] }]);
    labels.importMessages('spam', [{ id: 's', labels: ['SPAM', 'UNREAD'] }]);
    labels.importMessages('trash', [{ id: 't', labels: ['TRASH', 'UNREAD'] }]);
    expect(values(counts.localCounts())).toEqual({
      inbox: 1,
      unread: 4,
      starred: 0,
      important: 0,
      spam: 1,
      trash: 1,
      drafts: 1,
      sent: 2,
      'work/projects': 1,
      archive: 1,
    });
  });

  it('includes pending read and folder changes immediately and removes deleted messages', () => {
    const { labels, counts } = fixture();
    counts.saveCatalogue(catalogue, 0);
    labels.importMessages('a', [{ id: 'm', labels: ['INBOX', 'UNREAD'] }]);
    labels.setUnread('a', false, 0);
    expect(values(counts.localCounts()).inbox).toBe(0);
    labels.setThreadLabels(['a'], ['SPAM', 'IMPORTANT'], ['INBOX'], 0);
    labels.setUnread('a', true, 0);
    expect(values(counts.localCounts())).toMatchObject({
      inbox: 0,
      spam: 1,
      important: 1,
      archive: 0,
    });
    labels.setThreadLabels(['a'], [], ['SPAM'], 0);
    expect(values(counts.localCounts()).archive).toBe(1);
    labels.deleteMessage('m');
    expect(values(counts.localCounts())).toMatchObject({ spam: 0, important: 0, archive: 0 });
  });

  it('requires finished enumeration, all jobs drained, and message coverage before using local totals', () => {
    const { db, history, labels, counts } = fixture();
    expect(counts.hasCompleteCoverage()).toBe(false);
    db.exec("UPDATE mailbox_history SET cursor = '100'");
    expect(counts.hasCompleteCoverage()).toBe(true);
    history.enqueue('a', 'backfill');
    expect(counts.hasCompleteCoverage()).toBe(false);
    db.exec('DELETE FROM mailbox_import_jobs');
    db.exec("INSERT INTO threads VALUES ('a')");
    expect(counts.hasCompleteCoverage()).toBe(false);
    labels.importMessages('a', [{ id: 'm', labels: ['INBOX'] }]);
    expect(counts.hasCompleteCoverage()).toBe(true);
    db.exec("UPDATE mailbox_history SET snapshot_baseline = '200'");
    expect(counts.hasCompleteCoverage()).toBe(false);
  });

  it('coalesces cold provider fan-out and preserves complete Gmail totals across imports and store reconstruction', async () => {
    const { labels, counts, reopen } = fixture();
    let resolve!: (rows: MailCount[]) => void;
    const load = vi.fn(
      () =>
        new Promise<MailCount[]>((done) => {
          resolve = done;
        }),
    );
    const names = vi.fn(async () => catalogue);
    const first = counts.read(0, '100', load, names);
    const concurrent = counts.read(0, '100', load, names);
    resolve(baseline);
    expect(await first).toEqual(baseline);
    expect(await concurrent).toEqual(baseline);
    expect(load).toHaveBeenCalledTimes(1);
    labels.importMessages('a', [{ id: 'm', labels: ['INBOX', 'UNREAD'] }]);
    expect(await reopen().read(1000, '100', load, names)).toEqual(baseline);
    expect(load).toHaveBeenCalledTimes(1);
    expect(names).not.toHaveBeenCalled();
  });

  it('throttles history-driven refreshes and retains cached totals with a persisted failure backoff', async () => {
    const { counts, reopen } = fixture();
    const load = vi.fn(async () => baseline);
    const names = vi.fn(async () => catalogue);
    await counts.read(0, '100', load, names);
    await counts.read(29000, '101', load, names);
    expect(load).toHaveBeenCalledTimes(1);
    await counts.read(30000, '101', load, names);
    expect(load).toHaveBeenCalledTimes(2);
    load.mockRejectedValueOnce(new Error('quota deferred'));
    expect(await counts.read(330000, '101', load, names)).toEqual(baseline);
    expect(await reopen().read(331000, '102', load, names)).toEqual(baseline);
    expect(load).toHaveBeenCalledTimes(3);
    await counts.read(360000, '102', load, names);
    expect(load).toHaveBeenCalledTimes(4);
  });

  it('never replaces a valid snapshot with incomplete or invalid provider results', async () => {
    const { counts } = fixture();
    const load = vi.fn(async () => baseline);
    const names = vi.fn(async () => catalogue);
    await counts.read(0, '100', load, names);
    load.mockResolvedValueOnce([]);
    expect(await counts.read(300000, '100', load, names)).toEqual(baseline);
    load.mockResolvedValueOnce([{ label: 'inbox', count: NaN }]);
    expect(await counts.read(330000, '100', load, names)).toEqual(baseline);
  });

  it('uses updated label names and removes deleted labels from cached provider totals', async () => {
    const { counts } = fixture();
    const load = vi.fn(async () => [...baseline, { labelId: 'Label_123', label: 'old', count: 7 }]);
    const names = vi.fn(async () => catalogue);
    await counts.read(0, '100', load, names);
    counts.saveCatalogue([...catalogue, { id: 'Label_123', name: 'New' }], 1000);
    expect(values(await counts.read(1000, '100', load, names)).new).toBe(7);
    counts.saveCatalogue(catalogue, 2000);
    expect(values(await counts.read(2000, '100', load, names)).new).toBeUndefined();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('honors persisted failure backoff even before the first snapshot or catalogue exists', async () => {
    const { db, counts, reopen } = fixture();
    const load = vi.fn(async (): Promise<MailCount[]> => {
      throw new Error('offline');
    });
    const names = vi.fn(async (): Promise<{ id: string; name: string }[]> => {
      throw new Error('offline');
    });
    await expect(counts.read(0, '100', load, names)).rejects.toThrow('offline');
    await expect(reopen().read(1000, '100', load, names)).rejects.toThrow('waiting to retry');
    expect(load).toHaveBeenCalledTimes(1);
    db.exec("UPDATE mailbox_history SET cursor = '100'");
    await expect(counts.read(30000, '100', load, names)).rejects.toThrow('offline');
    await expect(reopen().read(31000, '100', load, names)).rejects.toThrow('waiting to retry');
    expect(names).toHaveBeenCalledTimes(1);
  });

  it('serves fully synchronized counts without any provider calls, including after restart', async () => {
    const { db, labels, history, counts, reopen } = fixture();
    db.exec("UPDATE mailbox_history SET cursor = '100'");
    labels.importMessages('a', [{ id: 'm', labels: ['INBOX', 'UNREAD'] }]);
    counts.saveCatalogue(catalogue, 0);
    const load = vi.fn(async () => baseline);
    const names = vi.fn(async () => catalogue);
    expect(values(await counts.read(1000, '100', load, names)).inbox).toBe(1);
    labels.setUnread('a', false, 0);
    expect(values(await reopen().read(2000, '100', load, names)).inbox).toBe(0);
    history.enqueue('new-message');
    expect(values(await reopen().read(3000, '101', load, names)).inbox).toBe(0);
    expect(load).not.toHaveBeenCalled();
    expect(names).not.toHaveBeenCalled();
  });

  it('refreshes label names after invalidation and backs off failed catalogue refreshes', async () => {
    const { db, labels, counts } = fixture();
    db.exec("UPDATE mailbox_history SET cursor = '100'");
    labels.importMessages('a', [{ id: 'm', labels: ['Label_123', 'UNREAD'] }]);
    counts.saveCatalogue([{ id: 'Label_123', name: 'Old' }], 0);
    counts.invalidate();
    const load = vi.fn(async () => baseline);
    const names = vi.fn(async () => [{ id: 'Label_123', name: 'New' }]);
    expect(values(await counts.read(1000, '100', load, names)).new).toBe(1);
    counts.invalidate();
    names.mockRejectedValueOnce(new Error('offline'));
    expect(values(await counts.read(2000, '100', load, names)).new).toBe(1);
    await counts.read(3000, '100', load, names);
    expect(names).toHaveBeenCalledTimes(2);
    expect(load).not.toHaveBeenCalled();
  });
});
