import type { LabelStorage } from './mail-label-store';
import { MailDataRevision } from './mail-data-revision';

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
  private revision: MailDataRevision;

  constructor(private storage: LabelStorage) {
    this.revision = new MailDataRevision(storage);
  }

  /** Requires the label and history store tables to exist. */
  initialize() {
    this.revision.initialize();
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
    ) AND NOT EXISTS (SELECT 1 FROM mailbox_import_jobs) AS ready`),
    ][0];
    if (!row?.ready) return false;
    // Scans every thread, so it is cached until messages or threads change.
    return this.revision.memo(
      'threads-have-messages',
      () =>
        ![
          ...this.storage.exec(`SELECT 1 FROM threads t WHERE NOT EXISTS (
          SELECT 1 FROM mail_message_labels m WHERE m.thread_id = t.thread_id) LIMIT 1`),
        ].length,
      true,
    );
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

  /** Number of stored threads, cached until threads are added or removed. */
  threadCount() {
    return this.revision.memo(
      'thread-count',
      () => Number([...this.storage.exec('SELECT COUNT(*) AS n FROM threads')][0]?.n ?? 0),
      true,
    );
  }

  localCounts(): MailCount[] {
    const counts = new Map(
      this.revision.memo('local-label-counts', () => this.countThreads()) as [string, number][],
    );
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

  /**
   * One pass over messages in thread order, applying pending intents per
   * message. Labels count distinct threads: DRAFT and SENT count any message,
   * other labels only an unread non-draft message carrying that label itself.
   * Archive counts threads with a non-draft message and no INBOX/SPAM/TRASH.
   */
  private countThreads(): [string, number][] {
    const intents = new Map<string, [string, boolean][]>();
    for (const row of this.storage.exec(
      'SELECT message_id, label_id, desired FROM mail_label_intents',
    )) {
      const list = intents.get(String(row.message_id)) ?? [];
      list.push([String(row.label_id), Boolean(row.desired)]);
      intents.set(String(row.message_id), list);
    }
    const counts = new Map<string, number>();
    let thread: string | undefined;
    let labels = new Set<string>();
    let nonDraft = false;
    let foldered = false;
    const flush = () => {
      for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
      if (thread !== undefined && nonDraft && !foldered)
        counts.set('__archive__', (counts.get('__archive__') ?? 0) + 1);
      labels = new Set();
      nonDraft = false;
      foldered = false;
    };
    for (const row of this.storage.exec(
      'SELECT thread_id, message_id, provider_labels FROM mail_message_labels ORDER BY thread_id',
    )) {
      if (String(row.thread_id) !== thread) {
        flush();
        thread = String(row.thread_id);
      }
      const effective = new Set(parseLabels(row.provider_labels));
      for (const [label, desired] of intents.get(String(row.message_id)) ?? []) {
        if (desired) effective.add(label);
        else effective.delete(label);
      }
      const draft = effective.has('DRAFT');
      const unread = effective.has('UNREAD');
      if (!draft) nonDraft = true;
      for (const label of effective) {
        if (label === 'INBOX' || label === 'SPAM' || label === 'TRASH') foldered = true;
        if (label === 'DRAFT' || label === 'SENT' || (!draft && unread)) labels.add(label);
      }
    }
    flush();
    return [...counts];
  }
}

function parseLabels(value: unknown): string[] {
  try {
    const labels: unknown = JSON.parse(String(value));
    return Array.isArray(labels) ? labels.map(String) : [];
  } catch {
    return [];
  }
}
