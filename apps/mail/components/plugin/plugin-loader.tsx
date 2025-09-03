import { useEffect } from 'react';
import { pluginManager } from '@/lib/plugin-manager';
import type { Plugin } from '@/types/plugin';
import { trpcClient } from '@/providers/query-provider';

export function PluginLoader() {
  useEffect(() => {
    const loadPlugins = async () => {
      try {
        const { plugins: pluginFiles } = await trpcClient.plugins.list.query();

        const modules = import.meta.glob('/apps/mail/plugins/*.tsx');

        for (const file of pluginFiles) {
          try {
            const moduleKey = `/apps/mail/plugins/${file}`;
            if (moduleKey in modules) {
              const pluginModule = (await modules[moduleKey]()) as { [key: string]: Plugin };
              const plugin: Plugin = Object.values(pluginModule)[0];

              if (plugin && plugin.metadata) {
                await pluginManager.registerPlugin(plugin);
              }
            } else {
              console.error(`Plugin module not found for ${file}`);
            }
          } catch (error) {
            console.error(`Failed to load plugin ${file}:`, error);
          }
        }
      } catch (error) {
        console.error('Failed to load plugins:', error);
      }
    };

    loadPlugins();
  }, []);

  return null;
}
