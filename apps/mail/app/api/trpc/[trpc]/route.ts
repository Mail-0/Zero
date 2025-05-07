import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/app/trpc/root';
import { createTRPCContext } from '@/app/trpc/trpc';

// Handle tRPC requests
export const POST = async (req: Request) => {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
  });
};
