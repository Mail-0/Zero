import {
  processIP,
  getRatelimitModule,
  checkRateLimit,
  getAuthenticatedUserId,
  throwUnauthorizedGracefully,
} from '../../utils';
import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { connection } from '@zero/db/schema';
import { IConnection } from '@/types';
import { eq } from 'drizzle-orm';
import { db } from '@zero/db';

export const GET = async (req: NextRequest) => {
  try {
    const userId = await getAuthenticatedUserId();
    const finalIp = processIP(req);
    const ratelimit = getRatelimitModule({
      prefix: `ratelimit:get-connections-${userId}`,
      limiter: Ratelimit.slidingWindow(60, '1m'),
    });
    const { success, headers } = await checkRateLimit(ratelimit, finalIp);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers },
      );
    }

    const connections = (await db
      .select({
        id: connection.id,
        email: connection.email,
        name: connection.name,
        picture: connection.picture,
        createdAt: connection.createdAt,
      })
      .from(connection)
      .where(eq(connection.userId, userId))) as IConnection[];

    return NextResponse.json(connections, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.warn('Error getting connections:', error);
    await throwUnauthorizedGracefully();
    return NextResponse.json([]);
  }
};
