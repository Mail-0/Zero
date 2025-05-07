import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';

// Create context for tRPC requests
export const createTRPCContext = async (opts: { headers: Headers }) => {
  return {
    headers: opts.headers,
  };
};

// Initialize tRPC
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

// Export tRPC utilities
export const { router, procedure, middleware } = t;
