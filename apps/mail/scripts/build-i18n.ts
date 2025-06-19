#!/usr/bin/env tsx
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { gzipSync } from 'zlib';
import { locales, defaultLocale } from '../i18n/config';

interface TranslationBundle {
  locale: string;
  messages: Record<string, any>;
  size: number;
  gzipSize: number;
}

// Pre-compile and optimize translations at build time
async function buildI18nBundles() {
  const localesDir = join(process.cwd(), 'locales');
  const outputDir = join(process.cwd(), 'build/i18n');
  
  mkdirSync(outputDir, { recursive: true });
  
  // Load base locale
  const baseMessages = JSON.parse(
    readFileSync(join(localesDir, `${defaultLocale}.json`), 'utf-8')
  );
  
  const bundles: TranslationBundle[] = [];
  
  for (const locale of locales) {
    const localeMessages = JSON.parse(
      readFileSync(join(localesDir, `${locale}.json`), 'utf-8')
    );
    
    // Only include differences from base locale for non-default locales
    const optimizedMessages = locale === defaultLocale 
      ? localeMessages 
      : createDiffBundle(baseMessages, localeMessages);
    
    const bundle = JSON.stringify(optimizedMessages);
    const gzipped = gzipSync(bundle);
    
    // Write optimized bundle
    writeFileSync(
      join(outputDir, `${locale}.json`), 
      bundle
    );
    
    // Write gzipped version
    writeFileSync(
      join(outputDir, `${locale}.json.gz`), 
      gzipped
    );
    
    bundles.push({
      locale,
      messages: optimizedMessages,
      size: Buffer.byteLength(bundle),
      gzipSize: gzipped.length
    });
  }
  
  // Generate manifest with bundle info
  writeFileSync(
    join(outputDir, 'manifest.json'),
    JSON.stringify({
      bundles: bundles.map(({ locale, size, gzipSize }) => ({
        locale,
        size,
        gzipSize,
        url: `/i18n/${locale}.json`
      })),
      generatedAt: new Date().toISOString()
    }, null, 2)
  );
  
  console.log('Generated i18n bundles:');
  bundles.forEach(b => {
    console.log(`  ${b.locale}: ${(b.size / 1024).toFixed(1)}KB (${(b.gzipSize / 1024).toFixed(1)}KB gzipped)`);
  });
}

function createDiffBundle(base: any, target: any): any {
  const diff: any = {};
  
  for (const [key, value] of Object.entries(target)) {
    if (typeof value === 'object' && value !== null) {
      const nestedDiff = createDiffBundle(base[key] || {}, value);
      if (Object.keys(nestedDiff).length > 0) {
        diff[key] = nestedDiff;
      }
    } else if (base[key] !== value) {
      diff[key] = value;
    }
  }
  
  return diff;
}

buildI18nBundles().catch(console.error);
