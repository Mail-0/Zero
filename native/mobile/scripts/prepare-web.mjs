import { access, cp, mkdir, readFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function prepareWeb(source, target, config) {
  if (config.server?.url || config.server?.allowNavigation?.length) throw Error('Remote production WebView URLs/navigation allowlists are not allowed by this build scaffold.');
  const index = resolve(source, 'index.html');
  try { await access(index); } catch { throw Error('Web assets are missing. Build @zero/mail before preparing the native shell.'); }
  const html = await readFile(index, 'utf8');
  if (!/<html[\s>]/i.test(html)) throw Error('Invalid web build: index.html is not HTML.');
  const destination = resolve(target), origin = resolve(source);
  if (destination === origin || origin.startsWith(destination + '/') || destination.startsWith(origin + '/')) throw Error('Unsafe web asset output directory.');
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await cp(source, destination, { recursive: true });
  // If / was pre-rendered, Capacitor must get the generic SPA fallback rather than the landing page.
  try { await access(resolve(source, '__spa-fallback.html')); await cp(resolve(source, '__spa-fallback.html'), resolve(destination, 'index.html')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const config = JSON.parse(await readFile(resolve(root, 'capacitor.config.json'), 'utf8'));
  await prepareWeb(resolve(root, '../../apps/mail/build/client'), resolve(root, 'www'), config);
  console.info('Copied static web assets. This does not implement native OAuth, secure token storage, push notifications, or offline sync.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
