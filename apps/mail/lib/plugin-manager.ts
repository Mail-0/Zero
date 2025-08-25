import type {
  Plugin,
  PluginHook,
  UIExtensionPoint,
  EmailDriver,
  AuthProvider,
  PluginDataStorage,
} from '@/types/plugin';
import { getPluginData, setPluginData, deletePluginData } from '@/actions/plugin-data';
import { getPluginSettings, setPluginSettings } from '@/actions/plugin-settings';

class PluginManager {
  private static instance: PluginManager;
  private plugins: Map<string, Plugin>;
  private hooks: Map<string, PluginHook[]>;
  private uiExtensions: Map<string, UIExtensionPoint[]>;
  private emailDrivers: Map<string, EmailDriver>;
  private authProviders: Map<string, AuthProvider>;
  private enabledStates: Map<string, { enabled: boolean; added: boolean }>;

  private constructor() {
    this.plugins = new Map();
    this.hooks = new Map();
    this.uiExtensions = new Map();
    this.emailDrivers = new Map();
    this.authProviders = new Map();
    this.enabledStates = new Map();
  }

  public static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager();
    }
    return PluginManager.instance;
  }

  private createPluginStorage(pluginId: string): PluginDataStorage {
    return {
      get: async <T>(key: string) => {
        const data = await getPluginData(pluginId, key);
        return data as T | null;
      },
      set: async <T>(key: string, data: T) => {
        await setPluginData(pluginId, key, data);
      },
      delete: async (key: string) => {
        await deletePluginData(pluginId, key);
      },
    };
  }

  public async registerPlugin(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.metadata.id)) {
      throw new Error(`Plugin with ID ${plugin.metadata.id} is already registered`);
    }

    const storage = this.createPluginStorage(plugin.metadata.id);
    plugin.storage = storage;

    this.plugins.set(plugin.metadata.id, plugin);

    const settings = await getPluginSettings(plugin.metadata.id);
    this.enabledStates.set(plugin.metadata.id, settings);

    if (settings.enabled) {
      await this.registerPluginExtensions(plugin);
      await plugin.onActivate?.(storage);
    }
  }

  public async unregisterPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin with ID ${pluginId} is not registered`);
    }

    await plugin.onDeactivate?.();

    if (plugin.hooks) {
      plugin.hooks.forEach((hook) => {
        const existingHooks = this.hooks.get(hook.event) || [];
        this.hooks.set(
          hook.event,
          existingHooks.filter((h) => h !== hook),
        );
      });
    }

    if (plugin.uiExtensions) {
      plugin.uiExtensions.forEach((extension) => {
        const existingExtensions = this.uiExtensions.get(extension.location) || [];
        this.uiExtensions.set(
          extension.location,
          existingExtensions.filter((e) => e !== extension),
        );
      });
    }

    if (plugin.emailDrivers) {
      plugin.emailDrivers.forEach((driver) => {
        this.emailDrivers.delete(driver.id);
      });
    }

    if (plugin.authProviders) {
      plugin.authProviders.forEach((provider) => {
        this.authProviders.delete(provider.id);
      });
    }

    this.plugins.delete(pluginId);
  }

  public async executeHook(event: string, ...args: any[]): Promise<void> {
    const hooks = this.hooks.get(event) || [];
    for (const hook of hooks) {
      await hook.handler(...args);
    }
  }

  public getUIExtensions(location: string): UIExtensionPoint[] {
    return this.uiExtensions.get(location) || [];
  }

  public getEmailDriver(id: string): EmailDriver | undefined {
    return this.emailDrivers.get(id);
  }

  public getAuthProvider(id: string): AuthProvider | undefined {
    return this.authProviders.get(id);
  }

  public getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  public getAllEmailDrivers(): EmailDriver[] {
    return Array.from(this.emailDrivers.values());
  }

  public getAllAuthProviders(): AuthProvider[] {
    return Array.from(this.authProviders.values());
  }

  public isPluginEnabled(pluginId: string): boolean {
    return this.enabledStates.get(pluginId)?.enabled ?? true;
  }

  public isPluginAdded(pluginId: string): boolean {
    return this.enabledStates.get(pluginId)?.added ?? false;
  }

  public async setPluginEnabled(pluginId: string, enabled: boolean): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin with ID ${pluginId} is not registered`);
    }

    const currentlyEnabled = this.isPluginEnabled(pluginId);
    if (enabled !== currentlyEnabled) {
      if (enabled) {
        await this.registerPluginExtensions(plugin);
        if (plugin.storage) {
          await plugin.onActivate?.(plugin.storage);
        }
      } else {
        await plugin.onDeactivate?.();
        await this.unregisterPluginExtensions(plugin);
      }

      this.enabledStates.set(pluginId, { enabled, added: this.isPluginAdded(pluginId) });
      await setPluginSettings(pluginId, enabled);
    }
  }

  public async setPluginOption(pluginId: string, key: string, value: any): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin with ID ${pluginId} is not registered`);
    }

    if (!plugin.options || !(key in plugin.options)) {
      throw new Error(`Option ${key} is not defined in plugin ${pluginId}`);
    }

    const option = plugin.options[key];
    if (!option) {
      throw new Error(`Option ${key} is not properly configured in plugin ${pluginId}`);
    }

    if (option.field.required && (value === null || value === undefined)) {
      throw new Error(`Option ${key} is required`);
    }

    if (option.field.validation) {
      const { validation } = option.field;

      if (validation.pattern && typeof value === 'string') {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
          throw new Error(validation.message || `Invalid format for ${key}`);
        }
      }

      if (typeof value === 'number') {
        if (validation.min !== undefined && value < validation.min) {
          throw new Error(`${key} must be at least ${validation.min}`);
        }
        if (validation.max !== undefined && value > validation.max) {
          throw new Error(`${key} must be at most ${validation.max}`);
        }
      }
    }

    option.value = value;

    if (plugin.storage) {
      const storageKey = `option:${key}`;
      await plugin.storage.set(storageKey, value);
    }
  }

  private async loadPluginOptions(plugin: Plugin): Promise<void> {
    if (!plugin.options || !plugin.storage) return;

    for (const [key, option] of Object.entries(plugin.options)) {
      const storageKey = `option:${key}`;
      const savedValue = await plugin.storage.get(storageKey);
      if (savedValue !== null) {
        option.value = savedValue;
      } else if (option.field.defaultValue !== undefined) {
        option.value = option.field.defaultValue;
        await plugin.storage.set(storageKey, option.field.defaultValue);
      }
    }
  }

  private async registerPluginExtensions(plugin: Plugin): Promise<void> {
    await this.loadPluginOptions(plugin);

    if (plugin.hooks) {
      plugin.hooks.forEach((hook) => {
        const existingHooks = this.hooks.get(hook.event) || [];
        existingHooks.push(hook);
        existingHooks.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        this.hooks.set(hook.event, existingHooks);
      });
    }

    if (plugin.uiExtensions) {
      plugin.uiExtensions.forEach((extension) => {
        const existingExtensions = this.uiExtensions.get(extension.location) || [];
        existingExtensions.push(extension);
        existingExtensions.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        this.uiExtensions.set(extension.location, existingExtensions);
      });
    }

    if (plugin.emailDrivers) {
      plugin.emailDrivers.forEach((driver) => {
        this.emailDrivers.set(driver.id, driver);
      });
    }

    if (plugin.authProviders) {
      plugin.authProviders.forEach((provider) => {
        this.authProviders.set(provider.id, provider);
      });
    }
  }

  private async unregisterPluginExtensions(plugin: Plugin): Promise<void> {
    if (plugin.hooks) {
      plugin.hooks.forEach((hook) => {
        const existingHooks = this.hooks.get(hook.event) || [];
        this.hooks.set(
          hook.event,
          existingHooks.filter((h) => h !== hook),
        );
      });
    }

    if (plugin.uiExtensions) {
      plugin.uiExtensions.forEach((extension) => {
        const existingExtensions = this.uiExtensions.get(extension.location) || [];
        this.uiExtensions.set(
          extension.location,
          existingExtensions.filter((e) => e !== extension),
        );
      });
    }

    if (plugin.emailDrivers) {
      plugin.emailDrivers.forEach((driver) => {
        this.emailDrivers.delete(driver.id);
      });
    }

    if (plugin.authProviders) {
      plugin.authProviders.forEach((provider) => {
        this.authProviders.delete(provider.id);
      });
    }
  }
}

export const pluginManager = PluginManager.getInstance();
