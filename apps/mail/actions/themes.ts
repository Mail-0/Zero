'use server';

import { db } from '@zero/db';
import { theme } from '@zero/db/schema';
import { eq, and } from 'drizzle-orm';
import { defaultThemeSettings, darkThemeSettings } from '@zero/db/theme_settings_default';
import { ThemeSettings } from '@zero/db/schema';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

export async function createTheme({
  name,
  connectionId,
  settings,
  isPublic = false,
}: {
  name: string;
  connectionId?: string;
  settings: ThemeSettings;
  isPublic?: boolean;
}) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const newTheme = await db.insert(theme).values({
      name,
      userId: session.user.id,
      connectionId: connectionId || null,
      settings,
      isPublic,
    }).returning();

    revalidatePath('/');

    return { success: true, theme: newTheme[0] };
  } catch (error) {
    console.error('Error creating theme:', error);
    return { success: false, error: 'Failed to create theme' };
  }
}

export async function updateTheme({
  id,
  name,
  connectionId,
  settings,
  isPublic,
}: {
  id: string;
  name?: string;
  connectionId?: string | null;
  settings?: ThemeSettings;
  isPublic?: boolean;
}) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const themeData = await db.query.theme.findFirst({
      where: and(
        eq(theme.id, id),
        eq(theme.userId, session.user.id)
      ),
    });

    if (!themeData) {
      return { success: false, error: 'Theme not found or not authorized' };
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (connectionId !== undefined) updateData.connectionId = connectionId;
    if (settings !== undefined) updateData.settings = settings;
    if (isPublic !== undefined) updateData.isPublic = isPublic;

    const updatedTheme = await db
      .update(theme)
      .set(updateData)
      .where(and(
        eq(theme.id, id),
        eq(theme.userId, session.user.id)
      ))
      .returning();

    revalidatePath('/');

    return { success: true, theme: updatedTheme[0] };
  } catch (error) {
    console.error('Error updating theme:', error);
    return { success: false, error: 'Failed to update theme' };
  }
}

export async function deleteTheme(id: string) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const deleted = await db
      .delete(theme)
      .where(and(
        eq(theme.id, id),
        eq(theme.userId, session.user.id)
      ))
      .returning();

    if (!deleted || deleted.length === 0) {
      return { success: false, error: 'Theme not found or not authorized' };
    }

    revalidatePath('/');

    return { success: true };
  } catch (error) {
    console.error('Error deleting theme:', error);
    return { success: false, error: 'Failed to delete theme' };
  }
}

export async function getUserThemes() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const themes = await db.query.theme.findMany({
      where: eq(theme.userId, session.user.id),
      orderBy: (theme, { desc }) => [desc(theme.updatedAt)],
    });

    return { success: true, themes };
  } catch (error) {
    console.error('Error fetching themes:', error);
    return { success: false, error: 'Failed to fetch themes' };
  }
}

export async function getPublicThemes() {
  try {
    const themes = await db.query.theme.findMany({
      where: eq(theme.isPublic, true),
      orderBy: (theme, { desc }) => [desc(theme.updatedAt)],
    });

    return { success: true, themes };
  } catch (error) {
    console.error('Error fetching public themes:', error);
    return { success: false, error: 'Failed to fetch public themes' };
  }
}

export async function getThemeById(id: string) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const themeData = await db.query.theme.findFirst({
      where: and(
        eq(theme.id, id),
        eq(theme.userId, session.user.id)
      ),
    });

    if (!themeData) {
      return { success: false, error: 'Theme not found or not authorized' };
    }

    return { success: true, theme: themeData };
  } catch (error) {
    console.error('Error fetching theme:', error);
    return { success: false, error: 'Failed to fetch theme' };
  }
}

export async function getConnectionTheme(connectionId: string) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const themeData = await db.query.theme.findFirst({
      where: and(
        eq(theme.connectionId, connectionId),
        eq(theme.userId, session.user.id)
      ),
    });

    if (!themeData) {
      return { success: false, error: 'No theme found for this connection' };
    }

    return { success: true, theme: themeData };
  } catch (error) {
    console.error('Error fetching connection theme:', error);
    return { success: false, error: 'Failed to fetch connection theme' };
  }
}

export async function copyPublicTheme(id: string) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const themeData = await db.query.theme.findFirst({
      where: and(
        eq(theme.id, id),
        eq(theme.isPublic, true)
      ),
    });

    if (!themeData) {
      return { success: false, error: 'Public theme not found' };
    }

    const newTheme = await db.insert(theme).values({
      name: `Copy of ${themeData.name}`,
      userId: session.user.id,
      settings: themeData.settings,
      isPublic: false,
    }).returning();

    revalidatePath('/');

    return { success: true, theme: newTheme[0] };
  } catch (error) {
    console.error('Error copying theme:', error);
    return { success: false, error: 'Failed to copy theme' };
  }
}

export async function createDefaultThemes() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Check if user already has themes
    const existingThemes = await db.query.theme.findMany({
      where: eq(theme.userId, session.user.id),
      limit: 1,
    });

    if (existingThemes.length > 0) {
      return { success: true, message: 'User already has themes' };
    }

    // Create default light theme
    await db.insert(theme).values({
      name: 'Light Theme',
      userId: session.user.id,
      settings: defaultThemeSettings,
      isPublic: false,
    });

    // Create default dark theme
    await db.insert(theme).values({
      name: 'Dark Theme',
      userId: session.user.id,
      settings: darkThemeSettings,
      isPublic: false,
    });


    return { success: true, message: 'Default themes created' };
  } catch (error) {
    console.error('Error creating default themes:', error);
    return { success: false, error: 'Failed to create default themes' };
  }
} 