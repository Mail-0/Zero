"use server";

import { type UserSettings, userSettingsSchema } from "@zero/db/user_settings_default";
import { userSettings } from "@zero/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@zero/db";


export async function getUserSettings() {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session) {
        throw new Error("Unauthorized, reconnect");
    }

    const userId = session?.user?.id;

    if (!userId) {
      throw new Error("Unauthorized, reconnect");
    }

    const [result] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    // Returning null here when there are no settings so we can use the default settings with timezone from the browser
    if (!result) return null;

    try {
      const parsedSettings = userSettingsSchema.parse(result.settings);
      return parsedSettings;
    } catch (error) {
      console.error("Settings validation error: Schema mismatch", {
        error,
        settings: result.settings
      });
      throw new Error("Invalid settings format");
    }
  } catch (error) {
    console.error("Failed to fetch user settings:", error);
    throw new Error("Failed to fetch user settings");
  }
}

export async function saveUserSettings(settings: UserSettings) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session) {
      throw new Error("Unauthorized");
    }

    const userId = session?.user?.id;

    if (!userId) {
      throw new Error("Unauthorized");
    }

    // Validate settings
    try {
      const parsedSettings = userSettingsSchema.parse(settings);
      settings = parsedSettings;
    } catch (error) {
      console.error("Settings validation error: Schema mismatch", {
        error,
        settings: settings
      });
      throw new Error("Invalid settings format");
    }

    const [existingSettings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (existingSettings) {
      // Update existing settings
      await db
        .update(userSettings)
        .set({
          settings: settings,
          updatedAt: new Date(),
        })
        .where(eq(userSettings.userId, userId));
    } else {
      // Create new settings
      await db.insert(userSettings).values({
        id: crypto.randomUUID(),
        userId,
        settings,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to save user settings:", error);
    throw new Error("Failed to save user settings");
  }
}
