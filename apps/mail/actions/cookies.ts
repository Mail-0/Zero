"use server";
import { COOKIE_CONSENT_KEY, type CookieCategory, type CookiePreferences } from "@/lib/cookies";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export async function getCookiePreferences(): Promise<CookiePreferences> {
  const defaultPreferences: CookiePreferences = {
    necessary: true,
    analytics: false,
    marketing: false,
    preferences: false,
  };

  const cookieStore = await cookies();
  const savedPreferences = cookieStore.get(COOKIE_CONSENT_KEY);

  if (!savedPreferences?.value) {
    return defaultPreferences;
  }

  try {
    const parsed = JSON.parse(savedPreferences.value) as Partial<CookiePreferences>;
    return {
      ...defaultPreferences,
      ...parsed,
      necessary: true, // Always keep necessary cookies enabled
    };
  } catch (e) {
    console.error("Failed to parse cookie preferences:", e);
    return defaultPreferences;
  }
}

export async function updateCookiePreferences(
  category: CookieCategory,
  enabled: boolean,
): Promise<CookiePreferences> {
  if (category === "necessary") {
    return getCookiePreferences(); // Cannot disable necessary cookies
  }

  const currentPreferences = await getCookiePreferences();
  const newPreferences = {
    ...currentPreferences,
    [category]: enabled,
  };

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_CONSENT_KEY, JSON.stringify(newPreferences));
  revalidatePath("/settings/cookies");
  return newPreferences;
}
