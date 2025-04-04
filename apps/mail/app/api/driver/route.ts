import { type NextRequest, NextResponse } from 'next/server';
import { getActiveDriver } from '@/actions/utils';
import { Ratelimit } from '@upstash/ratelimit';
import { defaultPageSize } from '@/lib/utils';
import { getMails } from '@/actions/mail';
import { redis } from '@/lib/redis';

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1m'),
  analytics: true,
  prefix: 'ratelimit:list-threads',
});

export const GET = async (req: NextRequest) => {
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
  const searchParams = req.nextUrl.searchParams;
  let [folder, pageToken, q, max] = [
    searchParams.get('folder'),
    searchParams.get('pageToken'),
    searchParams.get('q'),
    Number(searchParams.get('max')),
  ];
  if (!folder) folder = 'inbox';
  if (!pageToken) pageToken = '';
  if (!q) q = '';
  if (!max) max = defaultPageSize;
  const threadsResponse = await getMails({
    folder,
    q,
    max,
    pageToken,
    labelIds: undefined,
  });
  return NextResponse.json(threadsResponse, {
    status: 200,
    headers,
  });
};
