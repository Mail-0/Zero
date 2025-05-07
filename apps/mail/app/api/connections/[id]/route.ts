import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { connection } from '@zero/db/schema';
import { eq } from 'drizzle-orm';
import { getSessionUserId } from '@/lib/auth-server';

// PATCH /api/connections/[id] - Update a connection (themeId, etc)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = params;
  const body = await req.json();
  const { themeId } = body;
  if (!themeId) return NextResponse.json({ error: 'Missing themeId' }, { status: 400 });
  const [updated] = await db
    .update(connection)
    .set({ themeId, updatedAt: new Date() })
    .where(eq(connection.id, id), eq(connection.userId, userId))
    .returning();
  if (!updated) return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 });
  return NextResponse.json(updated);
}
