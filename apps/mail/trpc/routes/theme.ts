import { theme, themeConnectionMap } from '@zero/db/schema';
import { privateProcedure, router } from '../trpc';
import { themeStylesSchema } from '@/types/theme';
import { TRPCError } from '@trpc/server';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';

export const themeRouter = router({
  createTheme: privateProcedure
    .input(
      z.object({
        name: z.string(),
        styles: themeStylesSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const themeId = nanoid();

      const newTheme = await db
        .insert(theme)
        .values({
          id: themeId,
          userId: session.user.id,
          name: input.name,
          styles: input.styles,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return newTheme[0];
    }),

  setConnectionTheme: privateProcedure
    .input(
      z.object({
        themeId: z.string(),
        connectionId: z.string(),
        isDefault: z.boolean().optional().default(false),
        isVisibleOnMarketplace: z.boolean().optional().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;

      const themeResult = await db
        .select()
        .from(theme)
        .where(and(eq(theme.id, input.themeId), eq(theme.userId, session.user.id)))
        .limit(1);

      if (themeResult.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Theme not found or does not belong to this user',
        });
      }

      if (input.isDefault) {
        await db
          .update(themeConnectionMap)
          .set({ isDefault: false })
          .where(eq(themeConnectionMap.connectionId, input.connectionId));
      }

      const result = await db
        .insert(themeConnectionMap)
        .values({
          id: nanoid(),
          themeId: input.themeId,
          connectionId: input.connectionId,
          isDefault: input.isDefault,
          isVisibleOnMarketplace: input.isVisibleOnMarketplace,
          createdAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [themeConnectionMap.themeId, themeConnectionMap.connectionId],
          set: {
            isDefault: input.isDefault,
            isVisibleOnMarketplace: input.isVisibleOnMarketplace,
          },
        })
        .returning();

      return result[0];
    }),
});
