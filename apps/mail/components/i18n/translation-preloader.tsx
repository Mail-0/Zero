import { translationPreloader } from '@/lib/i18n-cache';
import { useLocale } from 'use-intl';
import { useEffect } from 'react';

interface TranslationPreloaderProps {
  /**
   * Additional locales to preload based on user preferences
   */
  userLocales?: string[];

  /**
   * Whether to enable debug logging
   */
  debug?: boolean;
}

export function TranslationPreloader({
  userLocales = [],
  debug = false,
}: TranslationPreloaderProps) {
  const currentLocale = useLocale();

  useEffect(() => {
    let mounted = true;

    const initializePreloader = async () => {
      try {
        if (debug) {
          console.log('Initializing translation preloader for locale:', currentLocale);
        }

        // Initialize the preloader
        await translationPreloader.initialize(currentLocale);

        if (!mounted) return;

        // Preload critical locales (current + common)
        await translationPreloader.preloadCriticalLocales(currentLocale);

        if (!mounted) return;

        // Preload user's preferred locales if provided
        if (userLocales.length > 0) {
          await translationPreloader.preloadUserLocales(userLocales);
        }

        if (debug) {
          const status = translationPreloader.getStatus();
          console.log('Translation preloader status:', status);

          const metrics = translationPreloader.getCacheMetrics();
          console.log('Cache metrics:', metrics);
        }
      } catch (error) {
        console.error('Failed to initialize translation preloader:', error);
      }
    };

    initializePreloader();

    return () => {
      mounted = false;
    };
  }, [currentLocale, userLocales, debug]);

  // This component renders nothing - it's just for side effects
  return null;
}

/**
 * Hook to access preloader functionality
 */
export function useTranslationPreloader() {
  const currentLocale = useLocale();

  const preloadLocale = async (locale: string) => {
    try {
      await translationPreloader.forcePreload(locale);
    } catch (error) {
      console.error(`Failed to preload locale ${locale}:`, error);
      throw error;
    }
  };

  const clearCache = async () => {
    await translationPreloader.clearAllCaches();
  };

  const getStatus = () => {
    return translationPreloader.getStatus();
  };

  const getMetrics = () => {
    return translationPreloader.getCacheMetrics();
  };

  return {
    currentLocale,
    preloadLocale,
    clearCache,
    getStatus,
    getMetrics,
  };
}
