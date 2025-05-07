import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { theme } from '@zero/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { getSessionUserId } from '@/lib/auth-server';

// GET /api/themes - List all themes for the current user
export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const themes = await db.select().from(theme).where(theme.userId.eq(userId));
  return NextResponse.json(themes);
}

// POST /api/themes - Create a new theme
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { name, description, config, isPublic } = body;
  if (!name || !config) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  const newTheme = {
    id: uuidv4(),
    userId,
    name,
    description: description || '',
    config,
    isPublic: !!isPublic,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await db.insert(theme).values(newTheme);
  return NextResponse.json(newTheme, { status: 201 });
}
