import { defaultUserSettings, userSettingsSchema } from '@zero/db/user_settings_default';
import { createRateLimiterMiddleware, privateProcedure, router } from '../trpc';
import { Ratelimit } from '@upstash/ratelimit';
import { userSettings } from '@zero/db/schema';
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

export const settingsRouter = router({
  get: privateProcedure
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(60, '1m'),
        generatePrefix: ({ session }) => `ratelimit:get-settings-${session?.user.id}`,
      }),
    )
    .query(async ({ ctx }) => {
      const { db, session } = ctx;
      const [result] = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, session.user.id))
        .limit(1);

      // Returning null here when there are no settings so we can use the default settings with timezone from the browser
      if (!result) return { settings: defaultUserSettings };

      const settingsRes = userSettingsSchema.safeParse(result.settings);
      if (!settingsRes.success)
        throw new TRPCError({
          code: 'UNPROCESSABLE_CONTENT',
          message: 'Invalid user settings',
        });

      return { settings: settingsRes.data };
    }),

  save: privateProcedure.input(userSettingsSchema.partial()).mutation(async ({ ctx, input }) => {
    const { db, session } = ctx;
    const timestamp = new Date();

    const [existingSettings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, session.user.id))
      .limit(1);

    if (existingSettings) {
      const newSettings = { ...existingSettings, ...input };
      await db
        .update(userSettings)
        .set({
          settings: newSettings,
          updatedAt: timestamp,
        })
        .where(eq(userSettings.userId, session.user.id));
    } else {
      await db.insert(userSettings).values({
        id: crypto.randomUUID(),
        userId: session.user.id,
        settings: { ...defaultUserSettings, ...input },
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    return { success: true };
  }),
});
