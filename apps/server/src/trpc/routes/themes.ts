import { z } from 'zod';
import { router, privateProcedure } from '../trpc';
import { theme, type ThemeSettings } from '@zero/db';
import { eq, and } from 'drizzle-orm';

// Define input schemas
const themeCreateSchema = z.object({
  name: z.string(),
  connectionId: z.string().optional().nullable(),
  settings: z.record(z.any()).or(z.record(z.record(z.any()))),
  isPublic: z.boolean().optional().default(false),
});

const themeUpdateSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  connectionId: z.string().optional().nullable(),
  settings: z.record(z.any()).or(z.record(z.record(z.any()))).optional(),
  isPublic: z.boolean().optional(),
});

const themeIdSchema = z.string();
const connectionIdSchema = z.string();
const applyThemeSchema = z.object({
  themeId: z.string(),
  connectionId: z.string().optional(),
});

export const themesRouter = router({
  create: privateProcedure
    .input(themeCreateSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Use the db from context
        const db = ctx.db;
        
        const newTheme = await db.insert(theme).values({
          name: input.name,
          userId: ctx.session.user.id,
          connectionId: input.connectionId || null,
          settings: input.settings as ThemeSettings,
          isPublic: input.isPublic,
        }).returning();

        return { success: true, theme: newTheme[0] };
      } catch (error) {
        console.error('Error creating theme:', error);
        throw new Error('Failed to create theme');
      }
    }),

  update: privateProcedure
    .input(themeUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Use the db from context
        const db = ctx.db;
        
        const themeData = await db.query.theme.findFirst({
          where: and(
            eq(theme.id, input.id),
            eq(theme.userId, ctx.session.user.id)
          ),
        });

        if (!themeData) {
          throw new Error('Theme not found or not authorized');
        }

        const updateData: any = {};
        if (input.name !== undefined) updateData.name = input.name;
        if (input.connectionId !== undefined) updateData.connectionId = input.connectionId;
        if (input.settings !== undefined) updateData.settings = input.settings;
        if (input.isPublic !== undefined) updateData.isPublic = input.isPublic;

        const updatedTheme = await db
          .update(theme)
          .set(updateData)
          .where(and(
            eq(theme.id, input.id),
            eq(theme.userId, ctx.session.user.id)
          ))
          .returning();

        return { success: true, theme: updatedTheme[0] };
      } catch (error) {
        console.error('Error updating theme:', error);
        throw new Error('Failed to update theme');
      }
    }),

  delete: privateProcedure
    .input(themeIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Use the db from context
        const db = ctx.db;
        
        const deleted = await db
          .delete(theme)
          .where(and(
            eq(theme.id, input),
            eq(theme.userId, ctx.session.user.id)
          ))
          .returning();

        if (!deleted || deleted.length === 0) {
          throw new Error('Theme not found or not authorized');
        }

        return { success: true };
      } catch (error) {
        console.error('Error deleting theme:', error);
        throw new Error('Failed to delete theme');
      }
    }),

  getUserThemes: privateProcedure
    .query(async ({ ctx }) => {
      try {
        // Use the db from context
        const db = ctx.db;
        
        const themes = await db.query.theme.findMany({
          where: eq(theme.userId, ctx.session.user.id),
          orderBy: (theme, { desc }) => [desc(theme.updatedAt)],
        });

        return { success: true, themes };
      } catch (error) {
        console.error('Error getting user themes:', error);
        throw new Error('Failed to get themes');
      }
    }),

  getPublicThemes: privateProcedure
    .query(async ({ ctx }) => {
      try {
        // Use the db from context
        const db = ctx.db;
        
        const themes = await db.query.theme.findMany({
          where: eq(theme.isPublic, true),
          orderBy: (theme, { desc }) => [desc(theme.updatedAt)],
        });

        return { success: true, themes };
      } catch (error) {
        console.error('Error getting public themes:', error);
        throw new Error('Failed to get public themes');
      }
    }),

  getById: privateProcedure
    .input(themeIdSchema)
    .query(async ({ ctx, input }) => {
      try {
        // Use the db from context
        const db = ctx.db;
        
        const themeData = await db.query.theme.findFirst({
          where: and(
            eq(theme.id, input),
            eq(theme.userId, ctx.session.user.id)
          ),
        });

        if (!themeData) {
          throw new Error('Theme not found or not authorized');
        }

        return { success: true, theme: themeData };
      } catch (error) {
        console.error('Error fetching theme:', error);
        throw new Error('Failed to fetch theme');
      }
    }),

  getConnectionTheme: privateProcedure
    .input(connectionIdSchema)
    .query(async ({ ctx, input }) => {
      try {
        // Use the db from context
        const db = ctx.db;
        
        const themeData = await db.query.theme.findFirst({
          where: and(
            eq(theme.connectionId, input),
            eq(theme.userId, ctx.session.user.id)
          ),
        });

        if (!themeData) {
          return { success: false, error: 'No theme found for this connection' };
        }

        return { success: true, theme: themeData };
      } catch (error) {
        console.error('Error fetching connection theme:', error);
        throw new Error('Failed to fetch connection theme');
      }
    }),

  copyPublicTheme: privateProcedure
    .input(themeIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Use the db from context
        const db = ctx.db;
        
        const themeData = await db.query.theme.findFirst({
          where: and(
            eq(theme.id, input),
            eq(theme.isPublic, true)
          ),
        });

        if (!themeData) {
          throw new Error('Public theme not found');
        }

        const newTheme = await db.insert(theme).values({
          name: `Copy of ${themeData.name}`,
          userId: ctx.session.user.id,
          settings: themeData.settings,
          isPublic: false,
        }).returning();

        return { success: true, theme: newTheme[0] };
      } catch (error) {
        console.error('Error copying theme:', error);
        throw new Error('Failed to copy theme');
      }
    }),

  createDefaultThemes: privateProcedure
    .mutation(async ({ ctx }) => {
      try {
        // Use the db from context
        const db = ctx.db;
        
        // Import the default theme settings
        const { 
          defaultThemeSettings, 
          darkThemeSettings 
        } = await import('@zero/db');

        // Check if user already has themes
        const existingThemes = await db.query.theme.findMany({
          where: eq(theme.userId, ctx.session.user.id),
          limit: 1,
        });

        if (existingThemes.length > 0) {
          return { success: true, message: 'User already has themes, no defaults created' };
        }

        // Create default light theme
        await db.insert(theme).values({
          name: 'Light Theme',
          userId: ctx.session.user.id,
          settings: defaultThemeSettings,
          isPublic: false,
        });

        // Create default dark theme
        await db.insert(theme).values({
          name: 'Dark Theme',
          userId: ctx.session.user.id,
          settings: darkThemeSettings,
          isPublic: false,
        });

        return { success: true, message: 'Default light and dark themes created' };
      } catch (error) {
        console.error('Error creating default themes:', error);
        throw new Error('Failed to create default themes');
      }
    }),

  applyThemeToConnection: privateProcedure
    .input(applyThemeSchema)
    .mutation(async ({ ctx, input }) => {
      const effectiveConnectionId = input.connectionId || ctx.session.connectionId;

      if (!effectiveConnectionId) {
        throw new Error('No active or target connection specified');
      }

      try {
        // Use the db from context
        const db = ctx.db;
        
        // First find the theme and verify ownership
        const themeData = await db.query.theme.findFirst({
          where: and(
            eq(theme.id, input.themeId),
            eq(theme.userId, ctx.session.user.id)
          ),
        });

        if (!themeData) {
          throw new Error('Theme not found or not authorized');
        }
        
        // Check if there's already a theme assigned to this connection
        const existingConnectionTheme = await db.query.theme.findFirst({
          where: and(
            eq(theme.connectionId, effectiveConnectionId),
            eq(theme.userId, ctx.session.user.id)
          ),
        });
        
        if (existingConnectionTheme) {
          // Update existing connection theme assignment
          if (existingConnectionTheme.id === input.themeId) {
            // Already assigned
            return { success: true, message: 'Theme already applied to this connection' };
          }
          
          // Remove connection from the existing theme
          await db
            .update(theme)
            .set({ connectionId: null })
            .where(eq(theme.id, existingConnectionTheme.id));
        }
        
        // Assign the selected theme to the connection
        await db
          .update(theme)
          .set({ connectionId: effectiveConnectionId })
          .where(eq(theme.id, input.themeId));
        
        return { 
          success: true, 
          message: 'Theme applied successfully', 
          theme: themeData,
          connectionId: effectiveConnectionId
        };
      } catch (error) {
        console.error('Error applying theme to connection:', error);
        throw new Error('Failed to apply theme to connection');
      }
    }),

  createPresetThemes: privateProcedure
    .mutation(async ({ ctx }) => {
      try {
        // Use the db from context
        const db = ctx.db;
        
        // Import the preset theme settings
        const { 
          sunsetHorizonThemeSettings, 
          sunsetHorizonDarkThemeSettings,
          cyberpunkThemeSettings,
          cyberpunkDarkThemeSettings,
          amberMinimalThemeSettings,
          amberMinimalDarkThemeSettings,
          amethystHazeThemeSettings,
          amethystHazeDarkThemeSettings,
          boldTechThemeSettings,
          boldTechDarkThemeSettings,
          bubblegumThemeSettings,
          bubblegumDarkThemeSettings,
          caffeineThemeSettings,
          caffeineDarkThemeSettings,
        } = await import('@zero/db');

        const userId = ctx.session.user.id;
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

        // Amber Minimal Themes
        msg = await checkAndCreate('Amber Minimal', amberMinimalThemeSettings);
        if (msg) createdMessages.push(msg);
        msg = await checkAndCreate('Amber Minimal Dark', amberMinimalDarkThemeSettings);
        if (msg) createdMessages.push(msg);

        // Amethyst Haze Themes
        msg = await checkAndCreate('Amethyst Haze', amethystHazeThemeSettings);
        if (msg) createdMessages.push(msg);
        msg = await checkAndCreate('Amethyst Haze Dark', amethystHazeDarkThemeSettings);
        if (msg) createdMessages.push(msg);

        // Bold Tech Themes
        msg = await checkAndCreate('Bold Tech', boldTechThemeSettings);
        if (msg) createdMessages.push(msg);
        msg = await checkAndCreate('Bold Tech Dark', boldTechDarkThemeSettings);
        if (msg) createdMessages.push(msg);

        // Bubblegum Themes
        msg = await checkAndCreate('Bubblegum', bubblegumThemeSettings);
        if (msg) createdMessages.push(msg);
        msg = await checkAndCreate('Bubblegum Dark', bubblegumDarkThemeSettings);
        if (msg) createdMessages.push(msg);

        // Caffeine Themes
        msg = await checkAndCreate('Caffeine', caffeineThemeSettings);
        if (msg) createdMessages.push(msg);
        msg = await checkAndCreate('Caffeine Dark', caffeineDarkThemeSettings);
        if (msg) createdMessages.push(msg);

        if (createdMessages.length > 0) {
          return { success: true, message: `Preset themes processed: ${createdMessages.join(', ')}.` };
        }

        return { success: true, message: 'All preset themes already exist for this user.' };
      } catch (error) {
        console.error('Error creating or checking preset themes:', error);
        throw new Error('Failed to process preset themes');
      }
    }),
}); 