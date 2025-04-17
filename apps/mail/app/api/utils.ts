import { Ratelimit, Algorithm, RatelimitConfig } from '@upstash/ratelimit';
import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { redis } from '@/lib/redis';
import { auth } from '@/lib/auth';

export const getRatelimitModule = (config: {
  limiter: RatelimitConfig['limiter'];
  prefix: RatelimitConfig['prefix'];
}) => {
  const ratelimit = new Ratelimit({
    redis,
    limiter: config.limiter,
    analytics: true,
    prefix: config.prefix,
  });

  return ratelimit;
};

export const throwUnauthorizedGracefully = async () => {
  console.log('Unauthorized, redirecting to login');
  const headersList = await headers();
  await auth.api.signOut({ headers: headersList });
  redirect('/login?error=unauthorized');
};

export async function getAuthenticatedUserId(): Promise<string> {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user?.id) {
    return throwUnauthorizedGracefully();
  }

  return session.user.id;
}

export const checkRateLimit = async (ratelimit: Ratelimit, finalIp: string) => {
  const { success, limit, reset, remaining } = await ratelimit.limit(finalIp);
  const headers = {
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': reset.toString(),
  };
  if (!success) console.log(`Rate limit exceeded for IP ${finalIp}.`);
  return { success, headers };
};

export const processIP = (req: NextRequest) => {
  const cfIP = req.headers.get('CF-Connecting-IP');
  const ip = req.headers.get('x-forwarded-for');
  if (!ip && !cfIP && process.env.NODE_ENV === 'production') {
    console.log('No IP detected');
    throw new Error('No IP detected');
  }
  const cleanIp = ip?.split(',')[0]?.trim() ?? null;
  return cfIP ?? cleanIp ?? '127.0.0.1';
};
