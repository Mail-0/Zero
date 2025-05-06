import { processIP, getRatelimitModule, checkRateLimit, getAuthenticatedUserId } from '../../utils';
import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { connection } from '@zero/db/schema';
import { eq, and } from 'drizzle-orm';
import { IConnection } from '@/types';
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

    if (!userId) return NextResponse.json([], { status: 401 });
    const connections = (await db
      .select({
        id: connection.id,
        email: connection.email,
        name: connection.name,
        picture: connection.picture,
        createdAt: connection.createdAt,
        themeId: connection.themeId,
      })
      .from(connection)
      .where(eq(connection.userId, userId))) as IConnection[];

    return NextResponse.json(connections, {
      status: 200,
      headers,
    });
  } catch (error) {
    return NextResponse.json([], {
      status: 400,
    });
  }
};

export const PATCH = async (req: NextRequest) => {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const connectionId = searchParams.get('connectionId');
  if (!connectionId) return NextResponse.json({ error: 'Missing connectionId' }, { status: 400 });
  const body = await req.json();
  const { themeId } = body;
  if (!themeId) return NextResponse.json({ error: 'Missing themeId' }, { status: 400 });
  const result = await db
    .update(connection)
    .set({ themeId })
    .where(and(eq(connection.id, connectionId), eq(connection.userId, userId)))
    .returning();
  if (!result.length) {
    return NextResponse.json(
      { error: 'Connection not found or not owned by user' },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true });
};
