import { MailHistoryStore } from './mail-history-store';
import type { LabelStorage } from './mail-label-store';
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

function fixture() {
  const db = new DatabaseSync(':memory:');
  const storage: LabelStorage = {
    exec(query, ...args) {
      const statement = db.prepare(query);
      return /^\s*(SELECT|PRAGMA)/i.test(query)
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
  db.exec('CREATE TABLE threads(thread_id TEXT PRIMARY KEY)');
  const store = new MailHistoryStore(storage);
  store.initialize();
  return { store, db, reopen: () => new MailHistoryStore(storage) };
}

describe('durable Gmail history checkpoints', () => {
  it('counts only unimported threads toward import progress, including blocked work but excluding verification duplicates and deletions', () => {
    const { store, db } = fixture();
    db.exec("INSERT INTO threads VALUES ('stored')");
    store.enqueue('stored', 'verify');
    store.enqueue('older', 'backfill');
    store.enqueue('live');
    store.enqueue('deleted', 'delete');
    db.exec("UPDATE mailbox_import_jobs SET blocked = 1 WHERE thread_id = 'older'");
    expect(store.importProgress()).toEqual({ imported: 1, remaining: 2 });
    db.exec("INSERT INTO threads VALUES ('older')");
    expect(store.importProgress()).toEqual({ imported: 2, remaining: 1 });
  });
  it('pauses backfill without blocking newly arrived live work or counting a quota denial as a failed request', () => {
    const { store } = fixture();
    store.enqueue('old', 'backfill');
    const job = store.job(0)!;
    store.deferJob('old', String(job.version), 60000, false, false);
    store.pauseBackfill(60000);
    store.enqueue('another-old', 'backfill');
    expect(store.job(1000)).toBeUndefined();
    store.enqueue('live');
    expect(store.job(1000)?.thread_id).toBe('live');
    expect(store.progress().backfillResumeAt).toBe(60000);
  });
  it('rolls back both import jobs and the cursor when applying a history page fails', () => {
    const { store } = fixture();
    store.commit('10', 0, 0, () => {});
    expect(() =>
      store.commit('20', 1, 0, () => {
        store.enqueue('t');
        throw new Error('crash');
      }),
    ).toThrow('crash');
    expect(store.state().cursor).toBe('10');
    expect(store.job(0)).toBeUndefined();
    expect(store.state().processed).toBe(0);
  });

  it('retains a notification arriving during a sync and coalesces duplicate thread jobs', () => {
    const { store } = fixture();
    store.signal(0);
    const revision = Number(store.state().requested);
    store.signal(0);
    store.commit('20', revision, 0, () => {
      store.enqueue('t');
      store.enqueue('t');
    });
    expect(store.state().requested).toBe(2);
    expect(store.state().processed).toBe(1);
    const job = store.job(0)!;
    store.acknowledgeJob('t', String(job.version));
    expect(store.job(0)).toBeUndefined();
  });

  it('does not delete a newly re-enqueued import when an older import finishes', () => {
    const { store } = fixture();
    store.enqueue('t');
    const job = store.job(0)!;
    store.enqueue('t');
    store.acknowledgeJob('t', String(job.version));
    expect(store.job(0)).toBeDefined();
  });

  it('resumes full reconciliation after restart and preserves signals received during it', () => {
    const { store, db, reopen } = fixture();
    db.exec("INSERT INTO threads VALUES ('keep'), ('gone')");
    store.beginSnapshot('100');
    store.snapshotPage(['keep'], 'page-2');
    store.signal(0);
    const resumed = reopen();
    expect(resumed.state().snapshot_page).toBe('page-2');
    resumed.snapshotPage(['new'], null);
    expect(resumed.state().snapshot_page).toBe('__complete__');
    resumed.finishSnapshot(0, (id) => resumed.enqueue(id, 'verify'));
    expect(resumed.state().cursor).toBe('100');
    expect(resumed.state().processed).toBe(0);
    expect(resumed.state().requested).toBe(1);
    expect(db.prepare("SELECT * FROM threads WHERE thread_id = 'gone'").get()).toBeDefined();
    expect(resumed.job(0)?.kind).toBe('verify');
  });

  it('does not let notification storms bypass a persisted retry cooldown', () => {
    const { store } = fixture();
    store.defer(0, 60000, 'rate_limited', false);
    store.signal(1000);
    expect(store.state().next_at).toBe(60000);
    store.delayDispatch(60000);
    expect(store.beginTick(59999)).toBe(false);
    expect(store.beginTick(60000)).toBe(true);
  });

  it('uses a longer polling interval when the mailbox is inactive', () => {
    const { store } = fixture();
    store.commit('10', 0, 3600000, () => {});
    expect(store.state().next_at).toBe(4500000);
    store.activate(3600000);
    store.commit('20', 0, 3600000, () => {});
    expect(store.state().next_at).toBe(3660000);
  });

  it('deduplicates browser cache misses without resetting a failed import cooldown', () => {
    const { store } = fixture();
    store.ensureImport('t');
    const job = store.job(0)!;
    store.deferJob('t', String(job.version), 60000, false);
    store.ensureImport('t');
    expect(store.job(59999)).toBeUndefined();
    expect(store.job(60000)?.version).toBe(job.version);
  });

  it('delivers label notifications independently of a backfill for the same thread', () => {
    const { store } = fixture();
    store.enqueue('t', 'backfill');
    const importJob = store.job(0)!;
    store.notify('t');
    const notification = store.notifications(0)[0]!;
    expect(notification.thread_id).toBe('t');
    store.acknowledgeNotification('t', String(notification.version));
    expect(store.notifications(0)).toEqual([]);
    expect(store.job(0)?.version).toBe(importJob.version);
    expect(store.job(0)?.kind).toBe('backfill');
  });

  it('prioritizes live changes and opened threads ahead of historical imports', () => {
    const { store } = fixture();
    store.enqueue('old', 'backfill');
    store.enqueue('opened', 'backfill');
    store.enqueue('changed');
    expect(store.job(0)?.thread_id).toBe('changed');
    const changed = store.job(0)!;
    store.acknowledgeJob('changed', String(changed.version));
    store.ensureImport('opened');
    expect(store.job(0)?.thread_id).toBe('opened');
  });

  it('retains a newer notification when an earlier broadcast is acknowledged', () => {
    const { store } = fixture();
    store.notify('t');
    const notification = store.notifications(0)[0]!;
    store.notify('t');
    store.acknowledgeNotification('t', String(notification.version));
    expect(store.notifications(0)).toHaveLength(1);
  });
  describe('AI runs', () => {
    const LEASE = 600000;
    it('dispatches only after the import lands, and survives a restart', () => {
      const { store, reopen } = fixture();
      store.markAiPending('t');
      expect(store.leaseAiRuns(0, 4, LEASE)).toEqual([]);
      store.markAiReady('backfilled');
      const reopened = reopen();
      reopened.initialize();
      reopened.markAiReady('t');
      const [run] = reopened.leaseAiRuns(0, 4, LEASE);
      expect(run).toMatchObject({ threadId: 't', draftDone: false });
      expect(reopened.leaseAiRuns(1, 4, LEASE)).toEqual([]);
      reopened.completeAiRun('t', run!.version);
      expect(reopened.aiDue(1, 4)).toBeUndefined();
    });

    it('re-dispatches a lost run when its lease expires', () => {
      const { store } = fixture();
      store.markAiPending('t');
      store.markAiReady('t');
      store.leaseAiRuns(0, 4, LEASE);
      expect(store.aiDue(1, 4)).toBe(LEASE);
      expect(store.leaseAiRuns(LEASE, 4, LEASE)).toHaveLength(1);
    });

    it('keeps the row when newer mail arrives during a run', () => {
      const { store } = fixture();
      store.markAiPending('t');
      store.markAiReady('t');
      const [first] = store.leaseAiRuns(0, 4, LEASE);
      store.markAiPending('t');
      store.completeAiRun('t', first!.version);
      expect(store.leaseAiRuns(1, 4, LEASE)).toEqual([]);
      store.markAiReady('t');
      const [second] = store.leaseAiRuns(1, 4, LEASE);
      expect(second?.version).not.toBe(first?.version);
    });

    it('retries with backoff, never repeats an attempted draft, and gives up', () => {
      const { store } = fixture();
      store.markAiPending('t');
      store.markAiReady('t');
      let [run] = store.leaseAiRuns(0, 4, LEASE);
      store.failAiRun('t', run!.version, 0, true, 2);
      expect(store.leaseAiRuns(29999, 4, LEASE)).toEqual([]);
      [run] = store.leaseAiRuns(30000, 4, LEASE);
      expect(run?.draftDone).toBe(true);
      store.failAiRun('t', run!.version, 30000, false, 2);
      expect(store.aiDue(30000, 4)).toBeUndefined();
    });

    it('caps concurrent runs and waits for a lease instead of spinning', () => {
      const { store } = fixture();
      for (const id of ['a', 'b', 'c']) {
        store.markAiPending(id);
        store.markAiReady(id);
      }
      expect(store.leaseAiRuns(0, 2, LEASE)).toHaveLength(2);
      expect(store.leaseAiRuns(0, 2, LEASE)).toEqual([]);
      expect(store.aiDue(0, 2)).toBe(LEASE);
      store.removeAiRun('a');
      expect(store.aiDue(0, 2)).toBe(0);
    });
  });
});
