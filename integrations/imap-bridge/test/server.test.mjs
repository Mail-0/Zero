import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Vault, keyFromHex } from '../src/core.mjs';
import { Bridge, createHttpServer } from '../src/server.mjs';
async function fixture(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'zero-http-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const vault = new Vault(dir, keyFromHex('12'.repeat(32)));
  const mail = { verify: async () => {}, getFolders: async () => [], sanitize: (s) => s, ...options.mail };
  const bridge = new Bridge({ vault, mail, allowedAiOrigins: ['https://ai.example.com'], ...options });
  return { vault, bridge, mail };
}
test('account registration stores secrets but returns only public metadata', async (t) => {
  const { bridge, vault } = await fixture(t);
  const created = await bridge.call('user-a', 'accounts.add', { email: 'a@qq.com', preset: 'qq', password: 'secret-code' });
  assert.equal(created.email, 'a@qq.com'); assert.equal(created.password, undefined);
  assert.equal((await vault.get('user-a', 'account', created.id)).password, 'secret-code');
  assert.equal((await bridge.call('user-a', 'accounts.list')).length, 1);
  assert.deepEqual(await bridge.call('user-b', 'accounts.list'), []);
  await assert.rejects(bridge.call('user-b', 'mail.folders', { accountId: created.id }), (e) => e.code === 'ACCOUNT_NOT_FOUND');
});
test('failed account verification never saves credentials', async (t) => {
  const { bridge } = await fixture(t, { mail: { verify: async () => { throw Error('bad-auth'); } } });
  await assert.rejects(bridge.call('u', 'accounts.add', { email: 'a@qq.com', preset: 'qq', password: 'secret' }));
  assert.deepEqual(await bridge.call('u', 'accounts.list'), []);
});
test('disconnect removes only the authenticated owners account', async (t) => {
  const { bridge, vault } = await fixture(t);
  const a = await bridge.call('u', 'accounts.add', { email: 'a@qq.com', preset: 'qq', password: 'secret' });
  await assert.rejects(bridge.call('v', 'accounts.remove', { accountId: a.id }));
  await bridge.call('u', 'accounts.remove', { accountId: a.id });
  assert.deepEqual(await bridge.call('u', 'accounts.list'), []);
  assert.equal(await vault.get('u', 'account', a.id), null);
});
test('BYOK settings never return the key; empty key is allowed for local providers', async (t) => {
  const { bridge, vault } = await fixture(t);
  await bridge.call('u', 'ai.configure', { baseUrl: 'https://ai.example.com/v1', model: 'my-model', apiKey: 'secret-key' });
  const saved = await bridge.call('u', 'ai.settings');
  assert.equal(saved.hasKey, true); assert.equal(saved.apiKey, undefined);
  await bridge.call('u', 'ai.configure', { baseUrl: saved.baseUrl, model: 'new-model' });
  assert.equal((await vault.get('u', 'ai', 'settings')).apiKey, 'secret-key');
  await bridge.call('u', 'ai.remove'); assert.equal((await bridge.call('u', 'ai.settings')).hasKey, false);
});
test('AI requires explicit consent and ignores user-supplied owner IDs', async (t) => {
  let called = 0; const { bridge } = await fixture(t, { fetchImpl: async () => { called++; return Response.json({ choices: [{ message: { content: 'Draft' } }] }); } });
  await bridge.call('u', 'ai.configure', { baseUrl: 'https://ai.example.com/v1', model: 'm', apiKey: 'secret' });
  await assert.rejects(bridge.call('u', 'ai.generate', { task: 'compose', instructions: 'hi' }), (e) => e.code === 'CONSENT_REQUIRED');
  await assert.rejects(bridge.call('v', 'ai.generate', { task: 'compose', instructions: 'hi', consent: true, ownerId: 'u' }), (e) => e.code === 'AI_NOT_CONFIGURED');
  assert.equal(called, 0);
  const result = await bridge.call('u', 'ai.generate', { task: 'compose', instructions: 'hi', consent: true });
  assert.equal(result.text, 'Draft'); assert.equal(called, 1);
});
test('AI calls use configured origin, disable redirects, and have no tool access', async (t) => {
  const { bridge } = await fixture(t, { fetchImpl: async (url, options) => {
    assert.equal(url, 'https://ai.example.com/v1/chat/completions');
    assert.equal(options.redirect, 'error'); assert.equal(options.headers.Authorization, 'Bearer secret');
    const body = JSON.parse(options.body); assert.equal(body.tools, undefined);
    assert.equal(body.model, 'm'); assert.equal(body.stream, false);
    return Response.json({ choices: [{ message: { content: 'Draft' } }] });
  } });
  await bridge.call('u', 'ai.configure', { baseUrl: 'https://ai.example.com/v1', model: 'm', apiKey: 'secret' });
  await bridge.call('u', 'ai.generate', { task: 'compose', instructions: 'hi', consent: true });
});
test('HTTP RPC authenticates, validates body limits, and redacts upstream errors', async (t) => {
  const secret = 's'.repeat(32);
  const server = createHttpServer({ secret, maxBody: 200, bridge: { call: async (_owner, action) => {
    if (action === 'fail') throw Error('password=NEVER-RETURN'); return { success: true };
  } } });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body, token = secret) => fetch(base + '/rpc', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await fetch(base + '/healthz')).status, 200);
  assert.equal((await post({}, 'wrong')).status, 401);
  assert.equal((await post({ ownerId: 'u', action: 'okay' })).status, 200);
  const error = await post({ ownerId: 'u', action: 'fail' });
  assert.equal(error.status, 502); assert.ok(!(await error.text()).includes('NEVER-RETURN'));
  assert.equal((await post({ payload: 'x'.repeat(300) })).status, 413);
});
