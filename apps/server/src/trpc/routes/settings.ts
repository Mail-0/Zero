import { createRateLimiterMiddleware, privateProcedure, publicProcedure, router } from '../trpc';
import { defaultUserSettings, userSettingsSchema, type UserSettings } from '../../lib/schemas';
import { getZeroDB } from '../../lib/server-utils';
import { Ratelimit } from '@upstash/ratelimit';

export const settingsRouter = router({
  get: publicProcedure
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(120, '1m'),
        generatePrefix: ({ sessionUser }) => `ratelimit:get-settings-${sessionUser?.id}`,
      }),
    )
    .query(async ({ ctx }) => {
      if (!ctx.sessionUser) return { settings: defaultUserSettings };

      const { sessionUser } = ctx;
      const db = getZeroDB(sessionUser.id);
      const result: any = await db.findUserSettings();

      // Returning null here when there are no settings so we can use the default settings with timezone from the browser
      if (!result) return { settings: defaultUserSettings };

      const settingsRes = userSettingsSchema.safeParse(result.settings);
      if (!settingsRes.success) {
        ctx.c.executionCtx.waitUntil(db.updateUserSettings(defaultUserSettings));
        console.log('returning default settings');
        return { settings: defaultUserSettings };
      }

      return { settings: settingsRes.data };
    }),

  save: privateProcedure.input(userSettingsSchema.partial()).mutation(async ({ ctx, input }) => {
    const { sessionUser } = ctx;
    const db = getZeroDB(sessionUser.id);
    const existingSettings: any = await db.findUserSettings();

    if (existingSettings) {
      const newSettings: any = { ...(existingSettings.settings as UserSettings), ...input };
      await db.updateUserSettings(newSettings);
    } else {
      await db.insertUserSettings({ ...(defaultUserSettings as any), ...input });
    }

    return { success: true };
  }),
});
