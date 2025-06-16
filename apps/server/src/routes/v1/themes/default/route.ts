export const runtime = 'nodejs';
import { getAuthenticatedUserId } from '../../../../lib/utils';
import { NextRequest, NextResponse } from 'next/server';
import { theme as themeTable } from '../../../../db/schema';
import { eq, and } from 'drizzle-orm';
import { createDb } from '../../../../db/index';

const connectionString = process.env.DATABASE_URL || '';
const db = createDb(connectionString);

interface SetDefaultThemeRequest {
  themeId: string;
}

// POST /api/v1/themes/default - Set default theme for user
export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as SetDefaultThemeRequest;
  const { themeId } = body;
  
  if (!themeId) {
    return NextResponse.json({ error: 'Missing themeId' }, { status: 400 });
  }

  const [theme] = await db
    .select()
    .from(themeTable)
    .where(and(
      eq(themeTable.id, themeId),
      eq(themeTable.userId, userId)
    ));

  if (!theme) {
    return NextResponse.json({ error: 'Theme not found or not owned by user' }, { status: 404 });
  }

  await db
    .update(themeTable)
    .set({ isDefault: false })
    .where(and(
      eq(themeTable.userId, userId),
      eq(themeTable.isDefault, true)
    ));

  await db
    .update(themeTable)
    .set({ isDefault: true })
    .where(and(
      eq(themeTable.id, themeId),
      eq(themeTable.userId, userId)
    ));

  return NextResponse.json({ success: true });
}