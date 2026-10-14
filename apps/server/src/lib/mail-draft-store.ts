import type { LabelStorage } from './mail-label-store';
import type { MailManager } from './driver/types';
import superjson from 'superjson';

export class MailDraftStore {
  private inFlight = new Map<string, Promise<unknown>>();

  constructor(private storage: LabelStorage) {}

  initialize() {
    this.storage.exec(`CREATE TABLE IF NOT EXISTS mail_draft_cache (
      key TEXT PRIMARY KEY, stamp TEXT NOT NULL, response TEXT NOT NULL,
      expires_at INTEGER NOT NULL, touched_at INTEGER NOT NULL
    )`);
    this.storage.exec(
      'CREATE TABLE IF NOT EXISTS mail_draft_revision (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL)',
    );
    this.storage.exec('INSERT OR IGNORE INTO mail_draft_revision VALUES (1, 0)');
  }

  invalidate() {
    this.storage.exec('UPDATE mail_draft_revision SET revision = revision + 1 WHERE id = 1');
    this.storage.exec('DELETE FROM mail_draft_cache');
  }

  private revision() {
    return Number(
      [...this.storage.exec('SELECT revision FROM mail_draft_revision WHERE id = 1')][0]
        ?.revision ?? 0,
    );
  }

  get(id: string, now: number, stamp: string, load: () => ReturnType<MailManager['getDraft']>) {
    return this.read(JSON.stringify(['get', id]), now, stamp, 5000, load);
  }

  list(
    params: Parameters<MailManager['listDrafts']>[0],
    now: number,
    stamp: string,
    load: (
      params: Parameters<MailManager['listDrafts']>[0],
    ) => ReturnType<MailManager['listDrafts']>,
  ) {
    const normalized = {
      q: params.q?.trim() ?? '',
      maxResults: params.maxResults ?? 20,
      pageToken: params.pageToken || undefined,
    };
    return this.read(JSON.stringify(['list', normalized]), now, stamp, 10000, () =>
      load(normalized),
    );
  }

  private async read<T>(
    key: string,
    now: number,
    history: string,
    ttl: number,
    load: () => Promise<T>,
  ): Promise<T> {
    const revision = this.revision();
    const stamp = JSON.stringify([revision, history]);
    const row = [
      ...this.storage.exec(
        'SELECT response FROM mail_draft_cache WHERE key = ? AND stamp = ? AND expires_at > ?',
        key,
        stamp,
        now,
      ),
    ][0];
    if (row) return superjson.parse<T>(String(row.response));
    const flightKey = JSON.stringify([key, stamp]);
    const existing = this.inFlight.get(flightKey);
    if (existing) return existing as Promise<T>;
    const request = this.fetch(key, stamp, revision, now, ttl, load);
    this.inFlight.set(flightKey, request);
    try {
      return await request;
    } finally {
      this.inFlight.delete(flightKey);
    }
  }

  private async fetch<T>(
    key: string,
    stamp: string,
    revision: number,
    now: number,
    ttl: number,
    load: () => Promise<T>,
  ) {
    const response = await load();
    const serialized = superjson.stringify(response);
    // Draft DTOs can include base64 attachments. Keep large drafts readable
    // without exceeding SQLite's row limit; attachment bytes use R2 separately.
    if (
      serialized.length <= 1024 * 1024 &&
      new TextEncoder().encode(serialized).byteLength <= 1024 * 1024 &&
      this.revision() === revision
    ) {
      this.storage.transaction(() => {
        this.storage.exec('DELETE FROM mail_draft_cache WHERE expires_at <= ?', now);
        this.storage.exec(
          `INSERT INTO mail_draft_cache VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET stamp = excluded.stamp, response = excluded.response,
           expires_at = excluded.expires_at, touched_at = excluded.touched_at`,
          key,
          stamp,
          serialized,
          now + ttl,
          now,
        );
        this.storage.exec(`DELETE FROM mail_draft_cache WHERE key IN (
          SELECT key FROM mail_draft_cache ORDER BY touched_at DESC, key DESC LIMIT -1 OFFSET 128
        )`);
      });
    }
    return response;
  }
}
