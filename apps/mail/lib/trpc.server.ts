import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@zero/server/trpc';
import { env } from 'cloudflare:workers';
import superjson from 'superjson';

const getUrl = () => env.VITE_PUBLIC_BACKEND_URL + '/api/trpc';

export const getServerTrpc = (req: Request) =>
  createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        maxItems: 1,
        url: getUrl(),
        transformer: superjson,
        headers: req.headers,
      }),
    ],
  });
