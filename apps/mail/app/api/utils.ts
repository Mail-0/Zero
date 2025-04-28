import { Ratelimit, Algorithm, RatelimitConfig } from '@upstash/ratelimit';
import { NextRequest, NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
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

export async function getAuthenticatedUserId(): Promise<string | null> {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  return session?.user.id ?? null;
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

// Helper function for delays
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Exponential backoff helper function
export const withExponentialBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000,
  maxDelay = 10000,
): Promise<T> => {
  let retries = 0;
  let delayMs = initialDelay;

  while (true) {
    try {
      return await operation();
    } catch (error: any) {
      if (retries >= maxRetries) {
        throw error;
      }

      // Check if error is rate limit related
      const isRateLimit =
        error?.code === 429 ||
        error?.errors?.[0]?.reason === 'rateLimitExceeded' ||
        error?.errors?.[0]?.reason === 'userRateLimitExceeded';

      if (!isRateLimit) {
        throw error;
      }

      console.log(
        `Rate limit hit, retrying in ${delayMs}ms (attempt ${retries + 1}/${maxRetries})`,
      );
      await delay(delayMs);

      // Exponential backoff with jitter
      delayMs = Math.min(delayMs * 2 + Math.random() * 1000, maxDelay);
      retries++;
    }
  }
};
