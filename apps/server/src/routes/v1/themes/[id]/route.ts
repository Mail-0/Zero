export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { theme as themeTable } from '../../../../db/schema';
import { getAuthenticatedUserId } from '../../../../lib/utils';
import { eq, and, or } from 'drizzle-orm';
import { createDb } from '../../../../db/index';

const connectionString = process.env.DATABASE_URL || '';
const db = createDb(connectionString);

// Define the type for theme update data
interface ThemeUpdateData {
  name?: string;
  colors?: {
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
  fonts?: {
    body: string;
    heading: string;
    mono: string;
  };
  spacing?: {
    base: string;
    section: string;
    card: string;
    button: string;
  };
  shadows?: {
    base: string;
    card: string;
    button: string;
  };
  radius?: {
    base: string;
    button: string;
    card: string;
    input: string;
  };
  backgrounds?: Record<string, string>;
  isPublic?: boolean;
  isDefault?: boolean;
}

// GET /api/v1/themes/[id] - Get theme details
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getAuthenticatedUserId(req);
  const { id } = params;

  const [theme] = await db
    .select()
    .from(themeTable)
    .where(
      or(
        eq(themeTable.id, id),
        and(
          eq(themeTable.isPublic, true),
          eq(themeTable.id, id)
        )
      )
    );

  if (!theme) {
    return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
  }

  if (!theme.isPublic && theme.userId !== userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  return NextResponse.json(theme);
}

// PATCH /api/v1/themes/[id] - Update theme
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  
    const { id } = params;
    const body = await req.json() as ThemeUpdateData;
  
    // Create a type-safe update data object
    const updateData: {
      updatedAt: Date;
      name?: string;
      colors?: ThemeUpdateData['colors'];
      fonts?: ThemeUpdateData['fonts'];
      spacing?: ThemeUpdateData['spacing'];
      shadows?: ThemeUpdateData['shadows'];
      radius?: ThemeUpdateData['radius'];
      backgrounds?: ThemeUpdateData['backgrounds'];
      isPublic?: boolean;
      isDefault?: boolean;
    } = { updatedAt: new Date() };
  
    // Manually check and assign each field
    if (body.name !== undefined) updateData.name = body.name;
    if (body.colors !== undefined) updateData.colors = body.colors;
    if (body.fonts !== undefined) updateData.fonts = body.fonts;
    if (body.spacing !== undefined) updateData.spacing = body.spacing;
    if (body.shadows !== undefined) updateData.shadows = body.shadows;
    if (body.radius !== undefined) updateData.radius = body.radius;
    if (body.backgrounds !== undefined) updateData.backgrounds = body.backgrounds;
    if (body.isPublic !== undefined) updateData.isPublic = body.isPublic;
    if (body.isDefault !== undefined) updateData.isDefault = body.isDefault;
  
    if (Object.keys(updateData).length === 1) { // Only updatedAt was set
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }
  
    if (updateData.isDefault) {
      await db
        .update(themeTable)
        .set({ isDefault: false })
        .where(and(
          eq(themeTable.userId, userId),
          eq(themeTable.isDefault, true)
        ));
    }
  
    const [updatedTheme] = await db
      .update(themeTable)
      .set(updateData)
      .where(and(
        eq(themeTable.id, id),
        eq(themeTable.userId, userId)
      ))
      .returning();
  
    if (!updatedTheme) {
      return NextResponse.json({ error: 'Theme not found or not owned by user' }, { status: 404 });
    }
  
    return NextResponse.json(updatedTheme);
  }

// DELETE /api/v1/themes/[id] - Delete theme
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  const [deletedTheme] = await db
    .delete(themeTable)
    .where(and(
      eq(themeTable.id, id),
      eq(themeTable.userId, userId)
    ))
    .returning();

  if (!deletedTheme) {
    return NextResponse.json({ error: 'Theme not found or not owned by user' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}