#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const LOCALES_DIR = path.join(rootDir, 'apps', 'mail', 'locales');
const OUTPUT_DIR = path.join(rootDir, 'apps', 'mail', 'build', 'i18n');
const DEFAULT_LOCALE = 'en';

// Simple deep merge function
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

function createHash(content) {
  // Simple hash function for cache busting
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

function loadLocaleFile(locale) {
  const filePath = path.join(LOCALES_DIR, `${locale}.json`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Locale file not found: ${filePath}`);
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse locale file ${filePath}: ${error}`);
  }
}

function precompileLocales() {
  console.log('🌐 Pre-compiling i18n locales...');
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Find all locale files
  const localeFiles = fs.readdirSync(LOCALES_DIR).filter(f => f.endsWith('.json'));
  const locales = localeFiles.map(file => file.replace('.json', ''));
  
  console.log(`Found ${locales.length} locales: ${locales.join(', ')}`);
  
  // Load default locale
  const defaultMessages = loadLocaleFile(DEFAULT_LOCALE);
  
  const manifest = {
    bundles: [],
    timestamp: Date.now(),
    version: process.env.npm_package_version || '1.0.0'
  };
  
  // Process each locale
  for (const locale of locales) {
    console.log(`Processing locale: ${locale}`);
    
    let finalMessages;
    
    if (locale === DEFAULT_LOCALE) {
      // For default locale, use as-is
      finalMessages = defaultMessages;
    } else {
      // For other locales, merge with default
      const localeMessages = loadLocaleFile(locale);
      finalMessages = deepMerge(defaultMessages, localeMessages);
    }
    
    // Serialize and write the pre-merged locale
    const content = JSON.stringify(finalMessages, null, 0); // No formatting for smaller size
    const outputPath = path.join(OUTPUT_DIR, `${locale}.json`);
    
    fs.writeFileSync(outputPath, content, 'utf-8');
    
    // Add to manifest
    manifest.bundles.push({
      locale,
      size: content.length,
      hash: createHash(content)
    });
    
    console.log(`✅ ${locale}: ${(content.length / 1024).toFixed(1)}KB`);
  }
  
  // Write manifest
  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  
  console.log(`📄 Manifest written to ${manifestPath}`);
  console.log(`🎉 Pre-compiled ${manifest.bundles.length} locales to ${OUTPUT_DIR}`);
  
  return manifest;
}

// Run the build process
try {
  precompileLocales();
  process.exit(0);
} catch (error) {
  console.error('❌ Failed to pre-compile locales:', error);
  process.exit(1);
}
