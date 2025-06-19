import type { IntlMessages, Locale } from './config';

interface CacheEntry {
  messages: IntlMessages;
  timestamp: number;
  etag: string;
}

class I18nCache {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL = 1000 * 60 * 60; // 1 hour

  constructor(private readonly KV?: KVNamespace) {}

  async get(locale: Locale): Promise<IntlMessages | null> {
    const cacheKey = `i18n:${locale}`;

    // Try memory cache first
    const memoryEntry = this.cache.get(cacheKey);
    if (memoryEntry && Date.now() - memoryEntry.timestamp < this.TTL) {
      return memoryEntry.messages;
    }

    // Try KV cache (Cloudflare Workers)
    if (this.KV) {
      try {
        const kvEntry = await this.KV.get(cacheKey, 'json');
        if (kvEntry) {
          const entry = kvEntry as CacheEntry;
          if (Date.now() - entry.timestamp < this.TTL) {
            // Update memory cache
            this.cache.set(cacheKey, entry);
            return entry.messages;
          }
        }
      } catch (error) {
        console.warn('KV cache read failed:', error);
      }
    }

    return null;
  }

  async set(locale: Locale, messages: IntlMessages): Promise<void> {
    const cacheKey = `i18n:${locale}`;
    const entry: CacheEntry = {
      messages,
      timestamp: Date.now(),
      etag: this.generateETag(messages),
    };

    // Set memory cache
    this.cache.set(cacheKey, entry);

    // Set KV cache (Cloudflare Workers)
    if (this.KV) {
      try {
        await this.KV.put(cacheKey, JSON.stringify(entry), {
          expirationTtl: this.TTL / 1000,
        });
      } catch (error) {
        console.warn('KV cache write failed:', error);
      }
    }
  }

  getETag(locale: Locale): string | null {
    const entry = this.cache.get(`i18n:${locale}`);
    return entry?.etag || null;
  }

  clear(): void {
    this.cache.clear();
  }

  private generateETag(messages: IntlMessages): string {
    // Simple hash of messages for ETag
    const str = JSON.stringify(messages);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `"${Math.abs(hash).toString(36)}"`;
  }
}

export const i18nCache = new I18nCache();

// For Cloudflare Workers
export const createI18nCache = (kv: KVNamespace) => new I18nCache(kv);
