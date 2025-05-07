import { connectionToDriver, getActiveConnection } from '@/lib/server-utils';
import { Ratelimit, type RatelimitConfig } from '@upstash/ratelimit';
import type { HonoContext, HonoVariables } from './hono';
import { initTRPC, TRPCError } from '@trpc/server';
import { redis } from '@/lib/services';
import superjson from 'superjson';

type TrpcContext = {
  c: HonoContext;
} & HonoVariables;

const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

export const privateProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user)
    throw new TRPCError({
      code: 'UNAUTHORIZED',
    });
  return next({ ctx: { ...ctx, session: ctx.session } });
});

export const activeConnectionProcedure = privateProcedure.use(async ({ ctx, next }) => {
  const activeConnection = await getActiveConnection(ctx.c).catch((err) => {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: err instanceof Error ? err.message : 'Failed to get active connection',
    });
  });
  return next({ ctx: { ...ctx, activeConnection } });
});

export const activeDriverProcedure = activeConnectionProcedure.use(async ({ ctx, next }) => {
  const { activeConnection } = ctx;
  const driver = connectionToDriver(activeConnection, ctx.c);
  return next({ ctx: { ...ctx, driver } });
});

export const brainServerAvailableMiddleware = t.middleware(async ({ next, ctx }) => {
  return next({
    ctx: {
      ...ctx,
      brainServerAvailable: !!process.env.BRAIN_URL,
    },
  });
});

export const processIP = (req: Request) => {
  const cfIP = req.headers.get('CF-Connecting-IP');
  const ip = req.headers.get('x-forwarded-for');
  if (!ip && !cfIP && process.env.NODE_ENV === 'production') {
    console.log('No IP detected');
    throw new Error('No IP detected');
  }
  const cleanIp = ip?.split(',')[0]?.trim() ?? null;
  return cfIP ?? cleanIp ?? '127.0.0.1';
};

export const createRateLimiterMiddleware = (config: {
  limiter: RatelimitConfig['limiter'];
  generatePrefix: (ctx: TrpcContext, input: any) => string;
}) =>
  t.middleware(async ({ next, ctx, input }) => {
    // const ratelimiter = new Ratelimit({
    //   redis,
    //   limiter: config.limiter,
    //   analytics: true,
    //   prefix: config.generatePrefix(ctx, input),
    // });
    // const finalIp = processIP(ctx.c.req.raw);
    // const { success, limit, reset, remaining } = await ratelimiter.limit(finalIp);
    //
    // ctx.c.res.headers.append('X-RateLimit-Limit', limit.toString());
    // ctx.c.res.headers.append('X-RateLimit-Remaining', remaining.toString());
    // ctx.c.res.headers.append('X-RateLimit-Reset', reset.toString());
    //
    // if (!success) {
    //   console.log(`Rate limit exceeded for IP ${finalIp}.`);
    //   throw new TRPCError({
    //     code: 'TOO_MANY_REQUESTS',
    //     message: 'Too many requests. Please try again later.',
    //   });
    // }

    return next();
  });
