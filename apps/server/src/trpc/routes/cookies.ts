import { COOKIE_CONSENT_KEY, type CookiePreferences } from '../../lib/cookies';
import { getCookie, setCookie } from 'hono/cookie';
import { privateProcedure, router } from '../trpc';
import type { Context } from 'hono';
import { z } from 'zod';

const getCookiePreferences = async (c: Context) => {
  const defaultPreferences: CookiePreferences = {
    necessary: true,
    analytics: false,
    marketing: false,
    preferences: false,
  };

  const savedPreferences = getCookie(c, COOKIE_CONSENT_KEY);

  if (!savedPreferences) return defaultPreferences;

  try {
    const parsed = JSON.parse(savedPreferences) as Partial<CookiePreferences>;
    return {
      ...defaultPreferences,
      ...parsed,
      necessary: true, // Always keep necessary cookies enabled
    };
  } catch (e) {
    console.error('Failed to parse cookie preferences:', e);
    return defaultPreferences;
  }
};

export const cookiePreferencesRouter = router({
  getPreferences: privateProcedure.query(async ({ ctx }) => {
    return getCookiePreferences(ctx.c);
  }),
  updatePreferences: privateProcedure
    .input(
      z.object({
        category: z.enum(['necessary', 'functional', 'analytics', 'marketing']),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { category, enabled } = input;
      if (category === 'necessary') {
        return getCookiePreferences(ctx.c); // Cannot disable necessary cookies
      }

      const currentPreferences = await getCookiePreferences(ctx.c);
      const newPreferences = {
        ...currentPreferences,
        [category]: enabled,
      };

      setCookie(ctx.c, COOKIE_CONSENT_KEY, JSON.stringify(newPreferences));
      return newPreferences;
    }),
});
