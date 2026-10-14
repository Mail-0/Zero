export interface MailboxSyncViewState {
  importedThreads: number;
  remainingThreads?: number;
  pendingImports: number;
  blockedImports: number;
  queuedChanges: number;
  confirmingChanges: number;
  blockedChanges: number;
  paused: boolean;
  reason: string | null;
  retryAt: number;
  backfillResumeAt?: number;
  reconciling: boolean;
  quota?: { retryAt: number } | null;
}

export function mailboxSyncView(data: MailboxSyncViewState, now = Date.now()) {
  const stored = data.importedThreads;
  // Older persisted query data can precede the new remaining-thread field.
  const remaining = data.remainingThreads ?? data.pendingImports;
  const total = stored + remaining;
  const blocked = data.blockedImports + data.blockedChanges;
  const changes = data.queuedChanges + data.confirmingChanges;
  const attention = data.paused || blocked > 0;
  const capacity =
    data.reason === 'quota_deferred' ||
    data.reason === 'rate_limited' ||
    (data.backfillResumeAt ?? 0) > now ||
    (data.quota?.retryAt ?? 0) > now;
  const retrying = Boolean(data.reason) && !capacity && !attention;
  const retryAt = capacity
    ? Math.max(data.backfillResumeAt ?? 0, data.quota?.retryAt ?? 0, data.reason ? data.retryAt : 0)
    : data.retryAt;
  const retry =
    retryAt > now
      ? ` at ${new Date(retryAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
      : '';
  let stateDetail = '';
  if (attention) {
    stateDetail =
      data.reason === 'reauth_required'
        ? 'Reconnect Gmail to continue. Your imported mail remains saved.'
        : `${blocked ? `${blocked.toLocaleString()} blocked operation${blocked === 1 ? '' : 's'}. ` : ''}Sync needs attention. Your imported mail remains saved.`;
  } else if (capacity) {
    stateDetail = `Waiting for Gmail capacity. Resumes automatically${retry}.`;
  } else if (retrying) {
    stateDetail = `Temporary sync error. Retrying automatically${retry}.`;
  } else if (changes) {
    stateDetail = `${changes.toLocaleString()} label change${changes === 1 ? '' : 's'} syncing.`;
  }

  if (data.reconciling) {
    return {
      heading: `Discovering mailbox threads · ${stored.toLocaleString()} stored`,
      detail: stateDetail || 'Finding older mail. You can keep using Mail0.',
      percent: null,
      attention,
    };
  }
  if (remaining > 0) {
    const phase = attention
      ? 'Import needs attention'
      : capacity
        ? 'Import paused'
        : retrying
          ? 'Import retrying'
          : 'Importing older mail';
    const percent = Math.min(99, Math.floor((stored / total) * 100));
    return {
      heading: `${phase} · ${stored.toLocaleString()} of ${total.toLocaleString()} threads stored`,
      detail: `${percent}% stored · ${remaining.toLocaleString()} remaining. ${stateDetail || 'You can keep using Mail0.'}`,
      percent,
      attention,
    };
  }
  if (stateDetail) {
    return {
      heading: attention
        ? 'Sync needs attention'
        : capacity
          ? 'Sync waiting for Gmail capacity'
          : retrying
            ? 'Sync retrying'
            : 'Syncing label changes',
      detail: stateDetail,
      percent: null,
      attention,
    };
  }
  return null;
}
