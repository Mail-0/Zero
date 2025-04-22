import {
  checkRateLimit,
  getAuthenticatedUserId,
  getRatelimitModule,
  processIP,
  throwUnauthorizedGracefully,
} from '../../utils';
import { type NextRequest, NextResponse } from 'next/server';
import { getActiveDriver } from '@/actions/utils';
import { Ratelimit } from '@upstash/ratelimit';

export const GET = async (req: NextRequest) => {
  try {
    const userId = await getAuthenticatedUserId();
    const finalIp = processIP(req);
    const ratelimit = getRatelimitModule({
      prefix: `ratelimit:get-count-${userId}`,
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
    const count = await driver.count();
    return NextResponse.json(count, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.warn('Error getting count:', error);
    return throwUnauthorizedGracefully(req);
  }
};
