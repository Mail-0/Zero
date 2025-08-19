import { getActiveConnection, getZeroDB } from '../lib/server-utils';
import { Ratelimit, type RatelimitConfig } from '@upstash/ratelimit';
import type { HonoContext, HonoVariables } from '../ctx';
import { getConnInfo } from 'hono/cloudflare-workers';
import { initTRPC, TRPCError } from '@trpc/server';
import { createLoggingMiddleware } from '../lib/trpc-logging';

import { redis } from '../lib/services';
import type { Context } from 'hono';
import superjson from 'superjson';

type TrpcContext = {
  c: Context<HonoContext>;
} & HonoVariables;

const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });

const loggingMiddleware = createLoggingMiddleware();

export const router = t.router;
export const publicProcedure = t.procedure.use(loggingMiddleware);

export const privateProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const { addRequestSpan, completeRequestSpan } = await import('../lib/trace-context');

  // Start auth validation span
  const authSpan = addRequestSpan(ctx.c, 'trpc_auth_validation', {
    hasSessionUser: !!ctx.sessionUser,
    procedure: 'private',
  }, {
    'trpc.auth_required': 'true'
  });

  if (!ctx.sessionUser) {
    if (authSpan) {
      completeRequestSpan(ctx.c, authSpan.id, {
        success: false,
        reason: 'no_session_user',
      }, 'UNAUTHORIZED: No session user found');
    }

    throw new TRPCError({
      code: 'UNAUTHORIZED',
    });
  }

  if (authSpan) {
    completeRequestSpan(ctx.c, authSpan.id, {
      success: true,
      userId: ctx.sessionUser.id,
    });
  }

  return next({ ctx: { ...ctx, sessionUser: ctx.sessionUser } });
});

export const activeConnectionProcedure = privateProcedure.use(async ({ ctx, next }) => {
  const { addRequestSpan, completeRequestSpan } = await import('../lib/trace-context');

  // Start connection validation span
  const connectionSpan = addRequestSpan(ctx.c, 'trpc_connection_validation', {
    userId: ctx.sessionUser.id,
  }, {
    'trpc.connection_required': 'true'
  });

  try {
    const activeConnection = await getActiveConnection();

    if (connectionSpan) {
      completeRequestSpan(ctx.c, connectionSpan.id, {
        success: true,
        connectionId: activeConnection.id,
        connectionType: activeConnection.providerId,
      });
    }

    return next({ ctx: { ...ctx, activeConnection } });
  } catch (err) {
    if (connectionSpan) {
      completeRequestSpan(ctx.c, connectionSpan.id, {
        success: false,
        reason: 'connection_not_found',
      }, err instanceof Error ? err.message : 'Failed to get active connection');
    }

    await ctx.c.var.auth.api.signOut({ headers: ctx.c.req.raw.headers });
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: err instanceof Error ? err.message : 'Failed to get active connection',
    });
  }
});

const permissionErrors = ['precondition check', 'insufficient permission', 'invalid credentials'];

export const activeDriverProcedure = activeConnectionProcedure.use(async ({ ctx, next }) => {
  const { activeConnection, sessionUser } = ctx;
  const res = await next({ ctx: { ...ctx } });

  if (!res.ok) {
    const errorMessage = res.error.message.toLowerCase();

    const isPermissionError = permissionErrors.some((errorType) =>
      errorMessage.includes(errorType),
    );

    if (isPermissionError) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Required scopes missing',
        cause: res.error,
      });
    }

    // Handle token expiration/refresh issues
    if (errorMessage.includes('invalid_grant')) {
      // Remove the access token and refresh token
      const db = await getZeroDB(sessionUser.id);
      await db.updateConnection(activeConnection.id, {
        accessToken: null,
        refreshToken: null,
      });

      ctx.c.header(
        'X-Zero-Redirect',
        `/settings/connections?disconnectedConnectionId=${activeConnection.id}`,
      );

      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Connection expired. Please reconnect.',
        cause: res.error,
      });
    }
  }

  return res;
});

export const createRateLimiterMiddleware = (config: {
  limiter: RatelimitConfig['limiter'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generatePrefix: (ctx: TrpcContext, input: any) => string;
}) =>
  t.middleware(async ({ next, ctx, input }) => {
    const ratelimiter = new Ratelimit({
      redis: redis(),
      limiter: config.limiter,
      analytics: true,
      prefix: config.generatePrefix(ctx, input),
    });
    const finalIp = getConnInfo(ctx.c).remote.address ?? 'no-ip';
    const { success, limit, reset, remaining } = await ratelimiter.limit(finalIp);

    ctx.c.res.headers.append('X-RateLimit-Limit', limit.toString());
    ctx.c.res.headers.append('X-RateLimit-Remaining', remaining.toString());
    ctx.c.res.headers.append('X-RateLimit-Reset', reset.toString());

    if (!success) {
      console.log(`Rate limit exceeded for IP ${finalIp}.`);
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests. Please try again later.',
      });
    }

    return next();
  });
