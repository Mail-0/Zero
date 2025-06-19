import { locales, defaultLocale, type Locale, type IntlMessages } from './config';
import acceptLanguageParser from 'accept-language-parser';
import { I18N_LOCALE_COOKIE_NAME } from '@/lib/constants';
import deepmerge from 'deepmerge';

export const resolveLocale = (request: Request) => {
  const intlCookie = request.headers
    .get('cookie')
    ?.split(';')
    .find((c) => c.trim().startsWith(`${I18N_LOCALE_COOKIE_NAME}=`))
    ?.split('=')[1]
    ?.trim();

  const locale =
    intlCookie && locales.includes(intlCookie as Locale)
      ? intlCookie
      : acceptLanguageParser.pick(
          locales,
          request.headers.get('accept-language') || defaultLocale,
        ) || defaultLocale;
  return locale as Locale;
};

const allLocales = import.meta.glob('../locales/*.json');

const getDefaultMessages = async () => {
  const defaultMessages = (await allLocales['../locales/en.json']()) as IntlMessages;
  return defaultMessages;
};

export const getMessages: (locale: string) => Promise<IntlMessages> = async (locale: string) => {
  if (locale !== 'en') {
    const messages = (await allLocales[`../locales/${locale}.json`]?.()) ?? null;
    if (!messages) {
      const defaultMessages = await getDefaultMessages();
      return defaultMessages;
    }
    return messages as IntlMessages;
  }
  return await getDefaultMessages();
};
