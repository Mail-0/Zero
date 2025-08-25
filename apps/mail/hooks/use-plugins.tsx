import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Plugin, UIExtensionPoint } from '@/types/plugin';
import { pluginManager } from '@/lib/plugin-manager';

interface PluginContextType {
  plugins: Plugin[];
  getUIExtensions: (location: string) => UIExtensionPoint[];
  togglePlugin: (pluginId: string) => Promise<void>;
}

const PluginContext = createContext<PluginContextType | undefined>(undefined);

export function PluginProvider({ children }: { children: ReactNode }) {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [enabledPlugins, setEnabledPlugins] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadPlugins = () => {
      const allPlugins = pluginManager.getAllPlugins();
      setPlugins(allPlugins);

      const enabled = new Set(
        allPlugins
          .filter((plugin) => pluginManager.isPluginEnabled(plugin.metadata.id))
          .map((plugin) => plugin.metadata.id),
      );
      setEnabledPlugins(enabled);
    };

    loadPlugins();
    const interval = setInterval(loadPlugins, 1000);
    return () => clearInterval(interval);
  }, []);

  const getUIExtensions = useCallback(
    (location: string) => {
      const extensions = pluginManager.getUIExtensions(location);
      return extensions.filter((ext) => {
        // Find the plugin that owns this extension
        const plugin = plugins.find((p) => p.uiExtensions?.some((e) => e === ext));
        return plugin && enabledPlugins.has(plugin.metadata.id);
      });
    },
    [plugins, enabledPlugins],
  );

  const togglePlugin = useCallback(async (pluginId: string) => {
    try {
      // Use plugin manager to toggle the enabled state
      const isCurrentlyEnabled = enabledPlugins.has(pluginId);
      await pluginManager.setPluginEnabled(pluginId, !isCurrentlyEnabled);

      setEnabledPlugins((prev) => {
        const next = new Set(prev);
        if (next.has(pluginId)) {
          next.delete(pluginId);
        } else {
          next.add(pluginId);
        }
        return next;
      });
    } catch (error) {
      console.error('Error toggling plugin:', error);
      throw error;
    }
  }, [enabledPlugins]);

  const value = {
    plugins,
    getUIExtensions,
    togglePlugin,
  };

  return <PluginContext.Provider value={value}>{children}</PluginContext.Provider>;
}

export function usePlugins() {
  const context = useContext(PluginContext);
  if (context === undefined) {
    throw new Error('usePlugins must be used within a PluginProvider');
  }
  return context;
}
