import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Leading + trailing throttle for mailbox-wide refreshes.
 *
 * During a sync the server pushes one `zero_mail_get_thread` per changed thread (~1/s), and
 * each used to refetch the whole thread list, counts, drafts and sync status. The first call
 * runs immediately (new mail shows up with no added latency); calls arriving within
 * `windowMs` are coalesced into a single trailing run, so no update is ever dropped.
 */
export function createCoalescedRunner(run: () => unknown, windowMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending = false;

  const schedule = () => {
    timer = setTimeout(() => {
      timer = null;
      if (pending) {
        pending = false;
        void run();
        schedule();
      }
    }, windowMs);
  };

  return {
    trigger() {
      if (timer) {
        pending = true;
        return;
      }
      void run();
      schedule();
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = false;
    },
  };
}

export function refreshMailboxQueries(
  queryClient: QueryClient,
  keys: {
    /** Omit to leave thread details alone (e.g. when the changed thread was refreshed separately). */
    threads?: QueryKey;
    lists: QueryKey;
    counts: QueryKey;
    status?: QueryKey;
    draftDetails?: QueryKey;
    draftLists?: QueryKey;
  },
) {
  return Promise.all([
    ...(keys.threads ? [queryClient.invalidateQueries({ queryKey: keys.threads })] : []),
    queryClient.invalidateQueries({ queryKey: keys.lists }),
    queryClient.invalidateQueries({ queryKey: keys.counts }),
    ...(keys.draftDetails ? [queryClient.invalidateQueries({ queryKey: keys.draftDetails })] : []),
    ...(keys.draftLists ? [queryClient.invalidateQueries({ queryKey: keys.draftLists })] : []),
    ...(keys.status ? [queryClient.invalidateQueries({ queryKey: keys.status })] : []),
  ]);
}
