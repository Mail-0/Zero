import { processIP, getRatelimitModule, checkRateLimit } from '@/app/api/utils';
import { NextRequest, NextResponse } from 'next/server';
import { getActiveDriver } from '@/actions/utils';
import { Ratelimit } from '@upstash/ratelimit';

export const GET = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const finalIp = processIP(req);
    const { id } = await params;
    const ratelimit = getRatelimitModule({
      prefix: `ratelimit:get-draft-${id}`,
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
    const draftResponse = await driver.getDraft(id);
    return NextResponse.json(draftResponse, {
      status: 200,
      headers,
    });
  } catch (error) {
    return NextResponse.json({}, { status: 400 });
  }
};
