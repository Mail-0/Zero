import { Redis, type UpstashRequest, type UpstashResponse } from '@upstash/redis';
import { Redis as TcpRedis } from 'ioredis';

/** Keep Upstash's serialization and Lua rate limiters when using a TCP Redis server. */
export const createRedis = (url: string, token?: string): Redis => {
  if (!/^rediss?:\/\//.test(url)) return new Redis({ url, token });

  const requester = {
    async request<TResult>(req: UpstashRequest): Promise<UpstashResponse<TResult>> {
      // Connections cannot be shared across Cloudflare Worker requests.
      const client = new TcpRedis(url, {
        lazyConnect: true,
        connectTimeout: 5000,
        commandTimeout: 5000,
        retryStrategy: () => null,
        maxRetriesPerRequest: 0,
        enableReadyCheck: false,
      });
      client.on('error', () => {}); // The command/connect promise reports errors to the caller.
      try {
        await client.connect();
        if (req.path?.[0] === 'pipeline' || req.path?.[0] === 'multi-exec') {
          const commands = req.body as [string, ...string[]][];
          const pipeline = req.path[0] === 'multi-exec' ? client.multi() : client.pipeline();
          for (const [command, ...args] of commands) pipeline.call(command, ...args);
          const results = await pipeline.exec();
          if (!results) throw new Error('Redis transaction was aborted');
          // Upstash's pipeline protocol returns an array, unlike single-command responses.
          return results.map(([error, result]) => ({
            ...(error ? { error: error.message } : { result }),
          })) as unknown as UpstashResponse<TResult>;
        }
        const [command, ...args] = req.body as [string, ...string[]];
        return { result: (await client.call(command, ...args)) as TResult };
      } finally {
        client.disconnect();
      }
    },
  };
  // v1.35 supports custom requesters at runtime but omits that constructor overload in its types.
  return new Redis(requester as unknown as ConstructorParameters<typeof Redis>[0]);
};
