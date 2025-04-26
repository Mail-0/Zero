'use server';

import { type UserSettings, userSettingsSchema } from '@zero/db/user_settings_default';
import { getAuthenticatedUserId } from '@/app/api/utils';
import { userSettings } from '@zero/db/schema';
import { eq } from 'drizzle-orm';
import { db } from '@zero/db';

function validateSettings(settings: unknown): UserSettings {
  try {
    return userSettingsSchema.parse(settings);
  } catch (error) {
    console.error('Settings validation error: Schema mismatch', {
      error,
      settings,
    });
    throw new Error('Invalid settings format');
  }
}

export async function saveUserSettings(settings: UserSettings) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw new Error('No user ID found');
    console.error(settings, 'before');

    settings = validateSettings(settings);

    console.error(settings, 'after');

    const timestamp = new Date();

    const [existingSettings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (existingSettings) {
      await db
        .update(userSettings)
        .set({
          settings: settings,
          updatedAt: timestamp,
        })
        .where(eq(userSettings.userId, userId));
    } else {
      await db.insert(userSettings).values({
        id: crypto.randomUUID(),
        userId,
        settings,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to save user settings:', error);
    throw new Error('Failed to save user settings');
  }
}
