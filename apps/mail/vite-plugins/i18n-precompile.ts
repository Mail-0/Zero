import type { Plugin } from 'vite';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

interface I18nPrecompileOptions {
  /**
   * Whether to run the precompilation during development
   * @default false
   */
  runInDev?: boolean;
  
  /**
   * Path to the build script
   * @default '../../scripts/build-i18n.mjs'
   */
  scriptPath?: string;
}

export function i18nPrecompile(options: I18nPrecompileOptions = {}): Plugin {
  const {
    runInDev = false,
    scriptPath = '../../scripts/build-i18n.mjs'
  } = options;
  
  let hasRun = false;
  
  return {
    name: 'i18n-precompile',
    
    buildStart() {
      // Only run in production builds or if explicitly enabled for dev
      if (hasRun || (!runInDev && process.env.NODE_ENV === 'development')) {
        return;
      }
      
      console.log('Pre-compiling i18n locales...');
      
      try {
        // Check if build script exists
        const fullScriptPath = join(process.cwd(), scriptPath);
        if (!existsSync(fullScriptPath)) {
          throw new Error(`Build script not found: ${fullScriptPath}`);
        }
        
        // Execute the build script
        execSync(`node ${fullScriptPath}`, {
          stdio: 'inherit',
          cwd: process.cwd()
        });
        
        hasRun = true;
        console.log('✅ i18n locales pre-compiled successfully');
        
      } catch (error) {
        console.error(`Failed to pre-compile i18n locales: ${error}`);
        throw error;
      }
    },
    
    // Watch for changes in locale files during development
    configureServer(server) {
      if (!runInDev) return;
      
      server.watcher.add('apps/mail/locales/*.json');
      
      server.watcher.on('change', (path) => {
        if (path.includes('/locales/') && path.endsWith('.json')) {
          console.log('Locale file changed, recompiling...');
          hasRun = false; // Reset flag to allow recompilation
        }
      });
    }
  };
}
