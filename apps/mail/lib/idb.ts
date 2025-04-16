import type { Cache, State } from "swr";
import Dexie from "dexie";
import { InitialThread } from "@/types";

interface CacheEntry {
  key: string;
  state: State<any>;
  timestamp: number;
}

class SWRDatabase extends Dexie {
  cache!: Dexie.Table<CacheEntry, string>;

  constructor() {
    super("SWRCache");
    this.version(1).stores({
      cache: "key,timestamp",
    });
  }
}

const db = new SWRDatabase();
const ONE_DAY = 1000 * 60 * 60 * 24;

export function dexieStorageProvider(): Cache & { clear: () => void; list: (prefix: string) => Promise<{ key: string, state: { data?: [{ threads: InitialThread[] }] } }[]> } {
  const memoryCache = new Map<string, State<any>>();

  db.cache
    .each((entry) => {
      if (Date.now() - entry.timestamp <= ONE_DAY) {
        memoryCache.set(entry.key, entry.state);
      }
    })
    .catch(console.error);

  return {
    keys() {
      return memoryCache.keys();
    },

    list(prefix: string) {
      return db.cache.where("key").startsWith(prefix).toArray();
    },

    get(key: string) {
      return memoryCache.get(key);
    },

    clear: () => {
      memoryCache.clear();
      db.cache.clear().catch(console.error);
    },

    set(key: string, value: State) {
      // Don't cache promises or undefined data
      if (value.data instanceof Promise || value.data === undefined) return;

      memoryCache.set(key, value);

      // Sync to IndexedDB in the background
      db.cache
        .put({
          key,
          state: value,
          timestamp: Date.now(),
        })
        .catch(console.error);
    },

    delete(key: string) {
      memoryCache.delete(key);

      // Sync to IndexedDB in the background
      db.cache.delete(key).catch(console.error);
    },
  };
}