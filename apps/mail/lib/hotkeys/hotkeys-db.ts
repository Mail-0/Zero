import { Shortcut, keyboardShortcuts } from '@/config/shortcuts';

const DB_NAME = 'hotkeysDB';
const STORE_NAME = 'hotkeys';
const DB_VERSION = 2;

const syncWithServer = async (shortcuts: Shortcut[]): Promise<boolean> => {
  try {
    const response = await fetch('/api/v1/hotkeys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shortcuts),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Failed to sync hotkeys with server:', error);
    return false;
  }
};

const fetchServerHotkeys = async (): Promise<Shortcut[] | null> => {
  try {
    const response = await fetch('/api/v1/hotkeys');
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch hotkeys from server:', error);
    return null;
  }
};

let serverHotkeysLoaded = false;

class HotkeysDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      };

      request.onsuccess = async () => {
        this.db = request.result;
        if (!serverHotkeysLoaded) {
          serverHotkeysLoaded = true;
          const serverHotkeys = await fetchServerHotkeys();
          if (serverHotkeys?.length) {
            const mergedHotkeys = this.mergeWithDefaults(serverHotkeys);
            await this.saveAllHotkeys(mergedHotkeys, false);
          } else {
            await this.initializeDefaultShortcuts();
          }
        }
        resolve();
      };
    });
  }

  private mergeWithDefaults(shortcuts: Shortcut[]): Shortcut[] {
    const shortcutMap = new Map(shortcuts.map((s) => [s.action, s]));

    keyboardShortcuts.forEach((defaultShortcut) => {
      if (!shortcutMap.has(defaultShortcut.action)) {
        shortcutMap.set(defaultShortcut.action, defaultShortcut);
      }
    });

    return Array.from(shortcutMap.values());
  }

  private async initializeDefaultShortcuts(): Promise<void> {
    await this.saveAllHotkeys(keyboardShortcuts, true);
  }

  async saveHotkey(shortcut: Shortcut): Promise<void> {
    const allHotkeys = await this.getAllHotkeys();
    const updatedHotkeys = allHotkeys.map((s) => (s.action === shortcut.action ? shortcut : s));

    if (!allHotkeys.some((s) => s.action === shortcut.action)) {
      updatedHotkeys.push(shortcut);
    }

    await this.saveAllHotkeys(updatedHotkeys, true);
  }

  async getHotkey(action: string): Promise<Shortcut | undefined> {
    const allHotkeys = await this.getAllHotkeys();
    return allHotkeys.find((s) => s.action === action);
  }

  async getAllHotkeys(): Promise<Shortcut[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('shortcuts');

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const data = request.result;
        resolve(data?.shortcuts || []);
      };
    });
  }

  private async saveAllHotkeys(shortcuts: Shortcut[], shouldSync: boolean = true): Promise<void> {
    if (!this.db) await this.init();
    return new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = async () => {
        if (shouldSync && serverHotkeysLoaded) {
          await syncWithServer(shortcuts);
        }
        resolve();
      };

      store.clear();
      store.put({ id: 'shortcuts', shortcuts });
    });
  }
}

export const hotkeysDB = new HotkeysDB();
