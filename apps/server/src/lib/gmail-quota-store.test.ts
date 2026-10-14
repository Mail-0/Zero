import type { LabelStorage } from './mail-label-store';
import { GmailQuotaStore } from './gmail-quota-store';
import { gmailQuotaCost } from './gmail-quota-cost';
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

function fixture(limits = { project: 100, mailbox: 50 }) {
  const db = new DatabaseSync(':memory:');
  const storage: LabelStorage = {
    exec(sql, ...args) {
      const statement = db.prepare(sql);
      return /^\s*SELECT/i.test(sql)
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
  const quota = new GmailQuotaStore(storage, limits);
  quota.initialize();
  return { quota, reopen: () => new GmailQuotaStore(storage, limits) };
}

describe('shared Gmail quota', () => {
  it('bounds concurrent requests, reserves foreground slots and recovers leaked leases after eviction', () => {
    const { quota, reopen } = fixture({ project: 1000, mailbox: 1000 });
    const leases = Array.from({ length: 4 }, () => quota.reserve('a', 1, 'backfill', 0, true));
    expect(leases.every((lease) => lease.allowed)).toBe(true);
    expect(quota.reserve('a', 1, 'backfill', 0, true)).toMatchObject({
      allowed: false,
      concurrent: true,
    });
    expect(quota.reserve('a', 1, 'foreground', 0, true).allowed).toBe(true);
    const first = leases[0]!;
    if (first.allowed) quota.release(first.leaseId!);
    expect(quota.reserve('a', 1, 'backfill', 0, true).allowed).toBe(false); // foreground still occupies a shared slot
    expect(reopen().reserve('a', 1, 'backfill', 120000, true).allowed).toBe(true);
  });
  it('shares the project budget across mailbox instances without partially charging a denial', () => {
    const { quota, reopen } = fixture({ project: 100, mailbox: 100 });
    expect(quota.reserve('a', 60, 'foreground', 0)).toEqual({ allowed: true });
    expect(reopen().reserve('b', 50, 'foreground', 0)).toEqual({
      allowed: false,
      scope: 'project',
      retryAt: 61000,
    });
    expect(quota.status('b', 0).mailboxUsed).toBe(0);
    expect(quota.status('a', 0).projectUsed).toBe(60);
  });
  it('isolates mailbox limits and rolls usage out conservatively at minute boundaries', () => {
    const { quota } = fixture();
    quota.reserve('a', 50, 'foreground', 999);
    expect(quota.reserve('a', 1, 'foreground', 60000)).toEqual({
      allowed: false,
      scope: 'mailbox',
      retryAt: 61000,
    });
    expect(quota.reserve('b', 10, 'foreground', 60000).allowed).toBe(true);
    expect(quota.reserve('a', 50, 'foreground', 61000).allowed).toBe(true);
  });
  it('reserves headroom for live sync and user requests when backfill is full', () => {
    const { quota } = fixture({ project: 100, mailbox: 100 });
    expect(quota.reserve('a', 70, 'backfill', 0).allowed).toBe(true);
    expect(quota.reserve('a', 1, 'backfill', 0).allowed).toBe(false);
    expect(quota.reserve('a', 20, 'sync', 0).allowed).toBe(true);
    expect(quota.reserve('a', 1, 'sync', 0).allowed).toBe(false);
    expect(quota.reserve('a', 10, 'foreground', 0).allowed).toBe(true);
  });
  it('persists mailbox and project cooldowns and never shortens Retry-After', () => {
    const { quota, reopen } = fixture();
    quota.cooldown('a', 'mailbox', 300000);
    quota.cooldown('a', 'mailbox', 1000);
    expect(reopen().reserve('a', 1, 'foreground', 1000)).toEqual({
      allowed: false,
      scope: 'mailbox',
      retryAt: 300000,
    });
    expect(quota.reserve('b', 1, 'foreground', 1000).allowed).toBe(true);
    quota.cooldown('a', 'project', 400000);
    expect(quota.reserve('b', 1, 'foreground', 1000)).toEqual({
      allowed: false,
      scope: 'project',
      retryAt: 400000,
    });
  });
  it('charges current documented method costs, including uploads and attachments', () => {
    const base = 'https://gmail.googleapis.com/gmail/v1/users/me';
    expect(gmailQuotaCost(`${base}/threads/id`)).toBe(40);
    expect(gmailQuotaCost(`${base}/messages/id/attachments/attachment`)).toBe(20);
    expect(gmailQuotaCost(`${base}/messages/batchModify`, 'POST')).toBe(50);
    expect(
      gmailQuotaCost('https://www.googleapis.com/upload/gmail/v1/users/me/messages/send', 'POST'),
    ).toBe(100);
    expect(gmailQuotaCost(`${base}/labels/id`)).toBe(1);
    expect(gmailQuotaCost('https://people.googleapis.com/v1/people/me')).toBeUndefined();
    expect(gmailQuotaCost('https://oauth2.googleapis.com/token', 'POST')).toBeUndefined();
  });
});
