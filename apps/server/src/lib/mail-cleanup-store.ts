import type { LabelStorage } from './mail-label-store';

// Enumeration is completed before changing SPAM membership. A durable action
// clock records even no-op user restores, after their outbox overlay is gone.
export class MailCleanupStore {
  constructor(private storage: LabelStorage) {}

  initialize() {
    this.storage.exec(
      `CREATE TABLE IF NOT EXISTS mail_action_clock (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL)`,
    );
    this.storage.exec('INSERT OR IGNORE INTO mail_action_clock VALUES (1, 0)');
    this.storage.exec(
      `CREATE TABLE IF NOT EXISTS mail_move_revisions (thread_id TEXT PRIMARY KEY, revision INTEGER NOT NULL)`,
    );
    this.storage.exec(`CREATE TABLE IF NOT EXISTS mail_spam_cleanup (
      id INTEGER PRIMARY KEY, boundary INTEGER NOT NULL, phase TEXT NOT NULL,
      page TEXT, next_at INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
      blocked INTEGER NOT NULL DEFAULT 0, error TEXT, admitted INTEGER NOT NULL DEFAULT 0
    )`);
    this.storage.exec('CREATE TABLE IF NOT EXISTS mail_spam_targets (thread_id TEXT PRIMARY KEY)');
  }

  recordMove(threadIds: string[]) {
    this.storage.exec('UPDATE mail_action_clock SET revision = revision + 1 WHERE id = 1');
    const job = this.state();
    if (!job || job.phase === 'done') return;
    for (const id of new Set(threadIds))
      this.storage.exec(
        `INSERT INTO mail_move_revisions SELECT ?, revision FROM mail_action_clock WHERE id = 1
        ON CONFLICT(thread_id) DO UPDATE SET revision = excluded.revision`,
        id,
      );
  }

  state() {
    return [...this.storage.exec('SELECT * FROM mail_spam_cleanup WHERE id = 1')][0];
  }

  admit() {
    this.storage.transaction(() => {
      if (this.state() && this.state()!.phase !== 'done') return;
      this.storage.exec('DELETE FROM mail_spam_targets');
      this.storage.exec(`INSERT OR REPLACE INTO mail_spam_cleanup(id, boundary, phase)
        SELECT 1, revision, 'discover' FROM mail_action_clock WHERE id = 1`);
    });
    return this.state()!;
  }

  page(ids: string[], nextPage: string | null) {
    this.storage.transaction(() => {
      for (const id of ids)
        this.storage.exec('INSERT OR IGNORE INTO mail_spam_targets VALUES (?)', id);
      this.storage.exec(
        `UPDATE mail_spam_cleanup SET page = ?, phase = ?, attempts = 0,
        next_at = 0, blocked = 0, error = NULL WHERE id = 1`,
        nextPage,
        nextPage ? 'discover' : 'deliver',
      );
    });
  }

  target() {
    return [...this.storage.exec('SELECT thread_id FROM mail_spam_targets LIMIT 1')][0]
      ?.thread_id as string | undefined;
  }

  superseded(threadId: string) {
    return (
      [
        ...this.storage.exec(
          `SELECT thread_id FROM mail_move_revisions
      WHERE thread_id = ? AND revision > (SELECT boundary FROM mail_spam_cleanup WHERE id = 1)`,
          threadId,
        ),
      ].length > 0
    );
  }

  acknowledge(threadId: string, applied: boolean) {
    this.storage.exec('DELETE FROM mail_spam_targets WHERE thread_id = ?', threadId);
    this.storage.exec(
      `UPDATE mail_spam_cleanup SET admitted = admitted + ?, attempts = 0,
      next_at = 0, error = NULL WHERE id = 1`,
      Number(applied),
    );
  }

  finish() {
    this.storage.exec("UPDATE mail_spam_cleanup SET phase = 'done', error = NULL WHERE id = 1");
    // Only entries newer than an active boundary are needed, and future jobs
    // capture the current clock. Bound retained per-thread revision metadata.
    this.storage.exec('DELETE FROM mail_move_revisions');
  }

  defer(until: number, reason: string, blocked: boolean, countAttempt: boolean) {
    this.storage.exec(
      `UPDATE mail_spam_cleanup SET next_at = ?, error = ?, blocked = ?,
      attempts = attempts + ? WHERE id = 1`,
      until,
      reason,
      Number(blocked),
      Number(countAttempt),
    );
  }

  retry() {
    this.storage.exec(
      'UPDATE mail_spam_cleanup SET blocked = 0, next_at = 0, attempts = 0, error = NULL WHERE id = 1',
    );
  }
}
