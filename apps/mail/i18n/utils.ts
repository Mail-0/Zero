"use server";

import { I18N_LOCALE_COOKIE_NAME } from "@/lib/constants";
import { defaultLocale, locales, Locale } from "./config";
import { cookies, headers } from "next/headers";

export async function getLocale() {
  const headersList = await headers();
  const cookieStore = await cookies();

  // get locale from cookie or fall back to browser locale
  const cookieLocale = cookieStore.get(I18N_LOCALE_COOKIE_NAME)?.value;

  if (cookieLocale) {
    return cookieLocale;
  }

  // extract browser locale from accept-language header
  const acceptLanguage = headersList.get("accept-language");
  if (acceptLanguage) {
    // try to get the locale with and without region (ex: "en" and "en-US")
    const reqLocale = acceptLanguage.split(",")[0]?.trim();
    const reqLocaleWithoutRegion = reqLocale?.split("-")[0]?.trim();

    // check if the locale is supported
    if (locales.includes(reqLocale as Locale)) {
      return reqLocale;
    } else if (locales.includes(reqLocaleWithoutRegion as Locale)) {
      return reqLocaleWithoutRegion;
    }
  }

  // default fallback locale
  return defaultLocale;
}

export async function changeLocale(locale: Locale) {
  const cookieStore = await cookies();
  cookieStore.set(I18N_LOCALE_COOKIE_NAME, locale);
}
