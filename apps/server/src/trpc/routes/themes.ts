import { createRateLimiterMiddleware, privateProcedure, publicProcedure, router } from '../trpc';
import { themeSchema, connectionThemeSchema, defaultTheme } from '../../lib/theme-schemas';
import { getZeroDB, getActiveConnection } from '../../lib/server-utils';
import { theme, connectionTheme } from '../../db/schema';
import { Ratelimit } from '@upstash/ratelimit';
import { eq, and, desc } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

export const themesRouter = router({
  // Get user's themes
  list: privateProcedure
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(60, '1m'),
        generatePrefix: ({ sessionUser }) => `ratelimit:get-themes-${sessionUser?.id}`,
      }),
    )
    .query(async ({ ctx }) => {
      const { sessionUser } = ctx;
      const db = getZeroDB(sessionUser.id);

      const themes = await db.findManyThemes();
      return { themes };
    }),

  // Get public themes (marketplace)
  public: publicProcedure
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(100, '1m'),
        generatePrefix: () => 'ratelimit:get-public-themes',
      }),
    )
    .query(async ({ ctx }) => {
      const db = getZeroDB('public');
      const themes = await db.findPublicThemes();
      return { themes };
    }),

  // Get theme by ID
  get: privateProcedure
    .input(z.object({ themeId: z.string() }))
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(60, '1m'),
        generatePrefix: ({ sessionUser }) => `ratelimit:get-theme-${sessionUser?.id}`,
      }),
    )
    .query(async ({ input, ctx }) => {
      const { themeId } = input;
      const { sessionUser } = ctx;
      const db = getZeroDB(sessionUser.id);

      const theme = await db.findThemeById(themeId);
      if (!theme) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Theme not found' });
      }

      return { theme };
    }),

  // Get connection's active theme
  getConnectionTheme: privateProcedure
    .input(z.object({ connectionId: z.string().optional() }))
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(60, '1m'),
        generatePrefix: ({ sessionUser }) => `ratelimit:get-connection-theme-${sessionUser?.id}`,
      }),
    )
    .query(async ({ input, ctx }) => {
      const { connectionId } = input;
      const { sessionUser } = ctx;
      const db = getZeroDB(sessionUser.id);

      let targetConnectionId = connectionId;
      if (!targetConnectionId) {
        const activeConnection = await getActiveConnection();
        targetConnectionId = activeConnection.id;
      }

      const connectionTheme = await db.findConnectionTheme(targetConnectionId);
      return { connectionTheme };
    }),

  // Create theme
  create: privateProcedure
    .input(themeSchema.omit({ id: true }))
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(10, '1m'),
        generatePrefix: ({ sessionUser }) => `ratelimit:create-theme-${sessionUser?.id}`,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { sessionUser } = ctx;
      const db = getZeroDB(sessionUser.id);

      const themeId = crypto.randomUUID();
      const newTheme = await db.createTheme({
        id: themeId,
        ...input,
      });

      return { theme: newTheme };
    }),

  // Update theme
  update: privateProcedure
    .input(
      z.object({
        themeId: z.string(),
        data: themeSchema.omit({ id: true }).partial(),
      }),
    )
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(20, '1m'),
        generatePrefix: ({ sessionUser }) => `ratelimit:update-theme-${sessionUser?.id}`,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { themeId, data } = input;
      const { sessionUser } = ctx;
      const db = getZeroDB(sessionUser.id);

      // Verify ownership
      const existingTheme = await db.findUserTheme(themeId);
      if (!existingTheme) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Theme not found' });
      }

      const updatedTheme = await db.updateTheme(themeId, data);
      return { theme: updatedTheme };
    }),

  // Delete theme
  delete: privateProcedure
    .input(z.object({ themeId: z.string() }))
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(10, '1m'),
        generatePrefix: ({ sessionUser }) => `ratelimit:delete-theme-${sessionUser?.id}`,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { themeId } = input;
      const { sessionUser } = ctx;
      const db = getZeroDB(sessionUser.id);

      // Verify ownership
      const existingTheme = await db.findUserTheme(themeId);
      if (!existingTheme) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Theme not found' });
      }

      await db.deleteTheme(themeId);
      return { success: true };
    }),

  // Copy public theme to user's themes
  copy: privateProcedure
    .input(z.object({ themeId: z.string() }))
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(10, '1m'),
        generatePrefix: ({ sessionUser }) => `ratelimit:copy-theme-${sessionUser?.id}`,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { themeId } = input;
      const { sessionUser } = ctx;
      const db = getZeroDB(sessionUser.id);

      // Get the original theme
      const originalTheme = await db.findThemeById(themeId);
      if (!originalTheme) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Theme not found' });
      }

      // Create a copy for the user
      const newThemeId = crypto.randomUUID();
      const copiedTheme = await db.createTheme({
        id: newThemeId,
        name: `${originalTheme.name} (Copy)`,
        description: originalTheme.description,
        isPublic: false,
        colors: originalTheme.colors,
        typography: originalTheme.typography,
        spacing: originalTheme.spacing,
        shadows: originalTheme.shadows,
        borderRadius: originalTheme.borderRadius,
        backgrounds: originalTheme.backgrounds,
      });

      return { theme: copiedTheme };
    }),

  // Set theme for connection
  setConnectionTheme: privateProcedure
    .input(connectionThemeSchema)
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(20, '1m'),
        generatePrefix: ({ sessionUser }) => `ratelimit:set-connection-theme-${sessionUser?.id}`,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { connectionId, themeId } = input;
      const { sessionUser } = ctx;
      const db = getZeroDB(sessionUser.id);

      // Verify user owns the connection
      const connection = await db.findUserConnection(connectionId);
      if (!connection) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Connection not found' });
      }

      // Verify theme exists and user has access
      const theme = await db.findThemeById(themeId);
      if (!theme) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Theme not found' });
      }

      // Only allow user's themes or public themes
      if (!theme.isPublic && theme.userId !== sessionUser.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied to this theme' });
      }

      await db.setConnectionTheme(connectionId, themeId);
      return { success: true };
    }),

  // Remove theme from connection (use default)
  removeConnectionTheme: privateProcedure
    .input(z.object({ connectionId: z.string() }))
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(20, '1m'),
        generatePrefix: ({ sessionUser }) => `ratelimit:remove-connection-theme-${sessionUser?.id}`,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { connectionId } = input;
      const { sessionUser } = ctx;
      const db = getZeroDB(sessionUser.id);

      // Verify user owns the connection
      const connection = await db.findUserConnection(connectionId);
      if (!connection) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Connection not found' });
      }

      await db.removeConnectionTheme(connectionId);
      return { success: true };
    }),
});
