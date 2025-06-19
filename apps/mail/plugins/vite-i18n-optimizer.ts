import type { Plugin } from 'vite';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { gzipSync } from 'zlib';

export function i18nOptimizerPlugin(): Plugin {
  const generateHash = (content: string): string => {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  };

  const generateI18nManifest = (): string => {
    const localesDir = join(process.cwd(), 'locales');
    const manifest = {
      version: '1.0.0',
      generated: new Date().toISOString(),
      bundles: [] as any[]
    };
    
    // Generate bundle info
    const localeFiles = readdirSync(localesDir);
    localeFiles.forEach((file: string) => {
      if (file.endsWith('.json')) {
        const locale = file.replace('.json', '');
        const content = readFileSync(join(localesDir, file), 'utf-8');
        const gzipped = gzipSync(content);
        
        manifest.bundles.push({
          locale,
          size: Buffer.byteLength(content),
          gzipSize: gzipped.length,
          hash: generateHash(content)
        });
      }
    });
    
    return JSON.stringify(manifest, null, 2);
  };

  const optimizeI18nImports = (code: string): string => {
    // Replace import.meta.glob with precompiled bundles
    return code.replace(
      /import\.meta\.glob\(['"]\.\.\/locales\/\*\.json['"]\)/g,
      'precompiledBundles'
    );
  };

  return {
    name: 'i18n-optimizer',
    buildStart() {
      // Pre-process translations during build
      this.emitFile({
        type: 'asset',
        fileName: 'i18n-manifest.json',
        source: generateI18nManifest()
      });
    },
    generateBundle(options: any, bundle: any) {
      // Optimize i18n imports in the bundle
      Object.keys(bundle).forEach(key => {
        const chunk = bundle[key];
        if (chunk.type === 'chunk' && chunk.code.includes('import.meta.glob')) {
          // Replace dynamic imports with static ones where possible
          chunk.code = optimizeI18nImports(chunk.code);
        }
      });
    }
  };
}
