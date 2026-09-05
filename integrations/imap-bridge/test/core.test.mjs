import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Vault, seal, unseal, keyFromHex, validateAccount, authorized, messageId, parseMessageId,
  pageUids, aiEndpoint, dispatchOnce, headerText } from '../src/core.mjs';

const key = keyFromHex('42'.repeat(32));
export async function vaultFixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'zero-bridge-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return new Vault(dir, key);
}
const rejectsCode = (code) => (error) => error.code === code;
test('AES-GCM roundtrip and randomized nonce', () => {
  const a = seal({ password: 'auth-code' }, key, 'user-a');
  assert.deepEqual(unseal(a, key, 'user-a'), { password: 'auth-code' });
  assert.notEqual(a, seal({ password: 'auth-code' }, key, 'user-a'));
  assert.ok(!a.includes('auth-code'));
});
test('AES-GCM rejects tampering, wrong owner, and wrong key', () => {
  const a = seal({ password: 'auth-code' }, key, 'user-a');
  assert.throws(() => unseal(a, key, 'user-b'));
  assert.throws(() => unseal(a, keyFromHex('41'.repeat(32)), 'user-a'));
  const obj = JSON.parse(a); obj.data = Buffer.from('tampered').toString('base64');
  assert.throws(() => unseal(JSON.stringify(obj), key, 'user-a'));
});
test('invalid encryption keys fail closed', () => {
  for (const candidate of ['', 'abc', 'z'.repeat(64), undefined]) assert.throws(() => keyFromHex(candidate));
});
test('bearer comparison accepts exactly the configured secret', () => {
  assert.equal(authorized('Bearer secret', 'secret'), true);
  for (const input of [undefined, 'secret', 'Bearer secreu', 'Bearer secret ']) assert.equal(authorized(input, 'secret'), false);
});
test('QQ/163 presets use TLS and support authorization codes', () => {
  for (const preset of ['qq', '163', '126', 'icloud']) {
    const result = validateAccount({ preset, email: 'a@example.com', password: 'app-auth-code' });
    assert.equal(result.imapPort, 993); assert.equal(result.password, 'app-auth-code');
    assert.ok([465, 587].includes(result.smtpPort));
    assert.equal(result.saveSent, false);
  }
});
test('custom hosts require explicit operator allowlist and reject plaintext ports', () => {
  const input = { preset: 'custom', email: 'a@example.com', password: 'code', imapHost: 'mail.example.com', smtpHost: 'mail.example.com' };
  assert.throws(() => validateAccount(input), rejectsCode('HOST_NOT_ALLOWED'));
  assert.equal(validateAccount(input, ['mail.example.com']).imapHost, 'mail.example.com');
  assert.throws(() => validateAccount({ ...input, imapPort: 143 }, ['mail.example.com']));
  assert.throws(() => validateAccount({ ...input, smtpPort: 25 }, ['mail.example.com']));
});
test('header values and addresses reject CRLF', () => {
  assert.throws(() => headerText('ok\r\nBcc: other@example.com', 'subject'));
  assert.throws(() => validateAccount({ preset: 'qq', email: 'a@example.com\r\n', password: 'code' }));
});
test('message IDs roundtrip Unicode folders and UIDVALIDITY', () => {
  assert.deepEqual(parseMessageId(messageId('收件夹/归档', '42', 900)), { folder: '收件夹/归档', validity: '42', uid: 900 });
});
test('message IDs reject malformed, invalid UID, and injected folder names', () => {
  for (const id of ['?', messageId('INBOX', '0', 1), messageId('INBOX', '42', 0), messageId('INBOX', '42', 4294967296), messageId('x\r\n', '42', 1)]) {
    assert.throws(() => parseMessageId(id));
  }
});
test('keyset pagination survives expunges and filters duplicates', () => {
  assert.deepEqual(pageUids([9, 2, 6, 9, 4], null, 2), { selected: [9, 6], hasMore: true });
  assert.deepEqual(pageUids([10, 9, 4, 2], 6, 2), { selected: [4, 2], hasMore: false });
  assert.throws(() => pageUids([1], null, 100));
});
test('AI URLs require exact allowed origin and never include credentials/query', () => {
  assert.equal(aiEndpoint('https://llm.example.com/v1', ['https://llm.example.com']), 'https://llm.example.com/v1/chat/completions');
  assert.throws(() => aiEndpoint('https://llm.example.com.evil/v1', ['https://llm.example.com']));
  assert.throws(() => aiEndpoint('https://secret@llm.example.com/v1', ['https://llm.example.com']));
  assert.throws(() => aiEndpoint('https://llm.example.com/v1?key=secret', ['https://llm.example.com']));
  assert.throws(() => aiEndpoint('http://localhost:11434/v1', []));
  assert.equal(aiEndpoint('http://ollama:11434/v1', ['http://ollama:11434']), 'http://ollama:11434/v1/chat/completions');
});
test('vault isolates owners, hides plaintext, and creates restrictive files', async (t) => {
  const vault = await vaultFixture(t);
  await vault.put('u1', 'account', '../a', { password: 'TOP-SECRET' });
  assert.deepEqual(await vault.get('u1', 'account', '../a'), { password: 'TOP-SECRET' });
  assert.equal(await vault.get('u2', 'account', '../a'), null);
  const path = vault.filename('u1', 'account', '../a').path;
  assert.ok(path.startsWith(vault.directory));
  assert.ok(!(await readFile(path, 'utf8')).includes('TOP-SECRET'));
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  await vault.remove('u1', 'account', '../a');
  assert.equal(await vault.get('u1', 'account', '../a'), null);
});
test('per-key mutex serializes operations and releases after rejection', async (t) => {
  const vault = await vaultFixture(t); const seen = [];
  await Promise.allSettled([
    vault.exclusive('x', async () => { seen.push(1); await new Promise((r) => setTimeout(r, 5)); throw Error('fail'); }),
    vault.exclusive('x', async () => { seen.push(2); }),
  ]);
  assert.deepEqual(seen, [1, 2]); assert.equal(vault.locks.size, 0);
});
test('SMTP duplicate requests replay one durable result, including after restart', async (t) => {
  const vault = await vaultFixture(t); let sent = 0;
  const invoke = () => dispatchOnce(vault, 'u', 'a', 'operation-12345678', { subject: 'x' }, async () => ({ id: String(++sent) }));
  const results = await Promise.all([invoke(), invoke()]);
  assert.equal(sent, 1); assert.equal(results[1].replayed, true);
  const restarted = new Vault(vault.directory, key);
  assert.equal((await dispatchOnce(restarted, 'u', 'a', 'operation-12345678', { subject: 'x' }, () => { throw Error('must not send'); })).id, '1');
});
test('SMTP operation ID cannot be reused for a different message', async (t) => {
  const vault = await vaultFixture(t);
  await dispatchOnce(vault, 'u', 'a', 'operation-12345678', { subject: 'x' }, async () => ({ id: '1' }));
  await assert.rejects(dispatchOnce(vault, 'u', 'a', 'operation-12345678', { subject: 'y' }, async () => ({})), rejectsCode('IDEMPOTENCY_CONFLICT'));
});
test('ambiguous SMTP delivery is never automatically retried', async (t) => {
  const vault = await vaultFixture(t); let attempts = 0;
  const send = () => dispatchOnce(vault, 'u', 'a', 'operation-12345678', {}, async () => { attempts++; throw Error('lost acknowledgement'); });
  await assert.rejects(send());
  await assert.rejects(send(), rejectsCode('SEND_UNCERTAIN'));
  assert.equal(attempts, 1);
});
