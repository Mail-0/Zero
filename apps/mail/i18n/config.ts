const LANGUAGES = {
  en: 'English',
  ar: 'Arabic',
  ca: 'Catalan',
  de: 'German',
  es: 'Spanish',
  fr: 'French',
  hi: 'Hindi',
  ja: 'Japanese',
  ko: 'Korean',
  pl: 'Polish',
  pt: 'Portuguese',
  ru: 'Russian',
  tr: 'Turkish',
  lv: 'Latvian',
  hu: 'Hungarian',
  fa: 'Farsi',
} as const;

export type Locale = keyof typeof LANGUAGES;

export const languageConfig = LANGUAGES;

export const defaultLocale: Locale = 'en';

export const locales: Locale[] = Object.keys(LANGUAGES) as Locale[];

export const availableLocales = locales.map((code) => ({
  code,
  name: LANGUAGES[code],
}));
