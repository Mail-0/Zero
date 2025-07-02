import { privateProcedure, router } from '../trpc';
import { z } from 'zod';
import { themes } from '../../db/schema';
import { getZeroDB } from '../../lib/server-utils';

export const themeRouter = router({
  list: privateProcedure.query(async ({ ctx }) => {
    const { sessionUser } = ctx;
    const db = getZeroDB(sessionUser.id);
    // List all themes for the user
    return await db.findManyThemes();
  }),

  create: privateProcedure
    .input(
      z.object({
        name: z.string(),
        image: z.string().optional(),
        connectionId: z.string().optional(),
        isPublic: z.boolean().optional().default(false),
        config: z.any(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { sessionUser } = ctx;
      const db = getZeroDB(sessionUser.id);
      return await db.createTheme({
        id: crypto.randomUUID(),
        name: input.name,
        image: input.image ?? null,
        connectionId: input.connectionId ?? null,
        isPublic: input.isPublic,
        config: input.config,
      });
    }),

  update: privateProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        image: z.string().optional(),
        connectionId: z.string().optional(),
        isPublic: z.boolean().optional(),
        config: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { sessionUser } = ctx;
      const db = getZeroDB(sessionUser.id);
      return await db.updateTheme(input.id, input);
    }),

  delete: privateProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { sessionUser } = ctx;
      const db = getZeroDB(sessionUser.id);
      return await db.deleteTheme(input.id);
    }),
});
