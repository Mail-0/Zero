import path from 'path';
import fs from 'fs';

// Get paths
const appDir = path.resolve(__dirname, '..');
const nodeModulesDir = path.join(appDir, 'node_modules');
const workerPath = path.join(nodeModulesDir, 'pdfjs-dist/build/pdf.worker.mjs');

// Next.js public directory for static files
const publicDir = path.join(appDir, 'public');
const destPath = path.join(publicDir, 'pdf.worker.mjs');

// Ensure public directory exists for Next.js static file serving
if (!fs.existsSync(publicDir)) {
  console.log('Creating Next.js public directory for static files...');
  fs.mkdirSync(publicDir, { recursive: true });
}

// Copy the worker file to public directory for browser access
try {
  if (!fs.existsSync(workerPath)) {
    throw new Error(`PDF.js worker not found in node_modules: ${workerPath}`);
  }
  
  fs.copyFileSync(workerPath, destPath);
  console.log('✅ PDF.js worker copied to Next.js public directory');
  console.log(`Source: ${workerPath}`);
  console.log(`Destination: ${destPath}`);
  console.log('Worker will be available at: /pdf.worker.mjs');
} catch (error) {
  console.error('Failed to copy PDF.js worker:', error);
  process.exit(1);
}