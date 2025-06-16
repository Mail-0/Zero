// src/db/routes/themes/route.ts
export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { 
  theme as themeTable, 
  connection as connectionTable,
  userFavoriteThemes as userFavoriteThemesTable
} from '../../../db/schema';
import { eq, and, or } from 'drizzle-orm';
import { createDb } from '../../../db/index';
import { getAuthenticatedUserId } from '../../../lib/utils';

// Initialize db connection
const connectionString = process.env.DATABASE_URL || '';
const db = createDb(connectionString);

// Define type for theme creation/update that matches your schema
type ThemeData = {
  name: string;
  colors: {
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    border: string;
    input: string;
    ring: string;
    success?: string;
    warning?: string;
    error?: string;
  };
  fonts: {
    body: string;
    heading: string;
    mono: string;
  };
  spacing: {
    base: string;
    section: string;
    card: string;
    button: string;
  };
  shadows: {
    base: string;
    card: string;
    button: string;
  };
  radius: {
    base: string;
    button: string;
    card: string;
    input: string;
  };
  backgrounds: Record<string, string>;
  isPublic?: boolean;
  isDefault?: boolean;
};

// GET /api/v1/themes - List themes (user's, public, or favorites)
export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  const { searchParams } = new URL(req.url);
  const isPublic = searchParams.get('public') === 'true';
  const isFavorites = searchParams.get('favorites') === 'true';
  
  if (isPublic) {
    const publicThemes = await db
      .select()
      .from(themeTable)
      .where(eq(themeTable.isPublic, true));
    return NextResponse.json(publicThemes);
  }

  if (isFavorites) {
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const favoriteThemes = await db
      .select()
      .from(userFavoriteThemesTable)
      .innerJoin(
        themeTable,
        eq(userFavoriteThemesTable.themeId, themeTable.id)
      )
      .where(eq(userFavoriteThemesTable.userId, userId));
    return NextResponse.json(favoriteThemes.map((ft: { theme: any }) => ft.theme));
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userThemes = await db
    .select()
    .from(themeTable)
    .where(eq(themeTable.userId, userId));
  
  return NextResponse.json(userThemes);
}

// POST /api/v1/themes - Create new theme
export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as ThemeData;
  const { 
    name, 
    colors, 
    fonts, 
    spacing, 
    shadows, 
    radius, 
    backgrounds, 
    isPublic = false,
    isDefault = false 
  } = body;

  if (!name || !colors || !fonts || !spacing || !shadows || !radius || !backgrounds) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (isDefault) {
    await db
      .update(themeTable)
      .set({ isDefault: false })
      .where(and(
        eq(themeTable.userId, userId),
        eq(themeTable.isDefault, true)
      ));
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
    isPublic,
    isDefault,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(themeTable).values(newTheme);
  return NextResponse.json(newTheme, { status: 201 });
}