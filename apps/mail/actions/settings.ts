"use server";

import { type UserSettings, userSettingsSchema, defaultUserSettings } from "@zero/db/user_settings";
import { userSettings } from "@zero/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@zero/db";

async function getAuthenticatedUserId(): Promise<string> {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  
  if (!session?.user?.id) {
    throw new Error("Unauthorized, please reconnect");
  }
  
  return session.user.id;
}

function validateSettings(settings: unknown): UserSettings {
  try {
    return userSettingsSchema.parse(settings);
  } catch (error) {
    console.error("Settings validation error: Schema mismatch", {
      error,
      settings
    });
    throw new Error("Invalid settings format");
  }
}

export async function getUserSettings() {
  try {
    const userId = await getAuthenticatedUserId();

    const [result] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    // Returning null here when there are no settings so we can use the default settings with timezone from the browser
    if (!result) return null;

    return validateSettings(result.settings);
  } catch (error) {
    console.error("Failed to fetch user settings:", error);
    throw new Error("Failed to fetch user settings");
  }
}

export async function saveUserSettings(partialSettings: Partial<UserSettings>) {
  try {
    const userId = await getAuthenticatedUserId();
    const timestamp = new Date();

    // Get current settings or use defaults
    const [existingResult] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    // Start with default settings, then apply existing settings (if any), then apply new partial settings
    const mergedSettings = {
      ...defaultUserSettings,
      ...(existingResult?.settings as Partial<UserSettings> || {}),
      ...partialSettings,
    };

    // Validate the merged settings
    const validatedSettings = validateSettings(mergedSettings);

    if (existingResult) {
      await db
        .update(userSettings)
        .set({
          settings: validatedSettings,
          updatedAt: timestamp,
        })
        .where(eq(userSettings.userId, userId));
    } else {
      await db.insert(userSettings).values({
        id: crypto.randomUUID(),
        userId,
        settings: validatedSettings,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    return validatedSettings;
  } catch (error) {
    console.error("Failed to save user settings:", error);
    throw new Error("Failed to save user settings");
  }
}
