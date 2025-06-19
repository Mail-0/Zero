import type { TranslationCache } from './types';
import { CACHE_LIMITS } from './types';

export function generateChecksum(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

export function isExpired(timestamp: number, ttl: number = CACHE_LIMITS.ttl): boolean {
  return Date.now() - timestamp > ttl;
}

export function calculateSize(data: any): number {
  return new Blob([JSON.stringify(data)]).size;
}

export function createCacheEntry(
  locale: string,
  translations: Record<string, any>,
  version: string = '1.0.0'
): TranslationCache {
  const timestamp = Date.now();
  const checksum = generateChecksum(translations);
  const size = calculateSize(translations);
  const keysCount = Object.keys(translations).length;

  return {
    version,
    locale,
    timestamp,
    checksum,
    translations,
    metadata: {
      size,
      keysCount,
      lastAccessed: timestamp
    }
  };
}

export function isValidCacheEntry(entry: any): entry is TranslationCache {
  return (
    entry &&
    typeof entry === 'object' &&
    typeof entry.version === 'string' &&
    typeof entry.locale === 'string' &&
    typeof entry.timestamp === 'number' &&
    typeof entry.checksum === 'string' &&
    typeof entry.translations === 'object' &&
    entry.metadata &&
    typeof entry.metadata.size === 'number' &&
    typeof entry.metadata.keysCount === 'number' &&
    typeof entry.metadata.lastAccessed === 'number'
  );
}

export function shouldPreload(locale: string, currentLocale: string): boolean {
  // Always preload current locale
  if (locale === currentLocale) return true;
  
  // Preload common locales
  const commonLocales = ['en', 'es', 'fr', 'de'];
  return commonLocales.includes(locale);
}

export function getStorageKey(locale: string): string {
  return `translations:${locale}`;
}

export function getManifestKey(): string {
  return 'manifest';
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (i === maxRetries - 1) throw lastError;
      
      const delay = baseDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}
