import { type NextRequest, NextResponse } from 'next/server';
import { getMail, getMails } from '@/actions/mail';
import { getActiveDriver } from '@/actions/utils';
import { Ratelimit } from '@upstash/ratelimit';
import { defaultPageSize } from '@/lib/utils';
import { redis } from '@/lib/redis';

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1m'),
  analytics: true,
  prefix: 'ratelimit:get-thread',
});

export const GET = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const cfIP = req.headers.get('CF-Connecting-IP');
  const ip = req.headers.get('x-forwarded-for');
  if (!ip && !cfIP && process.env.NODE_ENV === 'production') {
    console.log('No IP detected');
    return NextResponse.json({ error: 'No IP detected' }, { status: 400 });
  }
  const finalIp: string = cfIP ?? ip!;
  const { success, limit, reset, remaining } = await ratelimit.limit(finalIp);
  const headers = {
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': reset.toString(),
  };
  if (!success) {
    console.log(`Rate limit exceeded for IP ${finalIp}. Remaining: ${remaining}`);
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers },
    );
  }
  const { id } = await params;

  const threadResponse = await getMail({
    id,
  });
  return NextResponse.json(threadResponse, {
    status: 200,
    headers,
  });
};
