import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { budgetGmailRequest } from './gmail-quota-client';
import { GmailQuotaStore } from './gmail-quota-store';
import { withGmailPriority } from './gmail-priority';
import { DatabaseSync } from 'node:sqlite';

const governor = vi.hoisted(() => ({ reserve: vi.fn(), release: vi.fn(), cooldown: vi.fn() }));
vi.mock('../env', () => ({
  env: {
    GOOGLE_CLIENT_ID: '123-test',
    GMAIL_QUOTA: { idFromName: (name: string) => name, get: () => governor },
  },
}));

let db: DatabaseSync;
let store: GmailQuotaStore;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  db = new DatabaseSync(':memory:');
  store = new GmailQuotaStore(
    {
      exec(sql, ...args) {
        const statement = db.prepare(sql);
        return /^SELECT/i.test(sql)
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
    },
    { project: 400, mailbox: 400 },
  );
  store.initialize();
  governor.reserve.mockImplementation((mailbox, units, priority) =>
    Promise.resolve(store.reserve(mailbox, units, priority, Date.now(), true)),
  );
  governor.release.mockImplementation((lease) => Promise.resolve(store.release(lease)));
  governor.cooldown.mockImplementation((mailbox, scope, until) =>
    Promise.resolve(store.cooldown(mailbox, scope, until)),
  );
});
afterEach(() => {
  db.close();
  vi.useRealTimers();
  vi.clearAllMocks();
});

const threadUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/threads/id';
const request = (priority: 'foreground' | 'sync' | 'backfill', work = vi.fn(async () => 'ok')) =>
  withGmailPriority(priority, () => budgetGmailRequest('USER@example.com', threadUrl, 'GET', work));

describe('Gmail request admission with persisted quota storage', () => {
  it('defers saturated backfill without sending it, admits live and foreground work, then resumes', async () => {
    for (let i = 0; i < 7; i++) await request('backfill');
    const denied = vi.fn(async () => 'unexpected');
    await expect(request('backfill', denied)).rejects.toMatchObject({ quotaDeferred: true });
    expect(denied).not.toHaveBeenCalled();
    await request('sync');
    await request('sync');
    await expect(request('sync', denied)).rejects.toMatchObject({ quotaDeferred: true });
    await request('foreground');
    expect(store.status('user@example.com', Date.now()).mailboxUsed).toBe(400);
    expect(db.prepare('SELECT COUNT(*) AS n FROM gmail_quota_leases').get()?.n).toBe(0);
    vi.setSystemTime(61000);
    await expect(request('backfill')).resolves.toBe('ok');
  });

  it('keeps live and foreground slots available during backfill and releases leases on failure', async () => {
    const completions: Array<() => void> = [];
    const work = vi.fn(
      () => new Promise<string>((resolve) => completions.push(() => resolve('ok'))),
    );
    // labels.get costs one unit, isolating concurrency from the unit budget.
    const admit = (priority: 'foreground' | 'sync' | 'backfill') =>
      withGmailPriority(priority, () =>
        budgetGmailRequest(
          'user@example.com',
          'https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX',
          'GET',
          work,
        ),
      );
    const backfill = Array.from({ length: 4 }, () => admit('backfill'));
    await vi.advanceTimersByTimeAsync(0);
    await expect(admit('backfill')).rejects.toMatchObject({ quotaDeferred: true });
    const live = [admit('sync'), admit('sync')];
    await vi.advanceTimersByTimeAsync(0);
    await expect(admit('sync')).rejects.toMatchObject({ quotaDeferred: true });
    const foreground = [admit('foreground'), admit('foreground')];
    await vi.advanceTimersByTimeAsync(0);
    expect(work).toHaveBeenCalledTimes(8);
    const waiting = admit('foreground');
    await vi.advanceTimersByTimeAsync(100);
    expect(work).toHaveBeenCalledTimes(8);
    completions[0]!();
    await vi.advanceTimersByTimeAsync(100);
    expect(work).toHaveBeenCalledTimes(9);
    completions.forEach((complete) => complete());
    await Promise.all([...backfill, ...live, ...foreground, waiting]);
    await expect(
      request(
        'foreground',
        vi.fn(async () => {
          throw new Error('Network failure');
        }),
      ),
    ).rejects.toThrow('Network failure');
    expect(db.prepare('SELECT COUNT(*) AS n FROM gmail_quota_leases').get()?.n).toBe(0);
  });
});
