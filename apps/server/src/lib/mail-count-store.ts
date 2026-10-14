import type { LabelStorage } from './mail-label-store';

export interface MailCount {
  label: string;
  count: number;
  labelId?: string;
}

const snapshotTtl = 5 * 60000;
const changeRefreshDelay = 30000;
const catalogueTtl = 15 * 60000;
const normalizeName = (name: string) =>
  name.toLowerCase() === 'draft' ? 'drafts' : name.toLowerCase();

export class MailCountStore {
  private inFlight: Promise<MailCount[]> | undefined;

  constructor(private storage: LabelStorage) {}

  initialize() {
    this.storage.exec(`CREATE TABLE IF NOT EXISTS mail_count_cache (
      id INTEGER PRIMARY KEY, counts TEXT, fetched_at INTEGER NOT NULL DEFAULT 0,
      cursor TEXT, retry_at INTEGER NOT NULL DEFAULT 0,
      catalogue TEXT, catalogue_at INTEGER NOT NULL DEFAULT 0
    )`);
    this.storage.exec('INSERT OR IGNORE INTO mail_count_cache(id) VALUES (1)');
    this.storage.exec(`CREATE TABLE IF NOT EXISTS mail_count_refresh (
      id INTEGER PRIMARY KEY, not_before INTEGER NOT NULL, ready INTEGER NOT NULL DEFAULT 0
    )`);
  }

  pendingRefresh() {
    const row = [
      ...this.storage.exec('SELECT not_before, ready FROM mail_count_refresh WHERE id = 1'),
    ][0];
    return row ? { due: Number(row.not_before), ready: Boolean(row.ready) } : undefined;
  }

  private deferRefresh(until: number) {
    this.storage.exec(
      `INSERT INTO mail_count_refresh VALUES (1, ?, 0)
      ON CONFLICT(id) DO UPDATE SET not_before = CASE WHEN ready = 1 THEN excluded.not_before
      ELSE MIN(not_before, excluded.not_before) END, ready = 0`,
      until,
    );
  }

  acknowledgeRefreshNotification() {
    this.storage.exec('DELETE FROM mail_count_refresh WHERE id = 1 AND ready = 1');
  }

  private refreshed() {
    this.storage.exec('UPDATE mail_count_refresh SET ready = 1 WHERE id = 1');
  }

  private state() {
    return [...this.storage.exec('SELECT * FROM mail_count_cache WHERE id = 1')][0]!;
  }

  saveCatalogue(labels: { id: string; name: string }[], now: number) {
    this.storage.exec(
      'UPDATE mail_count_cache SET catalogue = ?, catalogue_at = ? WHERE id = 1',
      JSON.stringify(labels.map((label) => ({ id: label.id, name: normalizeName(label.name) }))),
      now,
    );
  }

  invalidate() {
    this.storage.exec(
      'UPDATE mail_count_cache SET fetched_at = ?, catalogue_at = ?, retry_at = 0 WHERE id = 1',
      -snapshotTtl,
      -catalogueTtl,
    );
  }

  hasCompleteCoverage() {
    const row = [
      ...this.storage.exec(`SELECT EXISTS (
      SELECT 1 FROM mailbox_history WHERE id = 1 AND cursor IS NOT NULL AND snapshot_baseline IS NULL
    ) AND NOT EXISTS (SELECT 1 FROM mailbox_import_jobs)
      AND NOT EXISTS (SELECT 1 FROM threads t WHERE NOT EXISTS (
        SELECT 1 FROM mail_message_labels m WHERE m.thread_id = t.thread_id
      )) AS complete`),
    ][0];
    return Boolean(row?.complete);
  }

  async read(
    now: number,
    cursor: string | null,
    loadCounts: () => Promise<MailCount[]>,
    loadCatalogue: () => Promise<{ id: string; name: string }[]>,
  ): Promise<MailCount[]> {
    // Coalesce both the cold snapshot fan-out and catalogue requests.
    if (this.inFlight) return this.inFlight;
    const request = this.readCounts(now, cursor, loadCounts, loadCatalogue);
    this.inFlight = request;
    try {
      return await request;
    } finally {
      this.inFlight = undefined;
    }
  }

  private async readCounts(
    now: number,
    cursor: string | null,
    loadCounts: () => Promise<MailCount[]>,
    loadCatalogue: () => Promise<{ id: string; name: string }[]>,
  ) {
    const state = this.state();
    const complete = this.hasCompleteCoverage();
    if (Number(state.retry_at) > now && (complete ? !state.catalogue : !state.counts)) {
      throw new Error('Folder count refresh is waiting to retry');
    }
    if (complete) {
      if (
        !state.catalogue ||
        (Number(state.retry_at) <= now && now - Number(state.catalogue_at) >= catalogueTtl)
      ) {
        try {
          this.saveCatalogue(await loadCatalogue(), now);
        } catch (error) {
          this.storage.exec(
            'UPDATE mail_count_cache SET retry_at = ? WHERE id = 1',
            now + changeRefreshDelay,
          );
          if (!state.catalogue) throw error;
        }
      }
      const counts = this.localCounts();
      // Keep the latest complete local totals available while a newly discovered
      // thread is importing or a reconciliation is in progress.
      this.storage.exec(
        'UPDATE mail_count_cache SET counts = ?, fetched_at = ?, cursor = ? WHERE id = 1',
        JSON.stringify(counts),
        now,
        cursor,
      );
      this.refreshed();
      return counts;
    }
    const cached = state.counts ? (JSON.parse(String(state.counts)) as MailCount[]) : undefined;
    const age = now - Number(state.fetched_at);
    const pending = this.pendingRefresh();
    const due = pending && !pending.ready && pending.due <= now;
    if (
      cached &&
      (Number(state.retry_at) > now ||
        (!due && age < snapshotTtl && (state.cursor === cursor || age < changeRefreshDelay)))
    ) {
      if (state.cursor !== cursor || Number(state.retry_at) > now)
        this.deferRefresh(
          Math.max(Number(state.retry_at), Number(state.fetched_at) + changeRefreshDelay),
        );
      return this.currentNames(cached);
    }
    try {
      const counts = await loadCounts();
      if (
        !counts.length ||
        counts.some((row) => !row.label || !Number.isFinite(row.count) || row.count < 0)
      ) {
        throw new Error('Provider returned an incomplete count snapshot');
      }
      this.storage.transaction(() => {
        this.storage.exec(
          'UPDATE mail_count_cache SET counts = ?, fetched_at = ?, cursor = ?, retry_at = 0 WHERE id = 1',
          JSON.stringify(counts),
          now,
          cursor,
        );
        this.saveCatalogue(
          counts.flatMap((row) => (row.labelId ? [{ id: row.labelId, name: row.label }] : [])),
          now,
        );
        this.refreshed();
      });
      return counts;
    } catch (error) {
      this.storage.exec(
        'UPDATE mail_count_cache SET retry_at = ? WHERE id = 1',
        now + changeRefreshDelay,
      );
      // Keep retry work even when the browser consumed its sole invalidation.
      this.storage.exec('DELETE FROM mail_count_refresh WHERE id = 1');
      this.deferRefresh(now + changeRefreshDelay);
      if (cached) return this.currentNames(cached);
      throw error;
    }
  }

  private currentNames(counts: MailCount[]) {
    const catalogue = this.state().catalogue;
    if (!catalogue) return counts;
    const names = new Map(
      (JSON.parse(String(catalogue)) as { id: string; name: string }[]).map((label) => [
        label.id,
        label.name,
      ]),
    );
    return counts.flatMap((row) => {
      if (!row.labelId) return [row];
      const label = names.get(row.labelId);
      return label ? [{ ...row, label }] : [];
    });
  }

  localCounts(): MailCount[] {
    // Apply pending intents per message before counting distinct threads. An
    // unread message elsewhere in a conversation must not inflate a label's
    // unread badge if that message does not carry the label itself.
    const rows = [
      ...this.storage.exec(`WITH effective AS (
      SELECT m.message_id, m.thread_id, j.value AS label_id
      FROM mail_message_labels m, json_each(m.provider_labels) j
      WHERE NOT EXISTS (SELECT 1 FROM mail_label_intents i
        WHERE i.message_id = m.message_id AND i.label_id = j.value AND i.desired = 0)
      UNION
      SELECT m.message_id, m.thread_id, i.label_id FROM mail_message_labels m
      JOIN mail_label_intents i ON i.message_id = m.message_id WHERE i.desired = 1
    ), counts AS (
      SELECT label_id, COUNT(DISTINCT thread_id) AS count FROM effective e
      WHERE label_id IN ('DRAFT', 'SENT') OR (
        NOT EXISTS (SELECT 1 FROM effective d WHERE d.message_id = e.message_id AND d.label_id = 'DRAFT')
        AND EXISTS (SELECT 1 FROM effective u WHERE u.message_id = e.message_id AND u.label_id = 'UNREAD')
      ) GROUP BY label_id
    ) SELECT label_id, count FROM counts
    UNION ALL SELECT '__archive__', COUNT(DISTINCT m.thread_id) FROM mail_message_labels m
      WHERE NOT EXISTS (SELECT 1 FROM effective d WHERE d.message_id = m.message_id AND d.label_id = 'DRAFT')
      AND NOT EXISTS (SELECT 1 FROM effective f WHERE f.thread_id = m.thread_id AND f.label_id IN ('INBOX','SPAM','TRASH'))`),
    ];
    const counts = new Map(rows.map((row) => [String(row.label_id), Number(row.count)]));
    const state = this.state();
    const catalogue = state.catalogue
      ? (JSON.parse(String(state.catalogue)) as { id: string; name: string }[])
      : [];
    return [
      ...catalogue.map((label) => ({
        labelId: label.id,
        label: label.name,
        count: counts.get(label.id) ?? 0,
      })),
      { label: 'archive', count: counts.get('__archive__') ?? 0 },
    ];
  }
}
