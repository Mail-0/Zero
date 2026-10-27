import type { ThreadListSummary } from './thread-list-summary';
import type { IGetThreadsResponse } from './driver/types';

/** Keep list membership and body-free row data in the same mailbox RPC. */
export async function withThreadListSummaries(
  page: IGetThreadsResponse,
  read: (ids: string[]) => Promise<(ThreadListSummary | null)[]>,
): Promise<IGetThreadsResponse> {
  if (!page.threads.length) return page;
  let summaries: (ThreadListSummary | null)[] = [];
  try {
    summaries = await read(page.threads.map((thread) => thread.id));
  } catch (error) {
    // Preserve membership so visible rows can retry individually.
    console.warn('[mailbox] Failed to load row summaries', error);
  }
  return {
    ...page,
    threads: page.threads.map((thread, index) => ({
      ...thread,
      summary: summaries[index] ?? null,
    })),
  };
}
