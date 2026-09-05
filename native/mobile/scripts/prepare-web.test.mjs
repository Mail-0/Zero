import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareWeb } from './prepare-web.mjs';
async function fixture(t) {
  const base = await mkdtemp(join(tmpdir(), 'zero-native-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const source = join(base, 'source'), target = join(base, 'target');
  await mkdir(source); return { source, target };
}
test('copies built SPA assets and preserves index', async (t) => {
  const { source, target } = await fixture(t);
  await writeFile(join(source, 'index.html'), '<html>SPA</html>');
  await prepareWeb(source, target, {});
  assert.equal(await readFile(join(target, 'index.html'), 'utf8'), '<html>SPA</html>');
});
test('uses SPA fallback when root was prerendered', async (t) => {
  const { source, target } = await fixture(t);
  await writeFile(join(source, 'index.html'), '<html>Landing page</html>');
  await writeFile(join(source, '__spa-fallback.html'), '<html>Generic SPA</html>');
  await prepareWeb(source, target, {});
  assert.equal(await readFile(join(target, 'index.html'), 'utf8'), '<html>Generic SPA</html>');
});
test('fails for missing assets and refuses remote server.url', async (t) => {
  const { source, target } = await fixture(t);
  await assert.rejects(prepareWeb(source, target, {}), /assets are missing/);
  await assert.rejects(prepareWeb(source, target, { server: { url: 'https://example.com' } }), /Remote production/);
});
test('cannot remove the source by choosing its parent as target', async (t) => {
  const { source } = await fixture(t);
  await writeFile(join(source, 'index.html'), '<html>SPA</html>');
  await assert.rejects(prepareWeb(source, join(source, '..'), {}), /Unsafe/);
  await assert.rejects(prepareWeb(source, join(source, 'nested'), {}), /Unsafe/);
});
