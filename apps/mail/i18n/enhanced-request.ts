import { locales, defaultLocale, type Locale, type IntlMessages } from './config';
import acceptLanguageParser from 'accept-language-parser';
import { I18N_LOCALE_COOKIE_NAME } from '@/lib/constants';
import { i18nCache, createI18nCache } from './cache';
import { i18nCacheManager } from '@/lib/i18n-cache';
import deepmerge from 'deepmerge';

// Legacy fallback for server-side compatibility
const memoryCache = new Map<string, IntlMessages>();
const cacheStats = {
  hits: 0,
  misses: 0,
  warmups: 0,
};

const getCacheKey = (locale: string): string => `messages:${locale}`;
const COMMON_LOCALES = ['en', 'es', 'fr', 'de'];
const isDev = false;

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

// Lazy-loaded locales for dynamic imports
const allLocales = import.meta.glob('../locales/*.json');
let precompiledBundles: Record<string, any> | null = null;

async function loadPrecompiledBundles() {
  if (precompiledBundles) return precompiledBundles;

  try {
    const manifest = await import('../build/i18n/manifest.json');
    precompiledBundles = {};

    for (const bundle of manifest.bundles) {
      try {
        const bundleData = await import(`../build/i18n/${bundle.locale}.json`);
        precompiledBundles[bundle.locale] = bundleData;
      } catch {
        // Fallback to dynamic import
      }
    }
  } catch {
    // No precompiled bundles available
    precompiledBundles = {};
  }

  return precompiledBundles;
}

const loadMessagesInternal = async (locale: string, KV?: KVNamespace): Promise<IntlMessages> => {
  const cache = KV ? createI18nCache(KV) : i18nCache;

  // Try KV cache first
  const cached = await cache.get(locale as Locale);
  if (cached) {
    return cached;
  }

  let messages: IntlMessages;

  // Try precompiled bundles
  const bundles = await loadPrecompiledBundles();
  if (bundles && bundles[locale]) {
    if (locale === defaultLocale) {
      messages = bundles[locale];
    } else {
      const defaultMessages =
        bundles[defaultLocale] || ((await allLocales['../locales/en.json']()) as IntlMessages);
      messages = deepmerge(defaultMessages, bundles[locale]);
    }
  } else {
    // Fallback to dynamic imports
    const localeMessages = (await allLocales[`../locales/${locale}.json`]?.()) ?? null;
    if (!localeMessages) throw new Error(`Messages not found for locale: ${locale}`);

    if (locale === defaultLocale) {
      messages = localeMessages as IntlMessages;
    } else {
      const defaultMessages = (await allLocales['../locales/en.json']()) as IntlMessages;
      messages = deepmerge(defaultMessages, localeMessages);
    }
  }

  // Cache for future requests
  await cache.set(locale as Locale, messages);

  return messages;
};

/**
 * Enhanced getMessages function that tries client-side cache first
 */
export const getMessages = async (locale: string, KV?: KVNamespace): Promise<IntlMessages> => {
  // For client-side requests, try the new cache manager first
  if (typeof window !== 'undefined') {
    try {
      await i18nCacheManager.initialize();
      const cachedTranslations = await i18nCacheManager.getTranslations(locale);

      if (cachedTranslations) {
        console.log(`[i18n] Client cache hit for ${locale}`);
        return cachedTranslations as IntlMessages;
      }
    } catch (error) {
      console.warn('[i18n] Client cache failed, falling back to server:', error);
    }
  }

  // Server-side or fallback logic
  const cacheKey = getCacheKey(locale);

  // Check memory cache first (immediate response)
  if (!isDev) {
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      cacheStats.hits++;
      console.log(
        `[i18n] Server cache hit for ${locale} (${cacheStats.hits}/${cacheStats.hits + cacheStats.misses} hit rate)`,
      );
      return cached;
    }
  }

  cacheStats.misses++;
  console.log(`[i18n] Cache miss for ${locale}, loading...`);

  // Load messages and cache in memory
  const messages = await loadMessagesInternal(locale, KV);
  memoryCache.set(cacheKey, messages);

  // Also cache in client-side cache if available
  if (typeof window !== 'undefined') {
    try {
      await i18nCacheManager.setTranslations(locale, messages as Record<string, any>);
      console.log(`[i18n] Cached ${locale} in client storage`);
    } catch (error) {
      console.warn(`[i18n] Failed to cache ${locale} in client storage:`, error);
    }
  }

  console.log(`[i18n] Cached ${locale} in memory (${memoryCache.size} locales cached)`);
  return messages;
};

/**
 * Client-side specific function to get cached messages
 */
export const getCachedMessages = async (locale: string): Promise<IntlMessages | null> => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    await i18nCacheManager.initialize();
    const cachedTranslations = await i18nCacheManager.getTranslations(locale);
    return cachedTranslations as IntlMessages | null;
  } catch (error) {
    console.warn(`[i18n] Failed to get cached messages for ${locale}:`, error);
    return null;
  }
};

/**
 * Preload translations for better performance
 */
export const preloadTranslations = async (locale: string): Promise<void> => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    await i18nCacheManager.initialize();
    await i18nCacheManager.preloadTranslations(locale);
    console.log(`[i18n] Preloaded translations for ${locale}`);
  } catch (error) {
    console.error(`[i18n] Failed to preload translations for ${locale}:`, error);
  }
};

// Cache warming for common locales (server-side)
export const warmCache = async (KV?: KVNamespace) => {
  if (typeof window !== 'undefined') {
    // Client-side warming through cache manager
    try {
      await i18nCacheManager.initialize();
      await i18nCacheManager.preloadCommonLocales(defaultLocale);
      console.log('[i18n] Client-side cache warmed up');
    } catch (error) {
      console.error('[i18n] Client-side cache warmup failed:', error);
    }
    return;
  }

  // Server-side warming
  console.log('[i18n] Warming up server cache for common locales...');
  const startTime = Date.now();

  const warmupPromises = COMMON_LOCALES.map(async (locale) => {
    try {
      await getMessages(locale, KV);
      cacheStats.warmups++;
      console.log(`[i18n] Warmed up ${locale}`);
    } catch (error) {
      console.warn(`[i18n] Failed to warm up ${locale}:`, error);
    }
  });

  await Promise.all(warmupPromises);
  const duration = Date.now() - startTime;
  console.log(
    `[i18n] Cache warmup completed in ${duration}ms (${cacheStats.warmups}/${COMMON_LOCALES.length} locales)`,
  );
};

// Cache management utilities
export const clearMemoryCache = () => {
  memoryCache.clear();
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.warmups = 0;
  console.log('[i18n] Memory cache cleared');
};

export const clearAllCaches = async () => {
  clearMemoryCache();

  if (typeof window !== 'undefined') {
    try {
      await i18nCacheManager.clearCache();
      console.log('[i18n] All caches cleared');
    } catch (error) {
      console.error('[i18n] Failed to clear client caches:', error);
    }
  }
};

export const getCacheStats = () => ({
  ...cacheStats,
  size: memoryCache.size,
  hitRate: cacheStats.hits / (cacheStats.hits + cacheStats.misses) || 0,
});

// HTTP response with caching headers
export const createI18nResponse = (messages: IntlMessages, locale: Locale, cache = i18nCache) => {
  const etag = cache.getETag(locale);

  return new Response(JSON.stringify(messages), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      ETag: etag || `"${Date.now()}"`,
      Vary: 'Accept-Language',
      'Content-Encoding': 'gzip',
    },
  });
};

// Auto-warm cache on module load (non-blocking)
if (!isDev && typeof window === 'undefined') {
  warmCache().catch(console.error);
}
