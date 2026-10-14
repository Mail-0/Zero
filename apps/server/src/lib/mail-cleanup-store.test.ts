import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MailCleanupStore } from './mail-cleanup-store';
import { MailLabelStore } from './mail-label-store';
import { DatabaseSync } from 'node:sqlite';

let db: DatabaseSync;
let store: MailCleanupStore;
const storage = {
  exec(query: string, ...args: (string | number | null)[]) {
    const statement = db.prepare(query);
    return /^SELECT|^PRAGMA/i.test(query)
      ? (statement.all(...args) as Record<string, string | number | null>[])
      : (statement.run(...args), []);
  },
  transaction(fn: () => void) {
    db.exec('SAVEPOINT test');
    try {
      fn();
      db.exec('RELEASE test');
    } catch (error) {
      db.exec('ROLLBACK TO test; RELEASE test');
      throw error;
    }
  },
};
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  store = new MailCleanupStore(storage);
  store.initialize();
});
afterEach(() => db.close());

describe('durable spam cleanup', () => {
  it('protects a real no-op restore after discovery and survives reconstruction', () => {
    const labels = new MailLabelStore(storage);
    labels.initialize();
    labels.importMessages('a', [{ id: 'm', labels: ['SPAM'] }]);
    store.admit();
    store.page(['a'], null);
    // Provider already lacks TRASH, so this produces no outbox operation. Its
    // admission callback must still preserve the newer user's restore ordering.
    labels.setThreadLabels(['a'], [], ['TRASH'], 0, () => store.recordMove(['a']));
    expect(labels.pendingBatches(1000)).toEqual([]);
    store = new MailCleanupStore(storage);
    store.initialize();
    expect(store.superseded('a')).toBe(true);
    expect(labels.threadLabels('a')).toContain('SPAM');
  });

  it('recovers admitted cleanup intent and fences partial-delivery retries against a newer restore', () => {
    let labels = new MailLabelStore(storage);
    labels.initialize();
    labels.importMessages('a', [
      { id: 'm1', labels: ['SPAM'] },
      { id: 'm2', labels: ['SPAM'] },
    ]);
    store.admit();
    store.page(['a'], null);
    storage.transaction(() => {
      labels.setThreadLabels(['a'], ['TRASH'], ['SPAM', 'INBOX'], 0);
      store.acknowledge('a', true);
    });
    // Crash before the one-shot dispatcher was scheduled: the versioned outbox
    // survives while the target is already acknowledged, so it is not re-admitted.
    labels = new MailLabelStore(storage);
    labels.initialize();
    store = new MailCleanupStore(storage);
    store.initialize();
    expect(store.target()).toBeUndefined();
    const oldBatch = labels.pendingBatches(1000)[0]!;
    expect(oldBatch.ids).toHaveLength(2);
    // Gmail applied only m1 before the transport failed.
    labels.applyProviderLabels('m1', ['TRASH'], ['SPAM']);
    labels.setThreadLabels(['a'], ['SPAM'], ['TRASH'], 1001, () => store.recordMove(['a']));
    labels.defer(oldBatch, 61000, 'transient', false);
    labels.acknowledge(oldBatch);
    expect(labels.threadLabels('a')).toContain('SPAM');
    expect(labels.threadLabels('a')).not.toContain('TRASH');
    const newer = labels.pendingBatches(3000);
    expect(
      newer
        .flatMap((batch) => batch.operations)
        .every((op) => !oldBatch.operations.some((old) => old.version === op.version)),
    ).toBe(true);
    expect(newer.flatMap((batch) => batch.ids)).toEqual(['m1', 'm2']);
  });

  it('resumes discovery and delivery without changing the enumerated set', () => {
    store.admit();
    store.page(['a', 'b'], 'page2');
    store = new MailCleanupStore(storage);
    store.initialize();
    expect(store.state()?.page).toBe('page2');
    store.admit();
    expect(store.state()?.page).toBe('page2');
    store.page(['b', 'c'], null);
    expect(store.state()?.phase).toBe('deliver');
    expect([...storage.exec('SELECT * FROM mail_spam_targets')]).toHaveLength(3);
    store.acknowledge('a', true);
    store = new MailCleanupStore(storage);
    store.initialize();
    expect(store.target()).toBe('b');
    expect(store.state()?.admitted).toBe(1);
  });

  it('preserves newer user moves even after their provider acknowledgment and no-op restores', () => {
    store.recordMove(['old']);
    store.admit();
    store.recordMove(['restored']);
    store.page(['old', 'restored'], null);
    expect(store.superseded('old')).toBe(false);
    expect(store.superseded('restored')).toBe(true);
    store = new MailCleanupStore(storage);
    store.initialize();
    expect(store.superseded('restored')).toBe(true);
    store.acknowledge('restored', false);
    expect(store.state()?.admitted).toBe(0);
  });

  it('rolls back target removal alongside intent admission and persists deferrals', () => {
    store.admit();
    store.page(['a'], null);
    expect(() =>
      storage.transaction(() => {
        store.acknowledge('a', true);
        throw new Error('interrupted transaction');
      }),
    ).toThrow();
    expect(store.target()).toBe('a');
    expect(store.state()?.admitted).toBe(0);
    store.defer(60000, 'quota_deferred', false, false);
    expect(store.state()).toMatchObject({ next_at: 60000, attempts: 0, blocked: 0 });
    store.defer(61000, 'reauth_required', true, true);
    store.retry();
    expect(store.target()).toBe('a');
    expect(store.state()).toMatchObject({ next_at: 0, attempts: 0, blocked: 0 });
    store.acknowledge('a', true);
    store.finish();
    store.admit();
    expect(store.state()?.phase).toBe('discover');
    expect(store.state()?.admitted).toBe(0);
  });
});
