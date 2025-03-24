"use server";

import { userSettings } from "@zero/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@zero/db";
import * as z from "zod";

const settingsSchema = z.object({
  language: z.string(),
  timezone: z.string(),
  dynamicContent: z.boolean(),
  externalImages: z.boolean(),
});

export type UserSettings = z.infer<typeof settingsSchema>;

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

    const parsedSettings = settingsSchema.parse(result.settings);

    return {
      language: parsedSettings.language,
      timezone: parsedSettings.timezone,
      dynamicContent: parsedSettings.dynamicContent,
      externalImages: parsedSettings.externalImages,
    };
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
    const parsedSettings = settingsSchema.parse(settings);

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
          settings: parsedSettings,
          updatedAt: new Date(),
        })
        .where(eq(userSettings.userId, userId));
    } else {
      // Create new settings
      await db.insert(userSettings).values({
        id: crypto.randomUUID(),
        userId,
        settings: parsedSettings,
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
