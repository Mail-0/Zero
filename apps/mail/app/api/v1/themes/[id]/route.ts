import { getAuthenticatedUserId } from '../../../utils';
import { NextRequest, NextResponse } from 'next/server';
import { theme as themeTable } from '@zero/db/schema';
import { eq, and } from 'drizzle-orm';
import { db } from '@zero/db';

// PATCH /api/v1/themes/[id] - Update a theme
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
  // Only allow updating fields that are present in the body
  const allowedFields = [
    'name',
    'colors',
    'fonts',
    'spacing',
    'shadows',
    'radius',
    'backgrounds',
    'isPublic',
  ];
  const updateData: Record<string, any> = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) updateData[key] = body[key];
  }
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }
  updateData.updatedAt = new Date();
  const result = await db
    .update(themeTable)
    .set(updateData)
    .where(and(eq(themeTable.id, id), eq(themeTable.userId, userId)))
    .returning();
  if (!result.length) {
    return NextResponse.json({ error: 'Theme not found or not owned by user' }, { status: 404 });
  }
  return NextResponse.json(result[0]);
}

// DELETE /api/v1/themes/[id] - Delete a theme
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = params;
  const result = await db
    .delete(themeTable)
    .where(and(eq(themeTable.id, id), eq(themeTable.userId, userId)))
    .returning();
  if (!result.length) {
    return NextResponse.json({ error: 'Theme not found or not owned by user' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
