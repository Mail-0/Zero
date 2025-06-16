export const runtime = 'nodejs';
import { getAuthenticatedUserId } from '../../../../lib/utils';
import { NextRequest, NextResponse } from 'next/server';
import { 
  userFavoriteThemes as userFavoriteThemesTable,
  theme as themeTable
} from '../../../../db/schema';
import { eq, and, or } from 'drizzle-orm';
import { createDb } from '../../../../db/index';

const connectionString = process.env.DATABASE_URL || '';
const db = createDb(connectionString);

interface FavoriteThemeRequest {
  themeId: string;
}

// POST /api/v1/themes/favorites - Add theme to favorites
export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as FavoriteThemeRequest;
  const { themeId } = body;
  
  if (!themeId) {
    return NextResponse.json({ error: 'Missing themeId' }, { status: 400 });
  }

  const [theme] = await db
    .select()
    .from(themeTable)
    .where(and(
      eq(themeTable.id, themeId),
      or(
        eq(themeTable.isPublic, true),
        eq(themeTable.userId, userId)
      )
    ));

  if (!theme) {
    return NextResponse.json({ error: 'Theme not found or not accessible' }, { status: 404 });
  }

  try {
    await db
      .insert(userFavoriteThemesTable)
      .values({
        userId,
        themeId,
        createdAt: new Date()
      });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Theme already in favorites' }, { status: 409 });
  }
}

// DELETE /api/v1/themes