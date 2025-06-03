import { shortcutSchema } from '../../lib/shortcuts';
import { privateProcedure, router } from '../trpc';
import { userHotkeys } from '../../db/schema';
import { z } from 'zod';

export const shortcutRouter = router({
  update: privateProcedure
    .input(
      z.object({
        shortcuts: z.array(shortcutSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, sessionUser } = ctx;
      const { shortcuts } = input;
      await db
        .insert(userHotkeys)
        .values({
          userId: sessionUser.id,
          shortcuts,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: userHotkeys.userId,
          set: {
            shortcuts,
            updatedAt: new Date(),
          },
        });
    }),
});
