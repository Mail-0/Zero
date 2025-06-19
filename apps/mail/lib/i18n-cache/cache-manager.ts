import {
  generateChecksum,
  isExpired,
  createCacheEntry,
  isValidCacheEntry,
  getStorageKey,
  getManifestKey,
  retryWithBackoff,
} from './utils';
import type { TranslationCache, CacheManifest, StorageAdapter, CacheMetrics } from './types';
import { MemoryAdapter, LocalStorageAdapter, IndexedDBAdapter } from './storage-adapters';
import { CACHE_LIMITS, COMMON_LOCALES } from './types';

export class I18nCacheManager {
  private static instance: I18nCacheManager;
  private memoryAdapter: MemoryAdapter;
  private localStorageAdapter: LocalStorageAdapter;
  private indexedDBAdapter: IndexedDBAdapter;
  private initialized = false;
  private metrics: CacheMetrics = {
    hitRate: 0,
    missRate: 0,
    avgLoadTime: 0,
    storageUsage: 0,
    errorRate: 0,
  };
  private hitCount = 0;
  private missCount = 0;
  private errorCount = 0;
  private totalRequests = 0;

  private constructor() {
    this.memoryAdapter = new MemoryAdapter();
    this.localStorageAdapter = new LocalStorageAdapter();
    this.indexedDBAdapter = new IndexedDBAdapter();
  }

  static getInstance(): I18nCacheManager {
    if (!I18nCacheManager.instance) {
      I18nCacheManager.instance = new I18nCacheManager();
    }
    return I18nCacheManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Test IndexedDB availability
      await this.indexedDBAdapter.keys();
      this.initialized = true;
      console.log('I18nCacheManager initialized successfully');
    } catch (error) {
      console.warn('IndexedDB not available, falling back to localStorage only', error);
      this.initialized = true;
    }
  }

  async getTranslations(locale: string): Promise<Record<string, any> | null> {
    const startTime = Date.now();
    this.totalRequests++;

    try {
      const key = getStorageKey(locale);

      // Try memory cache first (fastest)
      let cacheEntry = await this.memoryAdapter.get(key);
      if (cacheEntry && this.isValidEntry(cacheEntry)) {
        this.recordHit(Date.now() - startTime);
        return cacheEntry.translations;
      }

      // Try IndexedDB (persistent, larger capacity)
      cacheEntry = await this.indexedDBAdapter.get(key);
      if (cacheEntry && this.isValidEntry(cacheEntry)) {
        // Cache in memory for next time
        await this.memoryAdapter.set(key, cacheEntry);
        this.recordHit(Date.now() - startTime);
        return cacheEntry.translations;
      }

      // Try localStorage (fallback)
      cacheEntry = await this.localStorageAdapter.get(key);
      if (cacheEntry && this.isValidEntry(cacheEntry)) {
        // Cache in memory and IndexedDB for next time
        await this.memoryAdapter.set(key, cacheEntry);
        await this.indexedDBAdapter.set(key, cacheEntry);
        this.recordHit(Date.now() - startTime);
        return cacheEntry.translations;
      }

      this.recordMiss(Date.now() - startTime);
      return null;
    } catch (error) {
      this.recordError();
      console.error('Error getting translations from cache:', error);
      return null;
    }
  }

  async setTranslations(
    locale: string,
    translations: Record<string, any>,
    version: string = '1.0.0',
  ): Promise<void> {
    try {
      const key = getStorageKey(locale);
      const cacheEntry = createCacheEntry(locale, translations, version);

      // Store in all available adapters
      await Promise.allSettled([
        this.memoryAdapter.set(key, cacheEntry),
        this.indexedDBAdapter.set(key, cacheEntry),
        this.localStorageAdapter.set(key, cacheEntry),
      ]);

      console.log(`Cached translations for locale: ${locale}`);
    } catch (error) {
      this.recordError();
      console.error('Error setting translations in cache:', error);
    }
  }

  async preloadTranslations(locale: string): Promise<void> {
    try {
      // Check if already cached
      const existing = await this.getTranslations(locale);
      if (existing) return;

      // Fetch from server
      const response = await fetch(`/api/i18n/chunks/${locale}/main`);
      if (!response.ok) {
        throw new Error(`Failed to fetch translations for ${locale}: ${response.statusText}`);
      }

      const data = await response.json<Record<string, any>>();
      await this.setTranslations(locale, data, '1.0.0');
    } catch (error) {
      console.error(`Failed to preload translations for ${locale}:`, error);
    }
  }

  async invalidateLocale(locale: string): Promise<void> {
    try {
      const key = getStorageKey(locale);
      await Promise.allSettled([
        this.memoryAdapter.delete(key),
        this.indexedDBAdapter.delete(key),
        this.localStorageAdapter.delete(key),
      ]);
      console.log(`Invalidated cache for locale: ${locale}`);
    } catch (error) {
      console.error(`Error invalidating cache for locale ${locale}:`, error);
    }
  }

  async clearCache(): Promise<void> {
    try {
      await Promise.allSettled([
        this.memoryAdapter.clear(),
        this.indexedDBAdapter.clear(),
        this.localStorageAdapter.clear(),
      ]);
      console.log('Cache cleared successfully');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  async getStorageUsage(): Promise<number> {
    try {
      const keys = await this.indexedDBAdapter.keys();
      let totalSize = 0;

      for (const key of keys) {
        const entry = await this.indexedDBAdapter.get(key);
        if (entry?.metadata?.size) {
          totalSize += entry.metadata.size;
        }
      }

      return totalSize;
    } catch {
      return 0;
    }
  }

  async cleanupExpiredEntries(): Promise<void> {
    try {
      const keys = await this.indexedDBAdapter.keys();
      const expiredKeys: string[] = [];

      for (const key of keys) {
        const entry = await this.indexedDBAdapter.get(key);
        if (entry && isExpired(entry.timestamp)) {
          expiredKeys.push(key);
        }
      }

      // Remove expired entries
      await Promise.allSettled(
        expiredKeys.map((key) => this.invalidateLocale(key.replace('translations:', ''))),
      );

      if (expiredKeys.length > 0) {
        console.log(`Cleaned up ${expiredKeys.length} expired cache entries`);
      }
    } catch (error) {
      console.error('Error cleaning up expired entries:', error);
    }
  }

  async preloadCommonLocales(currentLocale: string): Promise<void> {
    const locales = [currentLocale, ...COMMON_LOCALES].filter(
      (locale, index, arr) => arr.indexOf(locale) === index,
    );

    // Preload current locale immediately
    await this.PreloadWithPriority(currentLocale);

    // Preload common locales in background
    const backgroundPreloads = locales
      .filter((locale) => locale !== currentLocale)
      .map((locale) => this.preloadInBackground(locale));

    // Don't await background preloads
    Promise.allSettled(backgroundPreloads);
  }

  private async PreloadWithPriority(locale: string): Promise<void> {
    return retryWithBackoff(() => this.preloadTranslations(locale), 2, 500);
  }

  private async preloadInBackground(locale: string): Promise<void> {
    // Add delay to not interfere with main loading
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      await this.preloadTranslations(locale);
    } catch (error) {
      console.warn(`Background preload failed for ${locale}:`, error);
    }
  }

  private isValidEntry(entry: any): boolean {
    return (
      isValidCacheEntry(entry) &&
      !isExpired(entry.timestamp) &&
      entry.translations &&
      Object.keys(entry.translations).length > 0
    );
  }

  private recordHit(loadTime: number): void {
    this.hitCount++;
    this.updateMetrics();
  }

  private recordMiss(loadTime: number): void {
    this.missCount++;
    this.updateMetrics();
  }

  private recordError(): void {
    this.errorCount++;
    this.updateMetrics();
  }

  private updateMetrics(): void {
    const total = this.hitCount + this.missCount;
    this.metrics.hitRate = total > 0 ? (this.hitCount / total) * 100 : 0;
    this.metrics.missRate = total > 0 ? (this.missCount / total) * 100 : 0;
    this.metrics.errorRate =
      this.totalRequests > 0 ? (this.errorCount / this.totalRequests) * 100 : 0;
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  async updateCacheEntry(locale: string, lastAccessed: number = Date.now()): Promise<void> {
    try {
      const key = getStorageKey(locale);
      const entry = await this.indexedDBAdapter.get(key);

      if (entry) {
        entry.metadata.lastAccessed = lastAccessed;
        await this.indexedDBAdapter.set(key, entry);
      }
    } catch (error) {
      console.warn(`Failed to update cache entry for ${locale}:`, error);
    }
  }
}

export const i18nCacheManager = I18nCacheManager.getInstance();
