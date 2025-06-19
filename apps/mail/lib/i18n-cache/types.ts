export interface TranslationCache {
  version: string;
  locale: string;
  timestamp: number;
  checksum: string;
  translations: Record<string, any>;
  metadata: {
    size: number;
    keysCount: number;
    lastAccessed: number;
  };
}

export interface CacheManifest {
  version: string;
  locales: Record<string, {
    checksum: string;
    size: number;
    lastModified: number;
    priority: 'high' | 'medium' | 'low';
  }>;
  fallbackLocale: string;
}

export interface StorageAdapter {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  avgLoadTime: number;
  storageUsage: number;
  errorRate: number;
}

export const CACHE_LIMITS = {
  indexedDB: 50 * 1024 * 1024,    // 50MB
  localStorage: 5 * 1024 * 1024,   // 5MB
  memory: 10 * 1024 * 1024,       // 10MB
  maxLocales: 10,                  // Max cached locales
  ttl: 24 * 60 * 60 * 1000       // 24 hours
};

export const COMMON_LOCALES = ['en', 'es', 'fr', 'de'] as const;
