import { checkRateLimit, getRatelimitModule, processIP } from '../../utils';
import { type NextRequest, NextResponse } from 'next/server';
import { getActiveDriver } from '@/actions/utils';
import { Ratelimit } from '@upstash/ratelimit';

export const GET = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const finalIp = processIP(req);
  const { id } = await params;
  const ratelimit = getRatelimitModule({
    prefix: `ratelimit:get-mail-${id}`,
    limiter: Ratelimit.slidingWindow(60, '1m'),
  });
  const { success, headers } = await checkRateLimit(ratelimit, finalIp);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers },
    );
  }

  const driver = await getActiveDriver();
  const threadResponse = await driver.get(id);
  return NextResponse.json(threadResponse, {
    status: 200,
    headers,
  });
};
