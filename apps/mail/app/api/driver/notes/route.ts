import {
  processIP,
  getRatelimitModule,
  checkRateLimit,
  getAuthenticatedUserId,
  throwUnauthorizedGracefully,
} from '../../utils';
import { NextRequest, NextResponse } from 'next/server';
import { fetchThreadNotes } from '@/actions/notes';
import { Ratelimit } from '@upstash/ratelimit';
import { notesManager } from '../../notes/db';

export const GET = async (req: NextRequest) => {
  try {
    const userId = await getAuthenticatedUserId();
    const finalIp = processIP(req);
    const ratelimit = getRatelimitModule({
      prefix: `ratelimit:get-thread-notes-${userId}`,
      limiter: Ratelimit.slidingWindow(60, '1m'),
    });
    const { success, headers } = await checkRateLimit(ratelimit, finalIp);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers },
      );
    }
    const searchParams = req.nextUrl.searchParams;

    if (!searchParams.get('threadId')) {
      return NextResponse.json({ error: 'Missing threadId' }, { status: 400 });
    }

    const notes = await notesManager.getThreadNotes(userId, searchParams.get('threadId')!);

    return NextResponse.json(notes, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.warn('Error getting thread notes:', error);
  } finally {
    throwUnauthorizedGracefully(req);
  }
};
