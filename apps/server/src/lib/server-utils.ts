import type { IGetThreadResponse, IGetThreadsResponse } from './driver/types';
import { OutgoingMessageType } from '../routes/agent/types';
import { getContext } from 'hono/context-storage';
import { connection } from '../db/schema';
import { defaultPageSize } from './utils';
import type { HonoContext } from '../ctx';
import { createClient } from 'dormroom';
import { createDriver } from './driver';
import { eq } from 'drizzle-orm';
import { createDb } from '../db';
import { Effect } from 'effect';
import { env } from '../env';

const mbToBytes = (mb: number) => mb * 1024 * 1024;

// 8GB
const MAX_SHARD_SIZE = mbToBytes(8192);

export const getZeroDB = async (userId: string) => {
  const stub = env.ZERO_DB.get(env.ZERO_DB.idFromName(userId));
  const rpcTarget = await stub.setMetaData(userId);
  return rpcTarget;
};

class MockExecutionContext implements ExecutionContext {
  async waitUntil(promise: Promise<any>) {
    try {
      await promise;
    } catch (error) {
      console.error('MockExecutionContext: Error in waitUntil', error);
    }
  }
  passThroughOnException(): void {}
  props: any;
}

const getRegistryClient = async (connectionId: string) => {
  const registryClient = createClient({
    doNamespace: env.SHARD_REGISTRY,
    configs: [{ name: `connection:${connectionId}:registry` }],
    ctx: new MockExecutionContext(),
  });
  return registryClient;
};

const getShardClient = async (connectionId: string, shardId: string) => {
  const shardClient = createClient({
    doNamespace: env.ZERO_DRIVER,
    ctx: new MockExecutionContext(),
    configs: [{ name: `connection:${connectionId}:shard:${shardId}` }],
  });
  try {
    await shardClient.stub.setName(connectionId);
    await shardClient.stub.setupAuth();
  } catch (error) {
    console.error(`Failed to initialize shard ${shardId} for connection ${connectionId}:`, error);
    throw new Error(`Shard initialization failed: ${error}`);
  }
  return shardClient;
};

type RegistryClient = Awaited<ReturnType<typeof getRegistryClient>>;
type ShardClient = Awaited<ReturnType<typeof getShardClient>>;

const listShards = async (registry: RegistryClient): Promise<{ shard_id: string }[]> => [
  ...(await registry.exec(`SELECT * FROM shards`)).array,
];

const insertShard = (registry: RegistryClient, shardId: string) =>
  registry.exec(`INSERT INTO shards (shard_id) VALUES (?)`, [shardId]);

const deleteAllShards = async (registry: RegistryClient) => registry.exec(`DELETE FROM shards`);

// const aggregateShardData = async <T>(
//   connectionId: string,
//   shardOperation: (shard: ShardClient) => Promise<T>,
//   aggregator: (results: T[]) => T,
// ): Promise<T> => {
//   const registry = await getRegistryClient(connectionId);
//   const allShards = await listShards(registry);

//   const results = await Promise.all(
//     allShards.map(async ({ shard_id: id }) => {
//       const shard = await getShardClient(connectionId, id);
//       return await shardOperation(shard);
//     }),
//   );

//   return aggregator(results);
// };

export const aggregateShardDataEffect = <T, E = never>(
  connectionId: string,
  shardOperation: (shard: ShardClient) => Effect.Effect<T, E>,
  aggregator: (results: T[]) => T,
) => {
  return Effect.gen(function* () {
    const registry = yield* Effect.tryPromise({
      try: () => getRegistryClient(connectionId),
      catch: (error) =>
        new Error(`Failed to get registry client for connection ${connectionId}: ${error}`),
    });

    const allShards = yield* Effect.tryPromise({
      try: () => listShards(registry),
      catch: (error) => new Error(`Failed to list shards for connection ${connectionId}: ${error}`),
    });

    const shardEffects = allShards.map(({ shard_id }: { shard_id: string }) =>
      Effect.gen(function* () {
        const shard = yield* Effect.tryPromise({
          try: () => getShardClient(connectionId, shard_id),
          catch: (error) => new Error(`Failed to get shard client for shard ${shard_id}: ${error}`),
        });

        return yield* shardOperation(shard).pipe(
          Effect.catchAll((error) =>
            Effect.fail(new Error(`Operation failed on shard ${shard_id}: ${error}`)),
          ),
        );
      }),
    );

    const results = yield* Effect.all(shardEffects, { concurrency: 10 }).pipe(
      Effect.catchAll((error) =>
        Effect.fail(new Error(`Failed to execute operations across shards: ${error}`)),
      ),
    );

    return aggregator(results);
  });
};

// const aggregateShardDataSequential = async <T, A>(
//   connectionId: string,
//   shardOperation: (
//     shard: ShardClient,
//     shardId: string,
//     accumulator: A,
//   ) => Promise<{ shouldContinue: boolean; accumulator: A }>,
//   initialAccumulator: A,
//   finalizer: (accumulator: A) => T,
// ): Promise<T> => {
//   const registry = await getRegistryClient(connectionId);
//   const allShards = await listShards(registry);

//   let accumulator = initialAccumulator;

//   for (const { shard_id: id } of allShards) {
//     const shard = await getShardClient(connectionId, id);
//     const { shouldContinue, accumulator: newAccumulator } = await shardOperation(
//       shard,
//       id,
//       accumulator,
//     );
//     accumulator = newAccumulator;

//     if (!shouldContinue) {
//       break;
//     }
//   }

//   return finalizer(accumulator);
// };

export const aggregateShardDataSequentialEffect = <T, A, E = never>(
  connectionId: string,
  shardOperation: (
    shard: ShardClient,
    shardId: string,
    accumulator: A,
  ) => Effect.Effect<{ shouldContinue: boolean; accumulator: A }, E>,
  initialAccumulator: A,
  finalizer: (accumulator: A) => T,
) => {
  return Effect.gen(function* () {
    const registry = yield* Effect.tryPromise({
      try: () => getRegistryClient(connectionId),
      catch: (error) =>
        new Error(`Failed to get registry client for connection ${connectionId}: ${error}`),
    });

    const allShards = yield* Effect.tryPromise({
      try: () => listShards(registry),
      catch: (error) => new Error(`Failed to list shards for connection ${connectionId}: ${error}`),
    });

    let accumulator = initialAccumulator;

    for (const { shard_id: id } of allShards) {
      const shard = yield* Effect.tryPromise({
        try: () => getShardClient(connectionId, id),
        catch: (error) => new Error(`Failed to get shard client for shard ${id}: ${error}`),
      });

      const { shouldContinue, accumulator: newAccumulator } = yield* shardOperation(
        shard,
        id,
        accumulator,
      ).pipe(
        Effect.catchAll((error) =>
          Effect.fail(new Error(`Operation failed on shard ${id}: ${error}`)),
        ),
      );

      accumulator = newAccumulator;

      if (!shouldContinue) {
        break;
      }
    }

    return finalizer(accumulator);
  });
};

export const raceShardDataEffect = <T, E = never>(
  connectionId: string,
  shardOperation: (shard: ShardClient, shardId: string) => Effect.Effect<T, E>,
  fallbackValue: T,
) => {
  return Effect.gen(function* () {
    const registry = yield* Effect.tryPromise({
      try: () => getRegistryClient(connectionId),
      catch: (error) =>
        new Error(`Failed to get registry client for connection ${connectionId}: ${error}`),
    });

    const allShards = yield* Effect.tryPromise({
      try: () => listShards(registry),
      catch: (error) => new Error(`Failed to list shards for connection ${connectionId}: ${error}`),
    });

    if (allShards.length === 0) {
      return { result: fallbackValue, shardId: null };
    }

    const shardEffects = allShards.map(({ shard_id }: { shard_id: string }) =>
      Effect.gen(function* () {
        const shard = yield* Effect.tryPromise({
          try: () => getShardClient(connectionId, shard_id),
          catch: (error) => new Error(`Failed to get shard client for shard ${shard_id}: ${error}`),
        });

        const result = yield* shardOperation(shard, shard_id).pipe(
          Effect.catchAll((error) =>
            Effect.fail(new Error(`Operation failed on shard ${shard_id}: ${error}`)),
          ),
        );

        return { result, shardId: shard_id };
      }),
    );

    return yield* Effect.raceAll(shardEffects).pipe(
      Effect.catchAll(() => Effect.succeed({ result: fallbackValue, shardId: null })),
    );
  });
};

const getThreadEffect = (connectionId: string, threadId: string) => {
  return raceShardDataEffect(
    connectionId,
    (shard, shardId) =>
      Effect.gen(function* () {
        const thread = yield* Effect.tryPromise({
          try: async () => shard.stub.getThread(threadId, true),
          catch: (error) =>
            new Error(`Failed to setup auth or get thread from shard ${shardId}: ${error}`),
        });

        if (thread) {
          return thread;
        }

        return yield* Effect.fail(new Error(`Thread ${threadId} not found in shard ${shardId}`));
      }),
    null,
  );
};

export const getThread: (
  connectionId: string,
  threadId: string,
) => Promise<{ result: IGetThreadResponse; shardId: string }> = async (
  connectionId: string,
  threadId: string,
) => {
  const result = await Effect.runPromise(getThreadEffect(connectionId, threadId));
  if (!result.result) {
    throw new Error(`Thread ${threadId} not found`);
  }
  if (!result.shardId) {
    throw new Error(`Thread ${threadId} not found in any shard`);
  }
  return { result: result.result, shardId: result.shardId };
};

export const modifyThreadLabelsInDB = async (
  connectionId: string,
  threadId: string,
  addLabels: string[],
  removeLabels: string[],
) => {
  const threadResult = await getThread(connectionId, threadId);
  const shard = await getShardClient(connectionId, threadResult.shardId);
  await shard.stub.modifyThreadLabelsInDB(threadId, addLabels, removeLabels);

  const agent = await getZeroSocketAgent(connectionId);
  await agent.invalidateDoStateCache();

  await sendDoState(connectionId);
};

const getActiveShardId = async (connectionId: string) => {
  const registry = await getRegistryClient(connectionId);
  const allShards = await listShards(registry);

  if (allShards.length === 0) {
    const newShardId = crypto.randomUUID();
    await insertShard(registry, newShardId);
    return newShardId;
  }

  let selectedShardId: string | null = null;
  let minSize = Number.POSITIVE_INFINITY;

  await Promise.all(
    allShards.map(async ({ shard_id: id }) => {
      const shard = await getShardClient(connectionId, id);
      const size = await shard.stub.getDatabaseSize();
      if (size < MAX_SHARD_SIZE && size < minSize) {
        minSize = size;
        selectedShardId = id;
      }
    }),
  );

  if (selectedShardId) {
    return selectedShardId;
  }

  const newShardId = crypto.randomUUID();
  await insertShard(registry, newShardId);
  return newShardId;
};

export const getZeroAgent = async (connectionId: string, executionCtx?: ExecutionContext) => {
  if (!executionCtx) {
    executionCtx = new MockExecutionContext();
  }
  const shardId = await getActiveShardId(connectionId);
  const agent = await getShardClient(connectionId, shardId);

  return agent;
};

export const getZeroAgentFromShard = async (connectionId: string, shardId: string) => {
  const agent = await getShardClient(connectionId, shardId);
  return agent;
};

export const forceReSync = async (connectionId: string) => {
  const registry = await getRegistryClient(connectionId);
  const allShards = await listShards(registry);

  await Promise.allSettled(
    allShards.map(async ({ shard_id: id }) => {
      const shard = await getShardClient(connectionId, id);
      await Promise.allSettled([
        shard.exec(`DROP TABLE IF EXISTS threads`),
        shard.exec(`DROP TABLE IF EXISTS thread_labels`),
        shard.exec(`DROP TABLE IF EXISTS labels`),
      ]);
    }),
  );

  await deleteAllShards(registry);

  const agent = await getZeroAgent(connectionId);
  return agent.stub.forceReSync();
};

export const reSyncThread = async (connectionId: string, threadId: string) => {
  try {
    const { shardId } = await getThread(connectionId, threadId);
    const agent = await getZeroAgentFromShard(connectionId, shardId);
    await agent.stub.syncThread({ threadId });
  } catch (error) {
    console.error(`[ZeroAgent] Thread not found for threadId: ${threadId}`, error);
  }
};

export const getThreadsFromDB = async (
  connectionId: string,
  params: {
    labelIds?: string[];
    folder?: string;
    q?: string;
    maxResults?: number;
    pageToken?: string;
  },
): Promise<IGetThreadsResponse> => {
  // Fire and forget - don't block the thread query on state updates
  //   const agent = await getZeroSocketAgent(connectionId);
  //   await agent.invalidateDoStateCache();
  void sendDoState(connectionId);

  const maxResults = params.maxResults ?? defaultPageSize;

  if (maxResults === defaultPageSize && !params.pageToken && !params.q) {
    return Effect.promise(async () => {
      const agent = await getZeroAgent(connectionId);
      return await agent.stub.getThreadsFromDB({
        ...params,
        maxResults: maxResults,
      });
    }).pipe(Effect.runPromise);
  }

  return Effect.runPromise(
    aggregateShardDataEffect<IGetThreadsResponse>(
      connectionId,
      (shard) =>
        Effect.promise(() =>
          shard.stub.getThreadsFromDB({
            ...params,
            maxResults: maxResults,
          }),
        ),
      (shardResults) => {
        // Combine all threads from all shards
        const allThreads = shardResults.flatMap((result) => result.threads);

        // Sort by some criteria if needed (assuming threads have a sortable field)
        // allThreads.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

        // Take only the requested amount
        const threads = allThreads.slice(0, maxResults);

        // Determine if there's a next page token (simplified logic)
        const hasMoreResults = allThreads.length > maxResults;
        const nextPageToken = hasMoreResults
          ? shardResults.find((r) => r.nextPageToken)?.nextPageToken || null
          : null;

        return {
          threads,
          nextPageToken,
        };
      },
    ),
  );
};

export const getDatabaseSize = async (connectionId: string): Promise<number> => {
  return Effect.runPromise(
    aggregateShardDataEffect<number>(
      connectionId,
      (shard) => Effect.promise(() => shard.stub.getDatabaseSize()),
      (sizes) => sizes.reduce((total, shardSize) => total + shardSize, 0),
    ),
  );
};

export const deleteAllSpam = async (connectionId: string) => {
  return Effect.runPromise(
    aggregateShardDataEffect<{ deletedCount: number }>(
      connectionId,
      (shard) => Effect.promise(() => shard.stub.deleteAllSpam()),
      (results) => ({
        deletedCount: results.reduce((total, result) => total + result.deletedCount, 0),
      }),
    ),
  );
};

type CountResult = { label: string; count: number };

const getCounts = async (connectionId: string): Promise<CountResult[]> => {
  const shardCountArrays = await Effect.runPromise(
    aggregateShardDataEffect<CountResult[]>(
      connectionId,
      (shard) => Effect.promise(() => shard.stub.count()),
      (results) => results.flat(),
    ),
  );

  const countMap = new Map<string, number>();
  for (const { label, count } of shardCountArrays) {
    countMap.set(label, (countMap.get(label) || 0) + count);
  }
  return Array.from(countMap, ([label, count]) => ({ label, count }));
};

/**
 * Cannot be called by a shard, can only be called by the Worker
 * @param connectionId
 * @returns
 */
export const sendDoState = async (connectionId: string) => {
  try {
    const agent = await getZeroSocketAgent(connectionId);
    
    const cached = await agent.getCachedDoState();
    if (cached) {
      console.log(`[sendDoState] Using cached data for connection ${connectionId}`);
      return agent.broadcastChatMessage({
        type: OutgoingMessageType.Do_State,
        isSyncing: false,
        syncingFolders: ['inbox'],
        storageSize: cached.storageSize,
        counts: cached.counts,
        shards: cached.shards,
      });
    }

    console.log(`[sendDoState] Cache miss, collecting fresh data for connection ${connectionId}`);
    const [registry, size, counts] = await Promise.all([
      getRegistryClient(connectionId),
      getDatabaseSize(connectionId),
      getCounts(connectionId),
    ]);
    const shards = await listShards(registry);
    
    await agent.setCachedDoState(size, counts, shards.length);
    
    return agent.broadcastChatMessage({
      type: OutgoingMessageType.Do_State,
      isSyncing: false,
      syncingFolders: ['inbox'],
      storageSize: size,
      counts,
      shards: shards.length,
    });
  } catch (error) {
    console.error(`[sendDoState] Failed to send do state for connection ${connectionId}:`, error);
  }
};

export const getZeroSocketAgent = async (connectionId: string) => {
  const stub = env.ZERO_AGENT.get(env.ZERO_AGENT.idFromName(connectionId));
  return stub;
};

export const getActiveConnection = async () => {
  const c = getContext<HonoContext>();
  const { sessionUser, auth } = c.var;
  if (!sessionUser) throw new Error('Session Not Found');

  const db = await getZeroDB(sessionUser.id);
  const userData = await db.findUser();

  if (userData?.defaultConnectionId) {
    const activeConnection = await db.findUserConnection(userData.defaultConnectionId);
    if (activeConnection) return activeConnection;
  }

  const firstConnection = await db.findFirstConnection();
  if (!firstConnection) {
    try {
      if (auth) {
        await auth.api.revokeSession({ headers: c.req.raw.headers });
        await auth.api.signOut({ headers: c.req.raw.headers });
      }
    } catch (err) {
      console.warn(`[getActiveConnection] Session cleanup failed for user ${sessionUser.id}:`, err);
    }
    console.error(`No connections found for user ${sessionUser.id}`);
    throw new Error('No connections found for user');
  }

  return firstConnection;
};

export const connectionToDriver = (activeConnection: typeof connection.$inferSelect) => {
  if (!activeConnection.accessToken || !activeConnection.refreshToken) {
    throw new Error(`Invalid connection ${JSON.stringify(activeConnection?.id)}`);
  }

  return createDriver(activeConnection.providerId, {
    auth: {
      userId: activeConnection.userId,
      accessToken: activeConnection.accessToken,
      refreshToken: activeConnection.refreshToken,
      email: activeConnection.email,
    },
  });
};

export const verifyToken = async (token: string) => {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to verify token: ${await response.text()}`);
  }

  const data = (await response.json()) as any;
  return !!data;
};

export const resetConnection = async (connectionId: string) => {
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  await db
    .update(connection)
    .set({
      accessToken: null,
      refreshToken: null,
    })
    .where(eq(connection.id, connectionId));
  await conn.end();
};
