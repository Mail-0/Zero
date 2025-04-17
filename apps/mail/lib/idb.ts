import { InitialThread } from '@/types';
import type { Cache, State } from 'swr';
import Dexie from 'dexie';

interface CacheEntry {
  key: string;
  state: State<any>;
  timestamp: number;
}

class SWRDatabase extends Dexie {
  cache!: Dexie.Table<CacheEntry, string>;

  constructor() {
    super('SWRCache');
    this.version(1).stores({
      cache: 'key,timestamp',
    });
  }
}

const db = new SWRDatabase();
const ONE_DAY = 1000 * 60 * 60 * 24;

export function dexieStorageProvider(): Cache & {
  clear: () => Promise<void>;
  list: (
    prefix: string,
  ) => Promise<{ key: string; state: { data?: [{ threads: InitialThread[] }] } }[]>;
} {
  const memoryCache = new Map<string, State<any>>();
  let isInitialized = false;

  // Initialize cache from IndexedDB
  const initializeCache = async () => {
    if (isInitialized) return;

    try {
      const entries = await db.cache.toArray();
      const now = Date.now();

      for (const entry of entries) {
        if (now - entry.timestamp <= ONE_DAY) {
          memoryCache.set(entry.key, entry.state);
        } else {
          // Remove expired entries
          await db.cache.delete(entry.key);
        }
      }

      isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize cache:', error);
      // Clear memory cache on initialization failure
      memoryCache.clear();
    }
  };

  // Initialize cache immediately
  initializeCache().catch(console.error);

  return {
    keys() {
      return memoryCache.keys();
    },

    async list(prefix: string) {
      await initializeCache();
      return db.cache.where('key').startsWith(prefix).toArray();
    },

    get(key: string) {
      return memoryCache.get(key);
    },

    async clear() {
      memoryCache.clear();
      try {
        await db.cache.clear();
      } catch (error) {
        console.error('Failed to clear cache:', error);
      }
    },

    async set(key: string, value: State) {
      // Don't cache promises or undefined data
      if (value.data instanceof Promise || value.data === undefined) return;

      try {
        memoryCache.set(key, value);

        // Update IndexedDB
        await db.cache.put({
          key,
          state: value,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error('Failed to set cache entry:', error);
        // Remove from memory cache if IndexedDB update fails
        memoryCache.delete(key);
      }
    },

    async delete(key: string) {
      try {
        memoryCache.delete(key);
        await db.cache.delete(key);
      } catch (error) {
        console.error('Failed to delete cache entry:', error);
      }
    },
  };
}
