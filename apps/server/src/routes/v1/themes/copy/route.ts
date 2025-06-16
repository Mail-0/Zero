export const runtime = 'nodejs';
import { getAuthenticatedUserId } from '../../../../lib/utils';
import { NextRequest, NextResponse } from 'next/server';
import { theme as themeTable } from '../../../../db/schema';
import { eq, and } from 'drizzle-orm';
import { createDb } from '../../../../db/index';

const connectionString = process.env.DATABASE_URL || '';
const db = createDb(connectionString);

interface CopyThemeRequest {
  themeId: string;
  newName?: string;
}

interface Theme {
  id: string;
  userId: string;
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
  isPublic: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// POST /api/v1/themes/copy - Copy a public theme
export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as CopyThemeRequest;
  const { themeId, newName } = body;
  
  if (!themeId) {
    return NextResponse.json({ error: 'Missing themeId' }, { status: 400 });
  }

  const [themeToCopy] = await db
    .select()
    .from(themeTable)
    .where(and(
      eq(themeTable.id, themeId),
      eq(themeTable.isPublic, true)
    )) as [Theme | undefined];

  if (!themeToCopy) {
    return NextResponse.json({ error: 'Public theme not found' }, { status: 404 });
  }

  const newTheme: Theme = {
    id: crypto.randomUUID(),
    userId,
    name: newName || `${themeToCopy.name} (Copy)`,
    colors: themeToCopy.colors,
    fonts: themeToCopy.fonts,
    spacing: themeToCopy.spacing,
    shadows: themeToCopy.shadows,
    radius: themeToCopy.radius,
    backgrounds: themeToCopy.backgrounds,
    isPublic: false,
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(themeTable).values(newTheme);
  return NextResponse.json(newTheme, { status: 201 });
}