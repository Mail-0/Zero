import { createRateLimiterMiddleware, privateProcedure, publicProcedure, router } from '../trpc';
import { defaultUserSettings, userSettingsSchema, type UserSettings } from '../../lib/schemas';
import { Ratelimit } from '@upstash/ratelimit';
import { userSettings } from '../../db/schema';
import { eq } from 'drizzle-orm';

export const settingsRouter = router({
  get: publicProcedure
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(60, '1m'),
        generatePrefix: ({ session }) => `ratelimit:get-settings-${session?.user.id}`,
      }),
    )
    .query(async ({ ctx }) => {
      if (!ctx.session) return { settings: defaultUserSettings };

      const { db, session } = ctx;
      const [result] = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, session.user.id))
        .limit(1);

      // Returning null here when there are no settings so we can use the default settings with timezone from the browser
      if (!result) return { settings: defaultUserSettings };

      const settingsRes = userSettingsSchema.safeParse(result.settings);
      if (!settingsRes.success) {
        ctx.c.executionCtx.waitUntil(
          db
            .update(userSettings)
            .set({
              settings: defaultUserSettings,
              updatedAt: new Date(),
            })
            .where(eq(userSettings.userId, session.user.id)),
        );
        console.log('returning default settings');
        return { settings: defaultUserSettings };
      }

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
      const newSettings = { ...(existingSettings.settings as UserSettings), ...input };
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
