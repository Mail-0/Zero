import { NextRequest, NextResponse } from 'next/server';
import { theme as themeTable } from '@zero/db/schema';
import { getAuthenticatedUserId } from '../../utils';
import { eq } from 'drizzle-orm';
import { db } from '@zero/db';

// GET /api/v1/themes?public=1 - List public themes
// (already has GET for user themes)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isPublic = searchParams.get('public');
  if (isPublic) {
    // List all public themes
    const publicThemes = await db.select().from(themeTable).where(eq(themeTable.isPublic, true));
    return NextResponse.json(publicThemes);
  }
  // Default: list user themes
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const themes = await db.select().from(themeTable).where(eq(themeTable.userId, userId));
  return NextResponse.json(themes);
}

// POST /api/v1/themes/copy - Copy a public theme to the current user
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isCopy = searchParams.get('copy');
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (isCopy) {
    // Copy a public theme
    const body = await req.json();
    const { themeId } = body;
    if (!themeId) {
      return NextResponse.json({ error: 'Missing themeId' }, { status: 400 });
    }
    const [themeToCopy] = await db.select().from(themeTable).where(eq(themeTable.id, themeId));
    if (!themeToCopy || !themeToCopy.isPublic) {
      return NextResponse.json({ error: 'Theme not found or not public' }, { status: 404 });
    }
    const newTheme = {
      ...themeToCopy,
      id: crypto.randomUUID(),
      userId,
      name: `${themeToCopy.name} (Copy)`,
      isPublic: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.insert(themeTable).values(newTheme);
    return NextResponse.json(newTheme, { status: 201 });
  }
  // Default: create new theme (already implemented)
  // ... existing POST code ...
  const body = await req.json();
  const { name, colors, fonts, spacing, shadows, radius, backgrounds, isPublic } = body;
  if (!name || !colors || !fonts || !spacing || !shadows || !radius || !backgrounds) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  const newTheme = {
    id: crypto.randomUUID(),
    userId,
    name,
    colors,
    fonts,
    spacing,
    shadows,
    radius,
    backgrounds,
    isPublic: !!isPublic,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await db.insert(themeTable).values(newTheme);
  return NextResponse.json(newTheme, { status: 201 });
}

// Additional endpoints (e.g., for public themes, copying) will be added as needed.
