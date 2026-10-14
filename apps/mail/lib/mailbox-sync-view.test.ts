import { mailboxSyncView, type MailboxSyncViewState } from './mailbox-sync-view';
import { describe, expect, it } from 'vitest';

const state: MailboxSyncViewState = {
  importedThreads: 7700,
  remainingThreads: 38100,
  pendingImports: 38102,
  blockedImports: 0,
  queuedChanges: 0,
  confirmingChanges: 0,
  blockedChanges: 0,
  paused: false,
  reason: null,
  retryAt: 0,
  backfillResumeAt: 0,
  reconciling: false,
};

describe('clear initial-import progress', () => {
  it('shows discovered totals without double-counting already imported verification jobs', () => {
    const view = mailboxSyncView(state, 0)!;
    expect(view.heading).toBe('Importing older mail · 7,700 of 45,800 threads stored');
    expect(view.detail).toContain('38,100 remaining');
    expect(view.detail).toContain('You can keep using Mail0');
    expect(view.percent).toBe(16);
  });

  it('does not claim a complete total while discovering the mailbox', () => {
    const view = mailboxSyncView({ ...state, reconciling: true }, 0)!;
    expect(view.heading).toBe('Discovering mailbox threads · 7,700 stored');
    expect(view.heading).not.toContain('of');
    expect(view.percent).toBeNull();
  });

  it('distinguishes quota pauses from temporary errors and normal scheduled recovery', () => {
    const paused = mailboxSyncView({ ...state, backfillResumeAt: 60000 }, 0)!;
    expect(paused.heading).toContain('Import paused');
    expect(paused.detail).toContain('Gmail capacity');
    const error = mailboxSyncView({ ...state, reason: 'transient', retryAt: 60000 }, 0)!;
    expect(error.heading).toContain('Import retrying');
    expect(error.detail).toContain('Temporary sync error');
    const normal = mailboxSyncView({ ...state, retryAt: 60000 }, 0)!;
    expect(normal.heading).toContain('Importing older mail');
    expect(normal.detail).not.toContain('Gmail capacity');
  });

  it('keeps import progress visible during label delivery and gives actionable blocked-state context', () => {
    expect(mailboxSyncView({ ...state, queuedChanges: 2 }, 0)?.detail).toContain(
      '2 label changes syncing',
    );
    const blocked = mailboxSyncView({ ...state, paused: true, reason: 'reauth_required' }, 0)!;
    expect(blocked.heading).toContain('Import needs attention');
    expect(blocked.detail).toContain('Reconnect Gmail');
    expect(blocked.attention).toBe(true);
  });

  it('never rounds an unfinished import up to 100% and hides idle completed sync', () => {
    expect(
      mailboxSyncView({ ...state, importedThreads: 10000, remainingThreads: 1 }, 0)?.percent,
    ).toBe(99);
    expect(mailboxSyncView({ ...state, remainingThreads: 0, pendingImports: 0 }, 0)).toBeNull();
  });
});
