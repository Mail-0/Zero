import { connectionToDriver } from '../../lib/server-utils';
import { connection } from '../../db/schema';

import { DurableObject, env } from 'cloudflare:workers';
import { withRetry } from '../../lib/gmail-rate-limit';
import type { ParsedMessage } from '../../types';
import { Effect } from 'effect';

export class ThreadSyncWorker extends DurableObject<Env> {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
  }

  private getThreadKey(connectionId: string, threadId: string) {
    return `${connectionId}/${threadId}.json`;
  }

  public async syncThread(
    connectionId: string,
    _connection: typeof connection.$inferSelect,
    threadId: string,
  ): Promise<ParsedMessage | undefined> {
    console.log('THREAD_SYNC_WORKER: Syncing thread', connectionId, threadId);

    const driver = connectionToDriver(_connection);
    if (!driver) throw new Error('No driver available');

    // Get thread
    const thread = await Effect.runPromise(
      withRetry(Effect.tryPromise(() => driver!.get(threadId))),
    );

    await env.THREADS_BUCKET.put(
      this.getThreadKey(connectionId, threadId),
      JSON.stringify(thread),
      {
        customMetadata: {
          threadId,
        },
      },
    );

    console.log('THREAD_SYNC_WORKER: Thread synced', connectionId, threadId);

    return thread.latest;
  }
}
