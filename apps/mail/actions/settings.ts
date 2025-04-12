"use server";

import { type UserSettings, userSettingsSchema } from "@zero/db/user_settings_default";
import { earlyAccess, user, userSettings } from "@zero/db/schema";
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

export async function saveUserSettings(settings: UserSettings) {
  try {
    const userId = await getAuthenticatedUserId();
    settings = validateSettings(settings);
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
    console.error("Failed to save user settings:", error);
    throw new Error("Failed to save user settings");
  }
}

export async function handleGoldenTicket(email: string) {
  try {
    const userId = await getAuthenticatedUserId();
    const [foundUser] = await db
      .select({
        hasUsedTicket: earlyAccess.hasUsedTicket,
        email: user.email,
        isEarlyAccess: earlyAccess.isEarlyAccess
      })
      .from(user)
      .leftJoin(earlyAccess, eq(user.email, earlyAccess.email))
      .where(eq(user.id, userId))
      .limit(1);

    if (!foundUser) {
      return { success: false, error: 'User not found' };
    }

    if (foundUser.hasUsedTicket) {
      return { success: false, error: 'Golden ticket already claimed' };
    }

    if (!foundUser.isEarlyAccess) {
      return { success: false, error: 'Unauthorized' };
    }

    await db
      .insert(earlyAccess)
      .values({
        id: crypto.randomUUID(),
        email,
        createdAt: new Date(),
        updatedAt: new Date(),
        isEarlyAccess: true,
        hasUsedTicket: '',
      }).catch(async (error) => {
        console.log('Error registering early access', error);
        if (error.code === '23505') {
          console.log('Email already registered for early access, granted access');
          await db.update(earlyAccess).set({
            hasUsedTicket: '',
            updatedAt: new Date(),
            isEarlyAccess: true
          }).where(eq(earlyAccess.email, email))
        } else {
          console.error('Error registering early access', error);
          throw error;
        }
      })

    await db.update(earlyAccess).set({
      hasUsedTicket: email,
      updatedAt: new Date()
    }).where(eq(earlyAccess.email, foundUser.email))

    return { success: true };
  } catch (error) {
    console.error('Failed to handle golden ticket:', error);
    throw new Error('Failed to handle golden ticket');
  }
}