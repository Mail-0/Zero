import { shortcutSchema, type Shortcut } from '../../lib/shortcuts';
import { getZeroDB } from '../../lib/server-utils';
import { privateProcedure, router } from '../trpc';
import { userHotkeys } from '../../db/schema';
import { z } from 'zod';

export const shortcutRouter = router({
  get: privateProcedure.query<{
    shortcuts: (typeof userHotkeys.$inferSelect & { shortcuts: Shortcut[] }) | undefined;
  }>(async ({ ctx }) => {
    const { sessionUser } = ctx;
    const db = getZeroDB(sessionUser.id);
    const shortcuts = await db.findUserHotkeys(sessionUser.id);
    return { shortcuts };
  }),
  update: privateProcedure
    .input(
      z.object({
        shortcuts: z.array(shortcutSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { sessionUser } = ctx;
      const { shortcuts } = input;
      const db = getZeroDB(sessionUser.id);
      await db.insertUserHotkeys(shortcuts as any);
    }),
});
