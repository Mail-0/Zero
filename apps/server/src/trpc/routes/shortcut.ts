import { shortcutSchema } from '../../lib/shortcuts';
import { getZeroDB } from '../../lib/server-utils';
import { privateProcedure, router } from '../trpc';
import { z } from 'zod';

export const shortcutRouter = router({
  update: privateProcedure
    .input(
      z.object({
        shortcuts: z.array(shortcutSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { sessionUser } = ctx;
      const { shortcuts } = input;
      const db = await getZeroDB(sessionUser.id);
      // The RPC stores this array as JSON; its insert-row signature does not describe the payload.
      await db.insertUserHotkeys(
        shortcuts as unknown as Parameters<typeof db.insertUserHotkeys>[0],
      );
    }),
});
