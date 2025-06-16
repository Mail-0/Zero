import { router, publicProcedure, activeConnectionProcedure } from '../trpc';
import { connection, theme } from '../../db/schema';
import { eq, or } from 'drizzle-orm';
import { z } from 'zod';

export const themeRouter = router({
  getThemes: publicProcedure
    .input(z.object({
      publicOnly: z.boolean().optional().default(false)
    }).optional())
    .query(async ({ ctx, input }) => {
      const publicOnly = input?.publicOnly ?? !ctx.sessionUser;
      
      // If user is not authenticated or publicOnly is true, only return public themes
      if (publicOnly || !ctx.sessionUser) {
        const themes = await ctx.c.var.db
          .select()
          .from(theme)
          .where(eq(theme.isPublic, true));
        return themes;
      }
      
      // If user is authenticated and publicOnly is false, return user's themes and public themes
      const themes = await ctx.c.var.db
        .select()
        .from(theme)
        .where(
          or(
            eq(theme.userId, ctx.sessionUser.id),
            eq(theme.isPublic, true)
          )
        );
      return themes;
    }),
  setConnectionTheme: activeConnectionProcedure
    .input(z.object({ connectionId: z.string(), themeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { connectionId, themeId } = input;
      await ctx.c.var.db
        .update(connection)
        .set({ themeId })
        .where(eq(connection.id, connectionId))
        .execute();
      return { success: true };
    }),
  getActiveTheme: activeConnectionProcedure.query(async ({ ctx }) => {
    const activeConnection = await ctx.c.var.db
      .select({ themeId: connection.themeId })
      .from(connection)
      .where(eq(connection.id, ctx.activeConnection!.id))
      .execute();
    if (!activeConnection[0]?.themeId) return null;
    const activeTheme = await ctx.c.var.db
      .select()
      .from(theme)
      .where(eq(theme.id, activeConnection[0].themeId))
      .execute();
    return activeTheme[0] || null;
  }),
  create: activeConnectionProcedure
    .input(z.object({
      id: z.string(),
      name: z.string(),
      colors: z.object({
        primary: z.string(),
        primaryForeground: z.string(),
        // Removed secondary and secondaryForeground
        background: z.string(),
        foreground: z.string(),
        card: z.string(),
        cardForeground: z.string(),
        popover: z.string(),
        popoverForeground: z.string(),
        border: z.string(),
        input: z.string(),
        ring: z.string(),
        success: z.string().optional(),
        warning: z.string().optional(),
        error: z.string().optional()
      }),
      fonts: z.object({
        body: z.string(),
        heading: z.string(),
        mono: z.string()
      }),
      spacing: z.object({
        base: z.string(),
        section: z.string(),
        card: z.string(),
        button: z.string()
      }),
      radius: z.object({
        base: z.string(),
        button: z.string(),
        card: z.string(),
        input: z.string()
      }),
      shadows: z.object({
        base: z.string(),
        card: z.string(),
        button: z.string()
      }),
      isPublic: z.boolean().optional(),
      isDefault: z.boolean().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, name, colors, fonts, spacing, radius, shadows, isPublic, isDefault } = input;
      
      const newTheme = await ctx.c.var.db
        .insert(theme)
        .values({
          id,
          name,
          colors,
          fonts,
          spacing,
          radius,
          shadows,
          isPublic: isPublic ?? false,
          isDefault: isDefault ?? false,
          userId: ctx.sessionUser.id,
        })
        .returning()
        .execute();
      return newTheme[0];
    }),
  update: activeConnectionProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      colors: z.object({
        primary: z.string(),
        primaryForeground: z.string(),
        // Removed secondary and secondaryForeground
        background: z.string(),
        foreground: z.string(),
        card: z.string(),
        cardForeground: z.string(),
        popover: z.string(),
        popoverForeground: z.string(),
        border: z.string(),
        input: z.string(),
        ring: z.string(),
        success: z.string().optional(),
        warning: z.string().optional(),
        error: z.string().optional(),
      }).optional(),
      fonts: z.object({
        body: z.string(),
        heading: z.string(),
        mono: z.string(),
      }).optional(),
      spacing: z.object({
        base: z.string(),
        section: z.string(),
        card: z.string(),
        button: z.string(),
      }).optional(),
      radius: z.object({
        base: z.string(),
        button: z.string(),
        card: z.string(),
        input: z.string(),
      }).optional(),
      shadows: z.object({
        base: z.string(),
        card: z.string(),
        button: z.string(),
      }).optional(),
      isPublic: z.boolean().optional(),
      isDefault: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;
      console.log("Received update data:", updateData);

      const existingTheme = await ctx.c.var.db
        .select()
        .from(theme)
        .where(eq(theme.id, id))
        .execute();

      if (!existingTheme[0]) {
        throw new Error(`Theme with id ${id} not found`);
      }

      const currentTheme = existingTheme[0];

      const updatedTheme = await ctx.c.var.db
        .update(theme)
        .set({
          name: updateData.name ?? currentTheme.name,
          colors: updateData.colors ?? currentTheme.colors,
          fonts: updateData.fonts ?? currentTheme.fonts,
          spacing: updateData.spacing ?? currentTheme.spacing,
          radius: updateData.radius ?? currentTheme.radius,
          shadows: updateData.shadows ?? currentTheme.shadows,
          isPublic: updateData.isPublic ?? currentTheme.isPublic,
          isDefault: updateData.isDefault ?? currentTheme.isDefault,
          updatedAt: new Date(),
        })
        .where(eq(theme.id, id))
        .returning()
        .execute();

      console.log("Updated theme in DB:", updatedTheme[0]);
      return updatedTheme[0];
    }),
  // Add delete procedure
  delete: activeConnectionProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id } = input;

      // Check if the theme exists and belongs to the user
      const existingTheme = await ctx.c.var.db
        .select()
        .from(theme)
        .where(eq(theme.id, id))
        .execute();

      if (!existingTheme[0]) {
        throw new Error(`Theme with id ${id} not found`);
      }

      if (existingTheme[0].userId !== ctx.sessionUser.id) {
        throw new Error("Unauthorized: You can only delete your own themes");
      }

      // Delete the theme
      await ctx.c.var.db
        .delete(theme)
        .where(eq(theme.id, id))
        .execute();

      // Optionally, remove themeId from any connections using this theme
      await ctx.c.var.db
        .update(connection)
        .set({ themeId: null })
        .where(eq(connection.themeId, id))
        .execute();

      return { success: true };
    }),
});