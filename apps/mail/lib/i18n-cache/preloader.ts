import { i18nCacheManager } from './cache-manager';
import { COMMON_LOCALES } from './types';
import type { Locale } from '@/i18n/config';
import { debounce } from './utils';

export class TranslationPreloader {
  private static instance: TranslationPreloader;
  private isPreloading = false;
  private preloadQueue: Set<string> = new Set();
  private initialized = false;

  private constructor() {}

  static getInstance(): TranslationPreloader {
    if (!TranslationPreloader.instance) {
      TranslationPreloader.instance = new TranslationPreloader();
    }
    return TranslationPreloader.instance;
  }

  async initialize(currentLocale: string): Promise<void> {
    if (this.initialized) return;

    try {
      await i18nCacheManager.initialize();
      
      // Start preloading immediately after page load
      this.schedulePreloading(currentLocale);
      
      // Cleanup expired entries periodically
      this.scheduleCleanup();
      
      this.initialized = true;
      console.log('TranslationPreloader initialized');
    } catch (error) {
      console.error('Failed to initialize TranslationPreloader:', error);
    }
  }

  async preloadCriticalLocales(currentLocale: string): Promise<void> {
    if (this.isPreloading) return;
    
    try {
      this.isPreloading = true;
      
      // Preload current locale with high priority
      await i18nCacheManager.preloadTranslations(currentLocale);
      
      // Queue common locales for background preloading
      COMMON_LOCALES.forEach(locale => {
        if (locale !== currentLocale) {
          this.preloadQueue.add(locale);
        }
      });
      
      // Start background preloading
      this.processPreloadQueue();
      
    } finally {
      this.isPreloading = false;
    }
  }

  async preloadUserLocales(userLocales: string[]): Promise<void> {
    // Add user's preferred locales to preload queue
    userLocales.forEach(locale => {
      this.preloadQueue.add(locale);
    });
    
    if (!this.isPreloading) {
      this.processPreloadQueue();
    }
  }

  private schedulePreloading(currentLocale: string): void {
    // Wait for page load to complete before starting preloading
    if (document.readyState === 'complete') {
      this.startPreloading(currentLocale);
    } else {
      window.addEventListener('load', () => {
        // Add small delay to not interfere with initial page rendering
        setTimeout(() => this.startPreloading(currentLocale), 100);
      });
    }
  }

  private async startPreloading(currentLocale: string): Promise<void> {
    try {
      // Check if we already have the current locale cached
      const cached = await i18nCacheManager.getTranslations(currentLocale);
      
      if (!cached) {
        // Preload current locale immediately if not cached
        await i18nCacheManager.preloadTranslations(currentLocale);
      }
      
      // Start background preloading of common locales
      await this.preloadCriticalLocales(currentLocale);
      
    } catch (error) {
      console.error('Error during initial preloading:', error);
    }
  }

  private async processPreloadQueue(): Promise<void> {
    if (this.preloadQueue.size === 0) return;
    
    const locales = Array.from(this.preloadQueue);
    this.preloadQueue.clear();
    
    // Process queue with delays to avoid overwhelming the server
    for (const locale of locales) {
      try {
        await this.preloadInBackground(locale);
        // Small delay between preloads
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.warn(`Failed to preload ${locale}:`, error);
      }
    }
  }

  private async preloadInBackground(locale: string): Promise<void> {
    try {
      // Check if already cached and not expired
      const cached = await i18nCacheManager.getTranslations(locale);
      if (cached) {
        return;
      }
      
      await i18nCacheManager.preloadTranslations(locale);
      console.log(`Background preload completed for: ${locale}`);
      
    } catch (error) {
      console.warn(`Background preload failed for ${locale}:`, error);
    }
  }

  private scheduleCleanup(): void {
    // Clean up expired entries every hour
    const cleanupInterval = 60 * 60 * 1000; // 1 hour
    
    const cleanup = debounce(async () => {
      try {
        await i18nCacheManager.cleanupExpiredEntries();
      } catch (error) {
        console.error('Cleanup failed:', error);
      }
    }, 1000);
    
    setInterval(cleanup, cleanupInterval);
  }

  // Force preload a specific locale (for user language switching)
  async forcePreload(locale: string): Promise<void> {
    try {
      await i18nCacheManager.preloadTranslations(locale);
    } catch (error) {
      console.error(`Force preload failed for ${locale}:`, error);
      throw error;
    }
  }

  // Get preloader status
  getStatus(): {
    isPreloading: boolean;
    queueSize: number;
    initialized: boolean;
  } {
    return {
      isPreloading: this.isPreloading,
      queueSize: this.preloadQueue.size,
      initialized: this.initialized
    };
  }

  // Clear all caches (for debugging or admin use)
  async clearAllCaches(): Promise<void> {
    await i18nCacheManager.clearCache();
    this.preloadQueue.clear();
  }

  // Get cache metrics
  getCacheMetrics() {
    return i18nCacheManager.getMetrics();
  }
}

export const translationPreloader = TranslationPreloader.getInstance();
