import type { LabelStorage } from './mail-label-store';

const bump = 'BEGIN UPDATE mail_data_revision SET revision = revision + 1 WHERE id = 1; END';

/**
 * A revision bumped by triggers whenever stored messages, label intents, or
 * threads change. Whole-mailbox aggregates are cached against it so repeated
 * reads cost a couple of rows instead of a full table scan.
 */
export class MailDataRevision {
  private threadsTracked = false;

  constructor(private storage: LabelStorage) {}

  /** Requires the label store tables to exist. */
  initialize() {
    this.storage.exec(
      'CREATE TABLE IF NOT EXISTS mail_data_revision (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL)',
    );
    this.storage.exec('INSERT OR IGNORE INTO mail_data_revision VALUES (1, 0)');
    this.storage.exec(`CREATE TABLE IF NOT EXISTS mail_aggregate_cache (
      key TEXT PRIMARY KEY, revision INTEGER NOT NULL, value TEXT NOT NULL
    )`);
    for (const event of ['INSERT', 'DELETE']) {
      const name = event.toLowerCase();
      this.storage.exec(
        `CREATE TRIGGER IF NOT EXISTS mail_revision_message_${name} AFTER ${event} ON mail_message_labels ${bump}`,
      );
      this.storage.exec(
        `CREATE TRIGGER IF NOT EXISTS mail_revision_intent_${name} AFTER ${event} ON mail_label_intents ${bump}`,
      );
    }
    this.storage.exec(`CREATE TRIGGER IF NOT EXISTS mail_revision_message_update
      AFTER UPDATE OF thread_id, provider_labels ON mail_message_labels
      WHEN OLD.thread_id IS NOT NEW.thread_id OR OLD.provider_labels IS NOT NEW.provider_labels ${bump}`);
    this.storage.exec(`CREATE TRIGGER IF NOT EXISTS mail_revision_intent_update
      AFTER UPDATE OF message_id, label_id, desired ON mail_label_intents
      WHEN OLD.message_id IS NOT NEW.message_id OR OLD.label_id IS NOT NEW.label_id
        OR OLD.desired IS NOT NEW.desired ${bump}`);
    this.threadsTracked = this.trackThreads();
  }

  private trackThreads() {
    if (![...this.storage.exec('PRAGMA table_info(threads)')].length) return false;
    const tracked = [
      ...this.storage.exec(
        "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = 'mail_revision_thread_insert'",
      ),
    ].length;
    if (!tracked) {
      this.storage.transaction(() => {
        this.storage.exec(
          `CREATE TRIGGER IF NOT EXISTS mail_revision_thread_insert AFTER INSERT ON threads ${bump}`,
        );
        this.storage.exec(
          `CREATE TRIGGER IF NOT EXISTS mail_revision_thread_delete AFTER DELETE ON threads ${bump}`,
        );
        // Aggregates cached before threads were tracked may be stale.
        this.storage.exec('UPDATE mail_data_revision SET revision = revision + 1 WHERE id = 1');
      });
    }
    return true;
  }

  /**
   * Returns the cached value for `key` when nothing changed since it was
   * computed. Values depending on `threads` are only cached once it is tracked.
   */
  memo<T>(key: string, compute: () => T, dependsOnThreads = false): T {
    const row = [
      ...this.storage.exec(
        `SELECT r.revision AS current, c.revision AS cached, c.value FROM mail_data_revision r
        LEFT JOIN mail_aggregate_cache c ON c.key = ? WHERE r.id = 1`,
        key,
      ),
    ][0];
    const cacheable = !dependsOnThreads || this.threadsTracked;
    if (cacheable && row && row.cached !== null && Number(row.cached) === Number(row.current)) {
      return JSON.parse(String(row.value)) as T;
    }
    const value = compute();
    if (cacheable && row) {
      this.storage.exec(
        `INSERT INTO mail_aggregate_cache VALUES (?, ?, ?) ON CONFLICT(key)
        DO UPDATE SET revision = excluded.revision, value = excluded.value`,
        key,
        Number(row.current),
        JSON.stringify(value),
      );
    }
    return value;
  }
}
