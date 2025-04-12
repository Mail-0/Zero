import { type NextRequest, NextResponse } from 'next/server';
import { getMail } from '@/actions/mail';
import { Ratelimit } from '@upstash/ratelimit';
import { checkRateLimit, getRatelimitModule, processIP } from '../../utils';


export const GET = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const finalIp = processIP(req)
  const ratelimit = getRatelimitModule({
    prefix: `ratelimit:get-mail`,
    limiter: Ratelimit.slidingWindow(60, '1m'),
  })
  const { success, headers } = await checkRateLimit(ratelimit, finalIp);
  if (!success) {
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
