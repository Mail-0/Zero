'use server';

import { 
  db, 
  theme, 
  ThemeSettings,
  defaultThemeSettings, 
  darkThemeSettings,
  sunsetHorizonThemeSettings, 
  sunsetHorizonDarkThemeSettings,
  cyberpunkThemeSettings,
  cyberpunkDarkThemeSettings
} from '@zero/db';
import { eq, and } from 'drizzle-orm';
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
      return { success: true, message: 'User already has themes, no defaults created' };
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

    revalidatePath('/');
    revalidatePath('/settings/themes');

    return { success: true, message: 'Default light and dark themes created' };
  } catch (error) {
    console.error('Error creating default themes:', error);
    return { success: false, error: 'Failed to create default themes' };
  }
}

/**
 * Apply a theme to the current active connection
 */
export async function applyThemeToConnection(themeId: string, targetConnectionId?: string) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  
  const effectiveConnectionId = targetConnectionId || session?.connectionId;

  console.log('Session in applyThemeToConnection:', JSON.stringify({
    userId: session?.user?.id,
    originalSessionConnectionId: session?.connectionId,
    targetConnectionIdProvided: !!targetConnectionId,
    effectiveConnectionId: effectiveConnectionId,
    hasSessionData: !!session
  }));

  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' };
  }
  
  if (!effectiveConnectionId) {
    return { success: false, error: 'No active or target connection specified' };
  }

  try {
    // First find the theme and verify ownership
    const themeData = await db.query.theme.findFirst({
      where: and(
        eq(theme.id, themeId),
        eq(theme.userId, session.user.id)
      ),
    });

    if (!themeData) {
      return { success: false, error: 'Theme not found or not authorized' };
    }
    
    // Check if there's already a theme assigned to this connection
    const existingConnectionTheme = await db.query.theme.findFirst({
      where: and(
        eq(theme.connectionId, effectiveConnectionId),
        eq(theme.userId, session.user.id)
      ),
    });
    
    if (existingConnectionTheme) {
      // Update existing connection theme assignment
      if (existingConnectionTheme.id === themeId) {
        // Already assigned
        return { success: true, message: 'Theme already applied to this connection' };
      }
      
      console.log('Removing connection from existing theme:', existingConnectionTheme.id);
      
      // Remove connection from the existing theme
      await db
        .update(theme)
        .set({ connectionId: null })
        .where(eq(theme.id, existingConnectionTheme.id));
    }
    
    console.log('Assigning theme to connection:', { themeId, connectionId: effectiveConnectionId });
    
    // Assign the selected theme to the connection
    await db
      .update(theme)
      .set({ connectionId: effectiveConnectionId })
      .where(eq(theme.id, themeId));
    
    console.log('Revalidating paths after applying theme');
    revalidatePath('/');
    revalidatePath('/settings/themes');
    
    return { 
      success: true, 
      message: 'Theme applied successfully', 
      theme: themeData,
      connectionId: effectiveConnectionId,
      sessionInfo: {
        userId: session.user.id,
        hasConnectionId: !!session.connectionId,
        activeConnection: session.activeConnection ? {
          id: session.activeConnection.id,
          email: session.activeConnection.email
        } : null
      }
    };
  } catch (error) {
    console.error('Error applying theme to connection:', error);
    return { success: false, error: 'Failed to apply theme to connection' };
  }
}

export async function createPresetThemes() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const userId = session.user.id;
    const createdMessages: string[] = [];

    // Helper to check and create a preset theme
    const checkAndCreate = async (themeName: string, themeSettings: ThemeSettings) => {
      const existing = await db.query.theme.findFirst({
        where: and(eq(theme.userId, userId), eq(theme.name, themeName)),
      });
      if (!existing) {
        await db.insert(theme).values({
          name: themeName,
          userId,
          settings: themeSettings,
          isPublic: false,
        });
        return `${themeName} created`;
      }
      return null;
    };

    // Sunset Horizon Themes
    let msg = await checkAndCreate('Sunset Horizon', sunsetHorizonThemeSettings);
    if (msg) createdMessages.push(msg);
    msg = await checkAndCreate('Sunset Horizon Dark', sunsetHorizonDarkThemeSettings);
    if (msg) createdMessages.push(msg);

    // Cyberpunk Themes
    msg = await checkAndCreate('Cyberpunk', cyberpunkThemeSettings);
    if (msg) createdMessages.push(msg);
    msg = await checkAndCreate('Cyberpunk Dark', cyberpunkDarkThemeSettings);
    if (msg) createdMessages.push(msg);

    if (createdMessages.length > 0) {
      revalidatePath('/');
      revalidatePath('/settings/themes');
      return { success: true, message: `Preset themes processed: ${createdMessages.join(', ')}.` };
    }

    return { success: true, message: 'All preset themes already exist for this user.' };

  } catch (error) {
    console.error('Error creating or checking preset themes:', error);
    return { success: false, error: 'Failed to process preset themes' };
  }
} 