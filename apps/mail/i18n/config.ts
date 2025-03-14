export type Locale = (typeof locales)[number];

export const availableLocales = [
  {
    code: "en",
    name: "English",
  },
  {
    code: "ar",
    name: "Arabic",
  },
  {
    code: "fr",
    name: "French",
  },
  {
    code: "tr",
    name: "Turkish",
  },
  {
    code: "es-ES",
    name: "Spanish",
  },
  {
    code: "de",
    name: "German",
  },
  {
    code: "pt-PT",
    name: "Portuguese",
  },
];

export const locales = availableLocales.map((locale) => locale.code);
export const defaultLocale: Locale = "en";
