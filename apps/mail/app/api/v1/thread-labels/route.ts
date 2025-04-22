import { processIP, getRatelimitModule, checkRateLimit, getAuthenticatedUserId } from '../../utils';
import { NextRequest, NextResponse } from 'next/server';
import { getActiveDriver } from '@/actions/utils';
import { Ratelimit } from '@upstash/ratelimit';
import { Label } from '@/hooks/use-labels';

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  const finalIp = processIP(req);
  const ratelimit = getRatelimitModule({
    prefix: `ratelimit:get-thread-labels-${userId}`,
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
    const { searchParams } = new URL(req.url);
    const ids = searchParams.get('ids');

    if (!ids) {
      return NextResponse.json({ error: 'Thread IDs are required' }, { status: 400 });
    }

    const threadIds = ids.split(',');
    const driver = await getActiveDriver();

    const labels = await Promise.all(threadIds.map(async (id) => await driver.getLabel(id)));

    const userLabels: Label[] = labels
      .filter((label): label is Label => {
        return label && typeof label === 'object' && label.type === 'user';
      })
      .map((label) => ({
        id: label.id,
        name: label.name,
        type: label.type,
        color: label.color,
      }));

    return NextResponse.json(userLabels);
  } catch (error) {
    console.error('Error fetching thread labels:', error);
    return NextResponse.json({ error: 'Failed to fetch thread labels' }, { status: 500 });
  }
}
