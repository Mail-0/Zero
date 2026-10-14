import { MailLabelStore, type LabelStorage } from './mail-label-store';
import { normalizeDurableLabelMutation } from './mail-label-policy';
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

function fixture() {
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
  const store = new MailLabelStore(storage);
  store.initialize();
  return { store, db, reopen: () => new MailLabelStore(storage) };
}

describe('durable message label outbox', () => {
  it('preserves app MUTE state without dispatching it as a Gmail label', () => {
    const { store, reopen } = fixture();
    store.importMessages('t', [{ id: 'm', labels: ['INBOX'] }]);
    store.setSyntheticThreadLabels('t', ['MUTE'], []);
    store.applyProviderLabels('m', ['STARRED'], []);
    const restored = reopen();
    restored.initialize();
    expect(restored.threadLabels('t').sort()).toEqual(['INBOX', 'MUTE', 'STARRED']);
    expect(restored.messageLabels('m')).not.toContain('MUTE');
    expect(restored.pendingBatches(1000)).toEqual([]);
    restored.setSyntheticThreadLabels('t', [], ['MUTE']);
    expect(restored.threadLabels('t')).not.toContain('MUTE');
  });

  it('preserves snooze through history refresh, restart and durable custom-label actions', () => {
    const { store, reopen } = fixture();
    store.importMessages('t', [{ id: 'm', labels: ['INBOX'] }], '1');
    store.setSyntheticThreadLabels('t', ['SNOOZED'], []);
    store.setThreadLabels(['t'], ['Label_123'], ['INBOX'], 0);
    store.importMessages('t', [{ id: 'm', labels: ['INBOX'] }], '2', true);
    store.applyProviderLabels('m', ['STARRED'], [], '3');
    const restored = reopen();
    restored.initialize();
    expect(restored.threadLabels('t').sort()).toEqual(['Label_123', 'SNOOZED', 'STARRED']);
    expect(restored.messageLabels('m')).not.toContain('SNOOZED');
    expect(restored.pendingBatches(1000)[0]).toMatchObject({
      addLabelIds: ['Label_123'],
      removeLabelIds: ['INBOX'],
    });
    restored.setSyntheticThreadLabels('t', [], ['SNOOZED']);
    restored.setThreadLabels(['t'], ['INBOX'], [], 1000);
    expect(restored.threadLabels('t')).toContain('INBOX');
    expect(restored.threadLabels('t')).not.toContain('SNOOZED');
    expect(restored.pendingBatches(2000)[0]?.addLabelIds).toEqual(['INBOX', 'Label_123']);
  });

  it('migrates only recognized app state and never resurrects removed state from stale summaries', () => {
    const { store, db, reopen } = fixture();
    db.exec(`CREATE TABLE threads (thread_id TEXT PRIMARY KEY, latest_label_ids TEXT);
      INSERT INTO threads VALUES ('t', '["INBOX","SNOOZED","Label_123","Work"]')`);
    store.initialize();
    expect(store.getSyntheticThreadLabels('t')).toEqual(['SNOOZED']);
    store.setSyntheticThreadLabels('t', [], ['SNOOZED']);
    reopen().initialize();
    store.importSyntheticThreadLabels('t', ['SNOOZED']);
    expect(store.getSyntheticThreadLabels('t')).toEqual([]);
    store.setSyntheticThreadLabels('t', ['SNOOZED'], []);
    store.importMessages('t', [{ id: 'm', labels: ['INBOX'] }]);
    store.removeThread('t');
    reopen().initialize();
    expect(store.getSyntheticThreadLabels('t')).toEqual([]);
    expect(store.threadLabels('t')).toEqual([]);
    expect(() => store.setThreadLabels(['t'], ['SNOOZED'], [], 0)).toThrow('Synthetic');
  });

  it('keeps thread state across snapshot message replacement and clears it on final deletion', () => {
    const { store } = fixture();
    store.importMessages('t', [{ id: 'old', labels: [] }], '1');
    store.setSyntheticThreadLabels('t', ['SNOOZED'], []);
    store.importMessages('t', [{ id: 'new', labels: [] }], '2', true);
    expect(store.threadLabels('t')).toEqual(['SNOOZED']);
    store.deleteMessage('new');
    expect(store.getSyntheticThreadLabels('t')).toEqual([]);
    expect(store.isThreadDeleted('t')).toBe(true);
  });

  it('derives unread from every message and preserves pending intent across imports', () => {
    const { store } = fixture();
    store.importMessages('t', [
      { id: 'old', labels: ['INBOX', 'UNREAD'] },
      { id: 'new', labels: ['INBOX'] },
    ]);
    expect(store.threadLabels('t')).toContain('UNREAD');
    store.setUnread('t', false, 0);
    store.importMessages('t', [
      { id: 'old', labels: ['INBOX', 'UNREAD'] },
      { id: 'new', labels: ['INBOX'] },
    ]);
    expect(store.threadLabels('t')).not.toContain('UNREAD');
    expect(store.pendingBatches(1000)[0]?.ids).toEqual(['old']);
  });

  it('does not clear a newer toggle when an older batch completes', () => {
    const { store } = fixture();
    store.importMessages('t', [{ id: 'm', labels: ['UNREAD'] }]);
    store.setUnread('t', false, 0);
    const batch = store.pendingBatches(1000)[0]!;
    store.setUnread('t', true, 0);
    store.acknowledge(batch);
    expect(store.threadLabels('t')).toContain('UNREAD');
    expect(store.pendingBatches(1000)[0]?.addLabelIds).toEqual(['UNREAD']);
  });

  it('coalesces toggles, survives store reconstruction, and respects retry times', () => {
    const { store, db, reopen } = fixture();
    store.importMessages('t', [{ id: 'm', labels: ['UNREAD'] }]);
    store.setUnread('t', false, 0);
    store.setUnread('t', true, 0);
    store.setUnread('t', false, 0);
    const batch = store.pendingBatches(1000)[0]!;
    store.defer(batch, 5000, 'rate_limited', false);
    expect(store.pendingBatches(4999)).toEqual([]);
    expect(reopen().pendingBatches(5000)[0]?.removeLabelIds).toEqual(['UNREAD']);
    expect(db.prepare('SELECT COUNT(*) AS n FROM mail_label_intents').get()?.n).toBe(1);
  });

  it('rolls back local state and intent together on failure', () => {
    const { store, db } = fixture();
    store.importMessages('t', [{ id: 'm', labels: ['UNREAD'] }]);
    db.exec(
      "CREATE TRIGGER reject_intent BEFORE INSERT ON mail_label_intents BEGIN SELECT RAISE(ABORT, 'fail'); END",
    );
    expect(() => store.setUnread('t', false, 0)).toThrow('fail');
    expect(store.threadLabels('t')).toContain('UNREAD');
  });

  it('applies provider changes per message without producing outbound writes', () => {
    const { store } = fixture();
    store.importMessages('t', [
      { id: 'a', labels: ['UNREAD'] },
      { id: 'b', labels: ['UNREAD'] },
    ]);
    store.applyProviderLabels('a', [], ['UNREAD']);
    expect(store.threadLabels('t')).toContain('UNREAD');
    store.applyProviderLabels('b', [], ['UNREAD']);
    expect(store.threadLabels('t')).not.toContain('UNREAD');
    expect(store.pendingBatches(1000)).toEqual([]);
  });

  it('limits batches to 1000 messages and enforces a persisted mailbox cooldown', () => {
    const { store } = fixture();
    store.importMessages(
      't',
      Array.from({ length: 1001 }, (_, i) => ({ id: String(i), labels: ['UNREAD'] })),
    );
    store.setUnread('t', false, 0);
    const batch = store.pendingBatches(1000)[0]!;
    expect(batch.ids).toHaveLength(1000);
    store.delayDispatch(2000);
    expect(store.pendingBatches(1999)).toEqual([]);
    store.acknowledge(batch);
    expect(store.pendingBatches(2000)[0]?.ids).toHaveLength(1);
  });

  it('does not mutate drafts when marking a thread unread', () => {
    const { store } = fixture();
    store.importMessages('t', [
      { id: 'm', labels: [] },
      { id: 'draft', labels: ['DRAFT'] },
    ]);
    store.setUnread('t', true, 0);
    expect(store.pendingBatches(1000)[0]?.ids).toEqual(['m']);
    expect(store.messageLabels('draft')).toEqual(['DRAFT']);
  });

  it('avoids provider writes when the requested state is already observed', () => {
    const { store } = fixture();
    store.importMessages('t', [{ id: 'm', labels: [] }]);
    store.setUnread('t', false, 0);
    expect(store.pendingBatches(1000)).toEqual([]);
  });

  it('retains acknowledged intent until history confirms it, then accepts a later external edit', () => {
    const { store } = fixture();
    store.importMessages('t', [{ id: 'm', labels: ['UNREAD'] }], '10');
    store.setUnread('t', false, 0);
    store.acknowledge(store.pendingBatches(1000)[0]!);
    store.applyProviderLabels('m', ['UNREAD'], [], '11');
    expect(store.threadLabels('t')).not.toContain('UNREAD');
    store.applyProviderLabels('m', [], ['UNREAD'], '12');
    expect(store.status()).toEqual([]);
    store.applyProviderLabels('m', ['UNREAD'], [], '13');
    expect(store.threadLabels('t')).toContain('UNREAD');
  });

  it('ignores history older than a fresh snapshot using numeric Gmail IDs', () => {
    const { store } = fixture();
    store.importMessages('t', [{ id: 'm', labels: [] }], '100');
    store.applyProviderLabels('m', ['UNREAD'], [], '99');
    expect(store.threadLabels('t')).not.toContain('UNREAD');
  });

  it('does not resurrect a deleted message from stale R2 contents', () => {
    const { store } = fixture();
    store.importMessages('t', [{ id: 'm', labels: ['UNREAD'] }]);
    store.setUnread('t', false, 0);
    store.deleteMessage('m');
    store.importMessages('t', [{ id: 'm', labels: ['UNREAD'] }]);
    expect(store.messageLabels('m')).toBeUndefined();
    expect(store.pendingBatches(1000)).toEqual([]);
  });

  it('reconciles delivered intent against a fresh post-delivery snapshot', () => {
    const { store } = fixture();
    store.importMessages('t', [{ id: 'm', labels: ['UNREAD'] }], '10');
    store.setUnread('t', false, 0);
    store.acknowledge(store.pendingBatches(1000)[0]!);
    store.importMessages('t', [{ id: 'm', labels: ['UNREAD'] }], '20', true);
    expect(store.status()).toEqual([]);
    expect(store.threadLabels('t')).toContain('UNREAD');
  });

  it('prunes messages absent from an authoritative snapshot after an expired history cursor', () => {
    const { store } = fixture();
    store.importMessages(
      't',
      [
        { id: 'old', labels: ['UNREAD'] },
        { id: 'keep', labels: [] },
      ],
      '10',
    );
    store.setUnread('t', false, 0);
    store.importMessages('t', [{ id: 'keep', labels: [] }], '20', true);
    expect(store.messageLabels('old')).toBeUndefined();
    expect(store.isDeleted('old')).toBe(true);
    expect(store.threadLabels('t')).not.toContain('UNREAD');
    expect(store.pendingBatches(1000)).toEqual([]);
  });

  it('migrates legacy unread retries and delivered intents without losing their versions', () => {
    const { db, reopen } = fixture();
    db.exec(`INSERT INTO mail_label_outbox(message_id,version,desired,attempts,next_attempt_at,delivered)
      VALUES ('retry','v1',0,3,5000,0), ('sent','v2',1,0,0,1)`);
    const migrated = reopen();
    migrated.initialize();
    expect(migrated.pendingBatches(4999)).toEqual([]);
    expect(migrated.pendingBatches(5000)[0]?.operations).toEqual([
      { messageId: 'retry', labelId: 'UNREAD', version: 'v1', desired: 0, attempts: 3 },
    ]);
    expect(
      db.prepare('SELECT delivered FROM mail_label_intents WHERE message_id = ?').get('sent')
        ?.delivered,
    ).toBe(1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM mail_label_outbox').get()?.n).toBe(0);
    migrated.initialize();
    expect(db.prepare('SELECT COUNT(*) AS n FROM mail_label_intents').get()?.n).toBe(2);
  });

  it('coalesces archive, star and read intent into one compatible Gmail modification', () => {
    const { store } = fixture();
    store.importMessages('t', [{ id: 'm', labels: ['INBOX', 'UNREAD'] }]);
    store.setThreadLabels(['t'], ['STARRED'], ['INBOX'], 0);
    store.setUnread('t', false, 0);
    expect(store.messageLabels('m')).toEqual(['STARRED']);
    expect(store.pendingBatches(1000)).toHaveLength(1);
    const batch = store.pendingBatches(1000)[0]!;
    expect(batch.ids).toEqual(['m']);
    expect(batch.addLabelIds).toEqual(['STARRED']);
    expect(batch.removeLabelIds).toEqual(['INBOX', 'UNREAD']);
    expect(batch.operations).toHaveLength(3);
  });

  it('preserves a newer spam-to-inbox restore while older trash delivery and history complete', () => {
    const { store, reopen } = fixture();
    store.importMessages('t', [{ id: 'm', labels: ['SPAM', 'UNREAD'] }], '10');
    store.setThreadLabels(['t'], ['TRASH', 'IMPORTANT', 'Label_123'], ['SPAM'], 0);
    const old = store.pendingBatches(1000)[0]!;
    store.setThreadLabels(['t'], ['INBOX'], ['TRASH', 'SPAM'], 100);
    const recovered = reopen();
    recovered.acknowledge(old);
    recovered.applyProviderLabels('m', ['TRASH', 'IMPORTANT', 'Label_123'], ['SPAM'], '11');
    expect(new Set(recovered.threadLabels('t'))).toEqual(
      new Set(['INBOX', 'UNREAD', 'IMPORTANT', 'Label_123']),
    );
    const restore = recovered.pendingBatches(1100)[0]!;
    expect(restore.addLabelIds).toEqual(['INBOX']);
    // The older SPAM removal was identical and is already confirmed by history.
    expect(restore.removeLabelIds).toEqual(['TRASH']);
    recovered.acknowledge(restore);
    recovered.applyProviderLabels('m', ['INBOX'], ['TRASH', 'SPAM'], '12');
    expect(recovered.status()).toEqual([]);
  });

  it('queues an inbox restore after trash even before Gmail confirms implicit inbox removal', () => {
    const { store } = fixture();
    store.importMessages('t', [{ id: 'm', labels: ['INBOX'] }]);
    const trash = normalizeDurableLabelMutation(['TRASH'], []);
    store.setThreadLabels(['t'], trash.addLabels, trash.removeLabels, 0);
    store.acknowledge(store.pendingBatches(1000)[0]!);
    expect(store.threadLabels('t')).toEqual(['TRASH']);
    store.setThreadLabels(['t'], ['INBOX'], ['TRASH'], 2000);
    const restore = store.pendingBatches(3000)[0]!;
    expect(restore.addLabelIds).toEqual(['INBOX']);
    expect(restore.removeLabelIds).toEqual(['TRASH']);
    store.acknowledge(restore);
    store.applyProviderLabels('m', ['STARRED'], [], '10');
    expect(store.status().reduce((sum, row) => sum + Number(row.count), 0)).toBe(2);
    store.applyProviderLabels('m', ['TRASH'], ['INBOX'], '11');
    expect(store.threadLabels('t')).toContain('INBOX');
    expect(store.threadLabels('t')).not.toContain('TRASH');
    store.applyProviderLabels('m', ['INBOX'], ['TRASH'], '12');
    expect(store.status()).toEqual([]);
  });

  it('does not resend an already delivered custom-label intent when the same action is repeated', () => {
    const { store } = fixture();
    store.importMessages('t', [{ id: 'm', labels: [] }]);
    store.setThreadLabels(['t'], ['Label_123'], [], 0);
    store.acknowledge(store.pendingBatches(1000)[0]!);
    store.setThreadLabels(['t'], ['Label_123'], [], 2000);
    expect(store.pendingBatches(3000)).toEqual([]);
    expect(store.status()[0]?.delivered).toBe(1);
    store.applyProviderLabels('m', ['Label_123'], [], '10');
    expect(store.status()).toEqual([]);
  });

  it('retries custom-label and importance intent independently without modifying drafts', () => {
    const { store, reopen } = fixture();
    store.importMessages('t', [
      { id: 'a', labels: ['INBOX'] },
      { id: 'b', labels: ['INBOX', 'IMPORTANT'] },
      { id: 'draft', labels: ['DRAFT'] },
    ]);
    store.setThreadLabels(['t'], ['IMPORTANT', 'Label_123'], [], 0);
    const batches = store.pendingBatches(1000);
    expect(batches).toHaveLength(2);
    for (const batch of batches) store.defer(batch, 5000, 'transient', false);
    store.setThreadLabels(['t'], [], ['IMPORTANT'], 2000);
    const recovered = reopen();
    const importance = recovered.pendingBatches(3000)[0]!;
    expect(importance.ids).toEqual(['a', 'b']);
    expect(importance.removeLabelIds).toEqual(['IMPORTANT']);
    recovered.acknowledge(importance);
    const custom = recovered.pendingBatches(5000)[0]!;
    expect(custom.ids).toEqual(['a', 'b']);
    expect(custom.addLabelIds).toEqual(['Label_123']);
    expect(custom.operations.every((op) => op.attempts === 1)).toBe(true);
    expect(recovered.messageLabels('draft')).toEqual(['DRAFT']);
  });

  it('protects a rapid unstar from an older star acknowledgment without losing archive intent', () => {
    const { store } = fixture();
    store.importMessages('t', [{ id: 'm', labels: ['INBOX'] }]);
    store.setThreadLabels(['t'], ['STARRED'], ['INBOX'], 0);
    const older = store.pendingBatches(1000)[0]!;
    store.setThreadLabels(['t'], [], ['STARRED'], 0);
    store.acknowledge(older);
    expect(store.threadLabels('t')).not.toContain('STARRED');
    expect(store.threadLabels('t')).not.toContain('INBOX');
    expect(store.pendingBatches(1000)[0]?.removeLabelIds).toEqual(['STARRED']);
    store.applyProviderLabels('m', ['STARRED'], ['INBOX'], '10');
    expect(store.threadLabels('t')).not.toContain('STARRED');
    expect(store.pendingBatches(1000)[0]?.removeLabelIds).toEqual(['STARRED']);
  });

  it('confirms archive and star independently, then accepts a Gmail-side restore', () => {
    const { store } = fixture();
    store.importMessages('t', [{ id: 'm', labels: ['INBOX'] }]);
    store.setThreadLabels(['t'], ['STARRED'], ['INBOX'], 0);
    store.acknowledge(store.pendingBatches(1000)[0]!);
    store.applyProviderLabels('m', ['STARRED'], [], '10');
    expect(store.threadLabels('t')).toEqual(['STARRED']);
    expect(store.status()[0]?.count).toBe(1);
    store.applyProviderLabels('m', [], ['INBOX'], '11');
    expect(store.status()).toEqual([]);
    store.applyProviderLabels('m', ['INBOX'], [], '12');
    expect(store.threadLabels('t')).toEqual(['STARRED', 'INBOX']);
  });

  it('groups only messages with identical add/remove sets and deduplicates bulk IDs', () => {
    const { store } = fixture();
    store.importMessages('a', [
      { id: 'a1', labels: ['INBOX'] },
      { id: 'a2', labels: ['INBOX'] },
    ]);
    store.importMessages('b', [{ id: 'b1', labels: [] }]);
    store.setThreadLabels(['a', 'a', 'b'], ['STARRED'], ['INBOX'], 0);
    const batches = store.pendingBatches(1000);
    expect(batches).toHaveLength(2);
    expect(batches.find((batch) => batch.removeLabelIds.includes('INBOX'))?.ids).toEqual([
      'a1',
      'a2',
    ]);
    expect(batches.find((batch) => !batch.removeLabelIds.length)?.ids).toEqual(['b1']);
  });

  it('rolls back an entire bulk action and its local summaries if any thread is missing', () => {
    const { store, db } = fixture();
    store.importMessages('known', [{ id: 'm', labels: ['INBOX'] }]);
    db.exec('CREATE TABLE summary (labels TEXT); INSERT INTO summary VALUES (\'["INBOX"]\')');
    expect(() =>
      store.setThreadLabels(['known', 'missing'], ['STARRED'], ['INBOX'], 0, () => {
        db.prepare('UPDATE summary SET labels = ?').run(
          JSON.stringify(store.threadLabels('known')),
        );
      }),
    ).toThrow('missing');
    expect(store.pendingBatches(1000)).toEqual([]);
    expect(store.threadLabels('known')).toEqual(['INBOX']);
    expect(db.prepare('SELECT labels FROM summary').get()?.labels).toBe('["INBOX"]');
  });

  it('respects per-request Gmail label-array limits without losing remaining intent', () => {
    const { store, db } = fixture();
    store.importMessages('t', [{ id: 'm', labels: [] }]);
    store.setThreadLabels(
      ['t'],
      Array.from({ length: 101 }, (_, i) => `Label_${i}`),
      [],
      0,
    );
    const batch = store.pendingBatches(1000)[0]!;
    expect(batch.addLabelIds).toHaveLength(100);
    store.acknowledge(batch);
    expect(store.pendingBatches(1000)[0]?.addLabelIds).toHaveLength(1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM mail_label_intents').get()?.n).toBe(101);
  });
});

describe('app-kept thread labels', () => {
  it('survive re-imports and provider deltas and are cleared with the thread', () => {
    const { store, reopen } = fixture();
    store.importMessages('t', [{ id: 'm', labels: ['INBOX', 'UNREAD'] }]);
    store.setAppThreadLabels('t', ['K_promo', 'K_billing'], []);
    store.importMessages('t', [{ id: 'm', labels: ['INBOX'] }]);
    store.applyProviderLabels('m', ['STARRED'], []);
    const restored = reopen();
    restored.initialize();
    expect(restored.threadLabels('t').sort()).toEqual(['INBOX', 'K_billing', 'K_promo', 'STARRED']);
    // Never dispatched to the provider.
    expect(restored.pendingBatches(10_000)).toEqual([]);

    restored.setAppThreadLabels('t', [], ['K_promo']);
    expect(restored.appThreadLabels('t')).toEqual(['K_billing']);
    restored.forgetAppLabel('K_billing');
    expect(restored.appThreadLabels('t')).toEqual([]);

    restored.setAppThreadLabels('t', ['K_x'], []);
    restored.removeThread('t');
    expect(restored.appThreadLabels('t')).toEqual([]);
  });
});
