import type { IGetThreadsResponse } from './driver/types';
import type { LabelStorage } from './mail-label-store';

export interface MailSearch {
  folder: string;
  query?: string;
  maxResults?: number;
  labelIds?: string[];
  pageToken?: string;
}

export class MailSearchStore {
  private inFlight = new Map<string, Promise<IGetThreadsResponse>>();

  constructor(private storage: LabelStorage) {}

  initialize() {
    this.storage.exec(`CREATE TABLE IF NOT EXISTS mail_search_cache (
      key TEXT PRIMARY KEY, stamp TEXT NOT NULL, response TEXT NOT NULL,
      expires_at INTEGER NOT NULL, touched_at INTEGER NOT NULL
    )`);
    this.storage.exec(
      'CREATE TABLE IF NOT EXISTS mail_search_revision (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL)',
    );
    this.storage.exec('INSERT OR IGNORE INTO mail_search_revision VALUES (1, 0)');
  }

  invalidate() {
    this.storage.exec('UPDATE mail_search_revision SET revision = revision + 1 WHERE id = 1');
    this.storage.exec('DELETE FROM mail_search_cache');
  }

  private revision() {
    return Number(
      [...this.storage.exec('SELECT revision FROM mail_search_revision WHERE id = 1')][0]
        ?.revision ?? 0,
    );
  }

  async read(
    params: MailSearch,
    now: number,
    historyStamp: string,
    load: (params: MailSearch) => Promise<IGetThreadsResponse>,
  ): Promise<IGetThreadsResponse> {
    const normalized = {
      folder: params.folder,
      query: params.query?.trim() ?? '',
      maxResults: params.maxResults ?? 100,
      labelIds: [...new Set(params.labelIds ?? [])].sort(),
      pageToken: params.pageToken || undefined,
    };
    // Do not collapse internal whitespace or alter case: quoted Gmail queries
    // and opaque pagination tokens must retain their provider semantics.
    const key = JSON.stringify(normalized);
    const revision = this.revision();
    const stamp = JSON.stringify([revision, historyStamp]);
    const cached = [
      ...this.storage.exec(
        'SELECT response FROM mail_search_cache WHERE key = ? AND stamp = ? AND expires_at > ?',
        key,
        stamp,
        now,
      ),
    ][0];
    if (cached) {
      this.storage.exec('UPDATE mail_search_cache SET touched_at = ? WHERE key = ?', now, key);
      return JSON.parse(String(cached.response)) as IGetThreadsResponse;
    }
    const flightKey = JSON.stringify([key, stamp]);
    const existing = this.inFlight.get(flightKey);
    if (existing) return existing;
    const request = this.fetch(normalized, key, stamp, revision, now, load);
    this.inFlight.set(flightKey, request);
    try {
      return await request;
    } finally {
      this.inFlight.delete(flightKey);
    }
  }

  private async fetch(
    params: MailSearch,
    key: string,
    stamp: string,
    revision: number,
    now: number,
    load: (params: MailSearch) => Promise<IGetThreadsResponse>,
  ) {
    const provider = await load(params);
    // Search stores membership/page tokens only; message bodies still come from
    // the existing SQLite/R2 thread cache and deduplicated cold imports.
    const response: IGetThreadsResponse = {
      threads: provider.threads.map((thread) => ({ id: thread.id, historyId: thread.historyId })),
      nextPageToken: provider.nextPageToken,
    };
    if (this.revision() === revision) {
      this.storage.transaction(() => {
        this.storage.exec('DELETE FROM mail_search_cache WHERE expires_at <= ?', now);
        this.storage.exec(
          `INSERT INTO mail_search_cache VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET stamp = excluded.stamp, response = excluded.response,
           expires_at = excluded.expires_at, touched_at = excluded.touched_at`,
          key,
          stamp,
          JSON.stringify(response),
          now + 30000,
          now,
        );
        this.storage.exec(`DELETE FROM mail_search_cache WHERE key IN (
          SELECT key FROM mail_search_cache ORDER BY touched_at DESC, key DESC LIMIT -1 OFFSET 128
        )`);
      });
    }
    return response;
  }
}
