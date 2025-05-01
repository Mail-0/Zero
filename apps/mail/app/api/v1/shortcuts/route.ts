import { getAuthenticatedUserId, processIP, getRatelimitModule, checkRateLimit } from '../../utils';
import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { db } from '@zero/db';

export const GET = async (req: NextRequest) => {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const finalIp = processIP(req);
  const ratelimit = getRatelimitModule({
    prefix: `ratelimit:get-shortcuts-${userId}`,
    limiter: Ratelimit.slidingWindow(60, '1m'),
  });
  const { success, headers } = await checkRateLimit(ratelimit, finalIp);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers },
    );
  }
  try {
    const result = await db.query.userHotkeys.findFirst({
      where: (hotkeys, { eq }) => eq(hotkeys.userId, userId),
    });
    return NextResponse.json(result?.shortcuts || []);
  } catch (error) {
    console.error('Error fetching shortcuts:', error);
    return NextResponse.json([], { status: 400 });
  }
};
