import type { LabelStorage } from './mail-label-store';

export type GmailPriority = 'foreground' | 'sync' | 'backfill';
export type QuotaDecision =
  | { allowed: true; leaseId?: string }
  | { allowed: false; retryAt: number; scope: 'project' | 'mailbox'; concurrent?: boolean };
export const DEFAULT_GMAIL_LIMITS = { project: 960000, mailbox: 4800 };
const fractions: Record<GmailPriority, number> = { foreground: 1, sync: 0.9, backfill: 0.7 };

export class GmailQuotaStore {
  constructor(
    private storage: LabelStorage,
    private limits = DEFAULT_GMAIL_LIMITS,
  ) {}

  initialize() {
    this.storage.exec(`CREATE TABLE IF NOT EXISTS gmail_quota_usage (
      scope TEXT NOT NULL, bucket INTEGER NOT NULL, units INTEGER NOT NULL,
      PRIMARY KEY(scope, bucket)
    )`);
    this.storage.exec('CREATE INDEX IF NOT EXISTS gmail_quota_expiry ON gmail_quota_usage(bucket)');
    this.storage.exec(
      'CREATE TABLE IF NOT EXISTS gmail_quota_cooldowns (scope TEXT PRIMARY KEY, until_ms INTEGER NOT NULL)',
    );
    this.storage.exec(
      'CREATE TABLE IF NOT EXISTS gmail_quota_leases (id TEXT PRIMARY KEY, mailbox TEXT NOT NULL, expires_at INTEGER NOT NULL)',
    );
    this.storage.exec(
      'CREATE INDEX IF NOT EXISTS gmail_quota_lease_mailbox ON gmail_quota_leases(mailbox)',
    );
  }

  reserve(
    mailbox: string,
    units: number,
    priority: GmailPriority,
    now: number,
    lease = false,
  ): QuotaDecision {
    if (
      !mailbox ||
      !Number.isInteger(units) ||
      units < 1 ||
      units > 1000 ||
      !(priority in fractions)
    ) {
      throw new Error('Invalid Gmail quota reservation');
    }
    let decision: QuotaDecision = { allowed: true };
    this.storage.transaction(() => {
      this.prune(now);
      if (lease) {
        const count = (query: string, ...args: string[]) =>
          Number([...this.storage.exec(query, ...args)][0]?.n ?? 0);
        const mailboxMax = priority === 'backfill' ? 4 : priority === 'sync' ? 6 : 8;
        const projectMax = priority === 'backfill' ? 96 : priority === 'sync' ? 112 : 128;
        if (
          count('SELECT COUNT(*) AS n FROM gmail_quota_leases WHERE mailbox = ?', mailbox) >=
          mailboxMax
        ) {
          decision = { allowed: false, retryAt: now + 1000, scope: 'mailbox', concurrent: true };
          return;
        }
        if (count('SELECT COUNT(*) AS n FROM gmail_quota_leases') >= projectMax) {
          decision = { allowed: false, retryAt: now + 1000, scope: 'project', concurrent: true };
          return;
        }
      }
      for (const scope of ['project', `mailbox:${mailbox}`]) {
        const name = scope === 'project' ? 'project' : 'mailbox';
        const cooldown = [
          ...this.storage.exec('SELECT until_ms FROM gmail_quota_cooldowns WHERE scope = ?', scope),
        ][0];
        if (cooldown && Number(cooldown.until_ms) > now) {
          decision = { allowed: false, retryAt: Number(cooldown.until_ms), scope: name };
          return;
        }
        const rows = [
          ...this.storage.exec(
            'SELECT bucket, units FROM gmail_quota_usage WHERE scope = ? ORDER BY bucket',
            scope,
          ),
        ];
        let used = rows.reduce((sum, row) => sum + Number(row.units), 0);
        const limit = Math.floor(this.limits[name] * fractions[priority]);
        if (used + units > limit) {
          let retryAt = now + 61000;
          for (const row of rows) {
            used -= Number(row.units);
            if (used + units <= limit) {
              retryAt = (Number(row.bucket) + 61) * 1000;
              break;
            }
          }
          decision = { allowed: false, retryAt, scope: name };
          return;
        }
      }
      if (lease) {
        const leaseId = crypto.randomUUID();
        this.storage.exec(
          'INSERT INTO gmail_quota_leases VALUES (?, ?, ?)',
          leaseId,
          mailbox,
          now + 120000,
        );
        decision = { allowed: true, leaseId };
      }
      for (const scope of ['project', `mailbox:${mailbox}`]) {
        this.storage.exec(
          `INSERT INTO gmail_quota_usage VALUES (?, ?, ?)
          ON CONFLICT(scope, bucket) DO UPDATE SET units = units + excluded.units`,
          scope,
          Math.floor(now / 1000),
          units,
        );
      }
    });
    return decision;
  }

  release(leaseId: string) {
    this.storage.exec('DELETE FROM gmail_quota_leases WHERE id = ?', leaseId);
  }

  cooldown(mailbox: string, scope: 'project' | 'mailbox', until: number) {
    if (!Number.isFinite(until)) throw new Error('Invalid Gmail cooldown');
    this.storage.exec(
      `INSERT INTO gmail_quota_cooldowns VALUES (?, ?)
      ON CONFLICT(scope) DO UPDATE SET until_ms = MAX(until_ms, excluded.until_ms)`,
      scope === 'project' ? 'project' : `mailbox:${mailbox}`,
      until,
    );
  }

  status(mailbox: string, now: number) {
    this.prune(now);
    const usage = (scope: string) =>
      Number(
        [
          ...this.storage.exec(
            'SELECT COALESCE(SUM(units),0) AS used FROM gmail_quota_usage WHERE scope = ?',
            scope,
          ),
        ][0]?.used ?? 0,
      );
    const cooldowns = [
      ...this.storage.exec(
        'SELECT until_ms FROM gmail_quota_cooldowns WHERE scope IN (?, ?)',
        'project',
        `mailbox:${mailbox}`,
      ),
    ];
    return {
      projectUsed: usage('project'),
      mailboxUsed: usage(`mailbox:${mailbox}`),
      projectLimit: this.limits.project,
      mailboxLimit: this.limits.mailbox,
      retryAt: Math.max(0, ...cooldowns.map((row) => Number(row.until_ms))),
    };
  }

  private prune(now: number) {
    this.storage.exec('DELETE FROM gmail_quota_leases WHERE expires_at <= ?', now);
    // Keep the partially overlapping oldest second: conservative rolling window,
    // not a fixed minute reset that permits a double burst at its boundary.
    this.storage.exec(
      'DELETE FROM gmail_quota_usage WHERE bucket < ?',
      Math.floor((now - 60000) / 1000),
    );
    this.storage.exec('DELETE FROM gmail_quota_cooldowns WHERE until_ms <= ?', now);
  }
}
