import type { LabelStorage } from './mail-label-store';

export class MailHistoryStore {
  private importIndexReady = false;
  constructor(private storage: LabelStorage) {}

  initialize() {
    this.storage.exec(`CREATE TABLE IF NOT EXISTS mailbox_history (
      id INTEGER PRIMARY KEY, cursor TEXT, requested INTEGER NOT NULL DEFAULT 0,
      processed INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL DEFAULT 0,
      active_at INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
      blocked INTEGER NOT NULL DEFAULT 0, error TEXT, snapshot_baseline TEXT, snapshot_page TEXT,
      snapshot_revision INTEGER NOT NULL DEFAULT 0
    )`);
    if (
      ![...this.storage.exec('PRAGMA table_info(mailbox_history)')].some(
        (row) => row.name === 'snapshot_revision',
      )
    ) {
      this.storage.exec(
        'ALTER TABLE mailbox_history ADD COLUMN snapshot_revision INTEGER NOT NULL DEFAULT 0',
      );
    }
    this.storage.exec('INSERT OR IGNORE INTO mailbox_history(id) VALUES (1)');
    this.storage.exec(`CREATE TABLE IF NOT EXISTS mailbox_import_jobs (
      thread_id TEXT PRIMARY KEY, version TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'import',
      next_at INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, blocked INTEGER NOT NULL DEFAULT 0
    )`);
    this.storage.exec(`CREATE TABLE IF NOT EXISTS mailbox_notifications (
      thread_id TEXT PRIMARY KEY, version TEXT NOT NULL, next_at INTEGER NOT NULL DEFAULT 0
    )`);
    this.storage.exec(`INSERT OR IGNORE INTO mailbox_notifications(thread_id, version, next_at)
      SELECT thread_id, version, next_at FROM mailbox_import_jobs WHERE kind = 'notify'`);
    this.storage.exec("DELETE FROM mailbox_import_jobs WHERE kind = 'notify'");
    this.storage.exec('CREATE TABLE IF NOT EXISTS mailbox_sync_migrations (id TEXT PRIMARY KEY)');
    if (
      ![
        ...this.storage.exec(
          "SELECT id FROM mailbox_sync_migrations WHERE id = 'live-priority-v1'",
        ),
      ].length
    ) {
      this.storage.transaction(() => {
        this.storage.exec("UPDATE mailbox_import_jobs SET kind = 'backfill' WHERE kind = 'import'");
        this.storage.exec("INSERT INTO mailbox_sync_migrations VALUES ('live-priority-v1')");
      });
    }
    this.storage.exec(`CREATE INDEX IF NOT EXISTS mailbox_job_priority ON mailbox_import_jobs(
      blocked, CASE kind WHEN 'delete' THEN 0 WHEN 'verify' THEN 1 WHEN 'import' THEN 2 ELSE 3 END, next_at
    )`);
    this.storage.exec(
      'CREATE INDEX IF NOT EXISTS mailbox_job_due ON mailbox_import_jobs(blocked, next_at)',
    );
    this.storage.exec(
      'CREATE INDEX IF NOT EXISTS mailbox_notification_due ON mailbox_notifications(next_at)',
    );
    this.storage.exec(
      'CREATE TABLE IF NOT EXISTS mailbox_snapshot_threads (thread_id TEXT PRIMARY KEY)',
    );
    this.storage.exec(
      'CREATE TABLE IF NOT EXISTS mailbox_history_dispatch (id INTEGER PRIMARY KEY, not_before INTEGER NOT NULL)',
    );
    this.storage.exec(
      'CREATE TABLE IF NOT EXISTS mailbox_backfill_pause (id INTEGER PRIMARY KEY, until_ms INTEGER NOT NULL)',
    );
    // AI thread workflow (summary, labels, drafts) owed to threads that received new
    // mail via history. A row is `ready` once the thread import lands, leased while a
    // run is in flight, and deleted only when the runner confirms the version it ran.
    // Backfill and opened-thread imports never get a row here.
    this.storage.exec('DROP TABLE IF EXISTS mailbox_ai_pending');
    this.storage.exec(`CREATE TABLE IF NOT EXISTS mailbox_ai_runs (
      thread_id TEXT PRIMARY KEY, version TEXT NOT NULL, ready INTEGER NOT NULL DEFAULT 0,
      next_at INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 0, draft_done INTEGER NOT NULL DEFAULT 0
    )`);
  }

  /** New mail arrived: a fresh run (including a draft) is owed once it is imported. */
  markAiPending(threadId: string) {
    this.storage.exec(
      `INSERT INTO mailbox_ai_runs(thread_id, version) VALUES (?, ?)
       ON CONFLICT(thread_id) DO UPDATE SET version = excluded.version, ready = 0,
       next_at = 0, attempts = 0, draft_done = 0`,
      threadId,
      crypto.randomUUID(),
    );
  }

  /** The thread import landed; a pending run may now be dispatched. */
  markAiReady(threadId: string) {
    this.storage.exec(
      'UPDATE mailbox_ai_runs SET ready = 1, next_at = 0 WHERE thread_id = ? AND ready = 0',
      threadId,
    );
  }

  /** Leases up to `capacity - inFlight` due runs and returns them for dispatch. */
  leaseAiRuns(now: number, capacity: number, leaseMs: number) {
    const inFlight = Number(
      [
        ...this.storage.exec(
          'SELECT COUNT(*) AS n FROM mailbox_ai_runs WHERE lease_until > ?',
          now,
        ),
      ][0]?.n ?? 0,
    );
    const limit = capacity - inFlight;
    if (limit <= 0) return [];
    const rows = [
      ...this.storage.exec(
        `SELECT thread_id, version, draft_done FROM mailbox_ai_runs
         WHERE ready = 1 AND next_at <= ? AND lease_until <= ? ORDER BY next_at LIMIT ?`,
        now,
        now,
        limit,
      ),
    ];
    for (const row of rows)
      this.storage.exec(
        'UPDATE mailbox_ai_runs SET lease_until = ? WHERE thread_id = ?',
        now + leaseMs,
        row.thread_id,
      );
    return rows.map((row) => ({
      threadId: String(row.thread_id),
      version: String(row.version),
      draftDone: Boolean(row.draft_done),
    }));
  }

  /** The run for `version` finished; newer mail (another version) keeps its row. */
  completeAiRun(threadId: string, version: string) {
    this.storage.exec(
      'DELETE FROM mailbox_ai_runs WHERE thread_id = ? AND version = ?',
      threadId,
      version,
    );
    this.storage.exec('UPDATE mailbox_ai_runs SET lease_until = 0 WHERE thread_id = ?', threadId);
  }

  /** Retries with backoff, giving up after `maxAttempts`. */
  failAiRun(
    threadId: string,
    version: string,
    now: number,
    draftAttempted: boolean,
    maxAttempts = 5,
  ) {
    this.storage.transaction(() => {
      this.storage.exec(
        `UPDATE mailbox_ai_runs SET attempts = attempts + 1, lease_until = 0,
         draft_done = MAX(draft_done, ?),
         next_at = ? + MIN(1800000, 30000 * (1 << MIN(attempts, 6)))
         WHERE thread_id = ? AND version = ?`,
        Number(draftAttempted),
        now,
        threadId,
        version,
      );
      this.storage.exec(
        'DELETE FROM mailbox_ai_runs WHERE thread_id = ? AND version = ? AND attempts >= ?',
        threadId,
        version,
        maxAttempts,
      );
      this.storage.exec('UPDATE mailbox_ai_runs SET lease_until = 0 WHERE thread_id = ?', threadId);
    });
  }

  /**
   * When the next AI dispatch could happen: the earliest lease expiry while at
   * capacity (completions reschedule sooner), otherwise the earliest due ready run.
   */
  aiDue(now: number, capacity: number) {
    const leases = [
      ...this.storage.exec(
        'SELECT COUNT(*) AS n, MIN(lease_until) AS soonest FROM mailbox_ai_runs WHERE lease_until > ?',
        now,
      ),
    ][0];
    if (Number(leases?.n ?? 0) >= capacity) return Number(leases!.soonest);
    const row = [
      ...this.storage.exec(
        'SELECT MIN(MAX(next_at, lease_until)) AS due FROM mailbox_ai_runs WHERE ready = 1',
      ),
    ][0];
    return row?.due === null || row?.due === undefined ? undefined : Number(row.due);
  }

  removeAiRun(threadId: string) {
    this.storage.exec('DELETE FROM mailbox_ai_runs WHERE thread_id = ?', threadId);
  }

  state() {
    return [...this.storage.exec('SELECT * FROM mailbox_history WHERE id = 1')][0]!;
  }

  signal(now: number) {
    this.storage.exec(
      `UPDATE mailbox_history SET requested = requested + 1,
      next_at = CASE WHEN error IS NULL THEN MIN(next_at, ?) ELSE next_at END WHERE id = 1`,
      now,
    );
  }

  activate(now: number) {
    this.storage.exec(
      `UPDATE mailbox_history SET next_at = CASE WHEN active_at < ? THEN MIN(next_at, ?) ELSE next_at END,
      active_at = ? WHERE id = 1`,
      now - 15 * 60000,
      now,
      now,
    );
  }

  staggerRecovery(now: number, offset: number) {
    this.storage.exec(
      `UPDATE mailbox_history SET next_at = ? WHERE id = 1 AND next_at < ?
      AND requested = processed AND error IS NULL AND snapshot_baseline IS NULL`,
      now + offset,
      now,
    );
  }

  beginTick(now: number) {
    const row = [
      ...this.storage.exec('SELECT not_before FROM mailbox_history_dispatch WHERE id = 1'),
    ][0];
    if (row && Number(row.not_before) > now) return false;
    this.storage.exec(
      'INSERT INTO mailbox_history_dispatch VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET not_before = excluded.not_before',
      now + 1000,
    );
    return true;
  }

  delayDispatch(until: number) {
    this.storage.exec(
      `INSERT INTO mailbox_history_dispatch VALUES (1, ?) ON CONFLICT(id)
      DO UPDATE SET not_before = MAX(not_before, excluded.not_before)`,
      until,
    );
  }

  dispatchAfter() {
    const row = [
      ...this.storage.exec('SELECT not_before FROM mailbox_history_dispatch WHERE id = 1'),
    ][0];
    return Number(row?.not_before ?? 0);
  }

  commit(cursor: string, revision: number, now: number, apply: () => void) {
    this.storage.transaction(() => {
      apply();
      const active = now - Number(this.state().active_at) < 15 * 60000;
      this.storage.exec(
        `UPDATE mailbox_history SET cursor = ?, processed = ?, attempts = 0,
        blocked = 0, error = NULL, next_at = ? WHERE id = 1`,
        cursor,
        revision,
        now + (active ? 60000 : 15 * 60000),
      );
    });
  }

  defer(now: number, delayMs: number, reason: string, blocked: boolean, countAttempt = true) {
    this.storage.exec(
      `UPDATE mailbox_history SET attempts = attempts + ?, next_at = ?, error = ?, blocked = ? WHERE id = 1`,
      Number(countAttempt),
      now + delayMs,
      reason,
      Number(blocked),
    );
  }

  enqueue(threadId: string, kind = 'import') {
    this.storage.exec(
      `INSERT INTO mailbox_import_jobs(thread_id, version, kind) VALUES (?, ?, ?)
      ON CONFLICT(thread_id) DO UPDATE SET version = excluded.version, kind = excluded.kind,
      next_at = 0, attempts = 0, blocked = 0`,
      threadId,
      crypto.randomUUID(),
      kind,
    );
  }

  ensureImport(threadId: string) {
    this.storage.exec(
      `INSERT INTO mailbox_import_jobs(thread_id, version) VALUES (?, ?)
       ON CONFLICT(thread_id) DO UPDATE SET kind = CASE WHEN kind = 'backfill' THEN 'import' ELSE kind END`,
      threadId,
      crypto.randomUUID(),
    );
  }

  job(now: number) {
    return [
      ...this.storage.exec(
        `SELECT * FROM mailbox_import_jobs WHERE next_at <= ? AND blocked = 0
        AND (kind != 'backfill' OR COALESCE((SELECT until_ms FROM mailbox_backfill_pause WHERE id = 1),0) <= ?)
      ORDER BY CASE kind WHEN 'delete' THEN 0 WHEN 'verify' THEN 1 WHEN 'import' THEN 2 ELSE 3 END, next_at LIMIT 1`,
        now,
        now,
      ),
    ][0];
  }

  notify(threadId: string) {
    this.storage.exec(
      `INSERT INTO mailbox_notifications(thread_id, version) VALUES (?, ?)
       ON CONFLICT(thread_id) DO UPDATE SET version = excluded.version, next_at = 0`,
      threadId,
      crypto.randomUUID(),
    );
  }

  acknowledgeJob(threadId: string, version: string) {
    this.storage.exec(
      'DELETE FROM mailbox_import_jobs WHERE thread_id = ? AND version = ?',
      threadId,
      version,
    );
  }

  notifications(now: number) {
    return [
      ...this.storage.exec('SELECT * FROM mailbox_notifications WHERE next_at <= ? LIMIT 100', now),
    ];
  }

  acknowledgeNotification(threadId: string, version: string) {
    this.storage.exec(
      'DELETE FROM mailbox_notifications WHERE thread_id = ? AND version = ?',
      threadId,
      version,
    );
  }

  deferNotification(threadId: string, version: string, nextAt: number) {
    this.storage.exec(
      'UPDATE mailbox_notifications SET next_at = ? WHERE thread_id = ? AND version = ?',
      nextAt,
      threadId,
      version,
    );
  }

  deferJob(
    threadId: string,
    version: string,
    nextAt: number,
    blocked: boolean,
    countAttempt = true,
  ) {
    this.storage.exec(
      `UPDATE mailbox_import_jobs SET next_at = ?, blocked = ?, attempts = attempts + ?
      WHERE thread_id = ? AND version = ?`,
      nextAt,
      Number(blocked),
      Number(countAttempt),
      threadId,
      version,
    );
  }

  pauseBackfill(until: number) {
    this.storage.exec(
      `INSERT INTO mailbox_backfill_pause VALUES (1, ?) ON CONFLICT(id)
      DO UPDATE SET until_ms = MAX(until_ms, excluded.until_ms)`,
      until,
    );
  }

  progress() {
    return {
      jobs: [
        ...this.storage.exec(
          'SELECT kind, blocked, COUNT(*) AS count FROM mailbox_import_jobs GROUP BY kind, blocked',
        ),
      ],
      backfillResumeAt: Number(
        [...this.storage.exec('SELECT until_ms FROM mailbox_backfill_pause WHERE id = 1')][0]
          ?.until_ms ?? 0,
      ),
    };
  }

  importProgress() {
    if (!this.importIndexReady) {
      this.storage.exec('CREATE INDEX IF NOT EXISTS mailbox_thread_identity ON threads(thread_id)');
      this.importIndexReady = true;
    }
    const row = [
      ...this.storage.exec(`SELECT
      (SELECT COUNT(*) FROM threads) AS imported,
      (SELECT COUNT(*) FROM mailbox_import_jobs j WHERE j.kind != 'delete'
       AND NOT EXISTS (SELECT 1 FROM threads t WHERE t.thread_id = j.thread_id)) AS remaining`),
    ][0];
    return { imported: Number(row?.imported ?? 0), remaining: Number(row?.remaining ?? 0) };
  }

  beginSnapshot(baseline: string) {
    this.storage.transaction(() => {
      this.storage.exec('DELETE FROM mailbox_snapshot_threads');
      this.storage.exec(
        'UPDATE mailbox_history SET snapshot_baseline = ?, snapshot_page = NULL, snapshot_revision = requested WHERE id = 1',
        baseline,
      );
    });
  }

  snapshotPage(ids: string[], nextPage: string | null) {
    this.storage.transaction(() => {
      for (const id of ids) {
        this.storage.exec('INSERT OR IGNORE INTO mailbox_snapshot_threads VALUES (?)', id);
        this.enqueue(id, 'backfill');
      }
      this.storage.exec(
        'UPDATE mailbox_history SET snapshot_page = ? WHERE id = 1',
        nextPage ?? '__complete__',
      );
    });
  }

  finishSnapshot(now: number, remove: (threadId: string) => void) {
    const baseline = String(this.state().snapshot_baseline);
    this.commit(baseline, Number(this.state().snapshot_revision), now, () => {
      for (const row of this.storage.exec(`SELECT thread_id FROM threads WHERE thread_id NOT IN
        (SELECT thread_id FROM mailbox_snapshot_threads)`)) {
        remove(String(row.thread_id));
      }
      this.storage.exec(
        'UPDATE mailbox_history SET snapshot_baseline = NULL, snapshot_page = NULL WHERE id = 1',
      );
      this.storage.exec('DELETE FROM mailbox_snapshot_threads');
    });
  }

  retry() {
    this.storage.exec(
      'UPDATE mailbox_history SET blocked = 0, attempts = 0, next_at = 0 WHERE id = 1',
    );
    this.storage.exec('UPDATE mailbox_import_jobs SET blocked = 0, attempts = 0, next_at = 0');
  }

  jobDue() {
    const row = [
      ...this.storage.exec(`SELECT MIN(next_at) AS due FROM (
        SELECT CASE WHEN kind = 'backfill' THEN MAX(next_at, COALESCE((SELECT until_ms FROM mailbox_backfill_pause WHERE id = 1),0)) ELSE next_at END AS next_at FROM mailbox_import_jobs WHERE blocked = 0
        UNION ALL SELECT next_at FROM mailbox_notifications
      )`),
    ][0];
    return row?.due === null ? undefined : Number(row?.due);
  }
}
