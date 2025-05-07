import { connectionTheme, theme } from '@zero/db/schema';
import { privateProcedure, router } from '../trpc';
import { CreateThemeSchema } from '@/lib/theme';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

export const themeRouter = router({
  save: privateProcedure.input(CreateThemeSchema).mutation(async ({ ctx, input }) => {
    const { db, session } = ctx;
    const { name, visibility, light, dark } = input;
    const userId = session.user.id;
    const theme_ = await db
      .insert(theme)
      .values({
        id: crypto.randomUUID(),
        name,
        styles: {
          light,
          dark,
        },
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        isFeatured: false,
        visibility,
      })
      .returning({
        id: theme.id,
        name: theme.name,
        styles: theme.styles,
        visibility: theme.visibility,
        userId: theme.userId,
      });

    if (!theme_[0]) {
      throw new Error('Failed to create theme');
    }

    return {
      id: theme_[0].id,
      name: theme_[0].name,
      styles: theme_[0].styles,
      visibility: theme_[0].visibility,
      userId: theme_[0].userId,
    };
  }),

  setConnectionTheme: privateProcedure
    .input(
      z.object({
        themeId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session, db } = ctx;
      const { themeId } = input;

      const prevTheme = await db.query.theme.findFirst({
        where: and(eq(theme.id, themeId), eq(theme.userId, session.user.id)),
      });

      if (!prevTheme) {
        throw new Error('Theme not found');
      }

      if (!session.connectionId) {
        throw new Error('No connection ID');
      }

      await db
        .delete(connectionTheme)
        .where(eq(connectionTheme.connectionId, session.connectionId));

      await db.insert(connectionTheme).values({
        connectionId: session.connectionId,
        themeId: prevTheme.id,
      });
      return {
        ...prevTheme,
      };
    }),

  removeConnectionTheme: privateProcedure
    .input(
      z.object({
        themeId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session, db } = ctx;
      const { themeId } = input;

      if (!session.connectionId) {
        throw new Error('No connection ID');
      }

      await db
        .delete(connectionTheme)
        .where(
          and(
            eq(connectionTheme.connectionId, session.connectionId),
            eq(connectionTheme.themeId, themeId),
          ),
        );
      return {
        success: true,
      };
    }),
});
