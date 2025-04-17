import { processIP, getRatelimitModule, checkRateLimit, getAuthenticatedUserId } from '../../utils';
import { defaultUserSettings, userSettingsSchema } from '@zero/db/user_settings_default';
import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { userSettings } from '@zero/db/schema';
import { eq } from 'drizzle-orm';
import { db } from '@zero/db';

export const GET = async (req: NextRequest) => {
  const userId = await getAuthenticatedUserId();
  const finalIp = processIP(req);
  const ratelimit = getRatelimitModule({
    prefix: `ratelimit:get-settings-${userId}`,
    limiter: Ratelimit.slidingWindow(60, '1m'),
  });
  const { success, headers } = await checkRateLimit(ratelimit, finalIp);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers },
    );
  }

  const [result] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  // Returning null here when there are no settings so we can use the default settings with timezone from the browser
  if (!result) return NextResponse.json({ settings: defaultUserSettings }, { status: 200 });

  const settings = userSettingsSchema.parse(result.settings);

  return NextResponse.json(settings);
};
