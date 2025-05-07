import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { theme } from '@zero/db/schema';
import { eq } from 'drizzle-orm';
import { getSessionUserId } from '@/lib/auth-server';
import { v4 as uuidv4 } from 'uuid';

// GET /api/themes/[id] - Get a single theme
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const found = await db.select().from(theme).where(eq(theme.id, id));
  if (!found.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(found[0]);
}

// PATCH /api/themes/[id] - Update a theme
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = params;
  const body = await req.json();
  const { name, description, config, isPublic } = body;
  const [updated] = await db
    .update(theme)
    .set({
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(config && { config }),
      ...(isPublic !== undefined && { isPublic }),
      updatedAt: new Date(),
    })
    .where(eq(theme.id, id), eq(theme.userId, userId))
    .returning();
  if (!updated) return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 });
  return NextResponse.json(updated);
}

// DELETE /api/themes/[id] - Delete a theme
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = params;
  const [deleted] = await db.delete(theme).where(eq(theme.id, id), eq(theme.userId, userId)).returning();
  if (!deleted) return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 });
  return NextResponse.json({ success: true });
}

// POST /api/themes/[id]/copy - Copy a public theme to the current user
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = params;
  const found = await db.select().from(theme).where(eq(theme.id, id), eq(theme.isPublic, true));
  if (!found.length) return NextResponse.json({ error: 'Not found or not public' }, { status: 404 });
  const orig = found[0];
  const newTheme = {
    ...orig,
    id: uuidv4(),
    userId,
    name: orig.name + ' (Copy)',
    isPublic: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await db.insert(theme).values(newTheme);
  return NextResponse.json(newTheme, { status: 201 });
}
