import { type NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { defaultPageSize } from '@/lib/utils';
import { getMails } from '@/actions/mail';
import { checkRateLimit, getRatelimitModule, processIP } from '../utils';

export const GET = async (req: NextRequest) => {
  const finalIp = processIP(req)
  const ratelimit = getRatelimitModule({
    prefix: `ratelimit:list-threads`,
    limiter: Ratelimit.slidingWindow(60, '1m'),
  })
  const { success, headers } = await checkRateLimit(ratelimit, finalIp);
  if (!success) {
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
