import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';

export class BridgeError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'BridgeError';
    this.code = code;
    this.status = status;
  }
}
export function ensure(condition, code, message, status = 400) {
  if (!condition) throw new BridgeError(code, message, status);
}
export function text(value, label, max = 1024, allowEmpty = false) {
  ensure(typeof value === 'string' && value.length <= max && (allowEmpty || value.length > 0),
    'INVALID_INPUT', `Invalid ${label}`);
  return value;
}
export function headerText(value, label, max = 320, allowEmpty = false) {
  const result = text(value, label, max, allowEmpty);
  ensure(!/[\r\n\0]/.test(result), 'INVALID_INPUT', `Invalid ${label}`);
  return result;
}
export function address(value) {
  const result = headerText(value, 'email').trim();
  ensure(/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(result), 'INVALID_INPUT', 'Invalid email address');
  return result;
}
export function authorized(header, secret) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(typeof header === 'string' ? header : '');
  return expected.length === received.length && timingSafeEqual(expected, received);
}
export function keyFromHex(value) {
  ensure(typeof value === 'string' && /^[a-f\d]{64}$/i.test(value), 'CONFIG',
    'BRIDGE_ENCRYPTION_KEY must be 64 hex characters', 500);
  return Buffer.from(value, 'hex');
}
export function seal(value, key, context) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return JSON.stringify({ v: 1, iv: nonce.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: ciphertext.toString('base64') });
}
export function unseal(value, key, context) {
  const envelope = JSON.parse(value);
  ensure(envelope.v === 1, 'VAULT_VERSION', 'Unsupported encrypted store version', 500);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString('utf8'));
}

// One bridge process/replica per volume. Every record uses an authenticated owner-scoped envelope.
export class Vault {
  constructor(directory, key) { this.directory = directory; this.key = key; this.locks = new Map(); }
  filename(owner, kind, id) {
    const context = JSON.stringify([text(owner, 'owner', 256), text(kind, 'kind', 64), text(id, 'id', 256)]);
    return { context, path: join(this.directory, createHash('sha256').update(context).digest('hex') + '.json') };
  }
  async get(owner, kind, id) {
    const { context, path } = this.filename(owner, kind, id);
    try { return unseal(await readFile(path, 'utf8'), this.key, context); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  async put(owner, kind, id, value) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const { context, path } = this.filename(owner, kind, id);
    const tmp = `${path}.${randomBytes(12).toString('hex')}.tmp`;
    const file = await open(tmp, 'wx', 0o600);
    try {
      await file.writeFile(seal(value, this.key, context));
      await file.sync();
    } finally { await file.close(); }
    try {
      await rename(tmp, path);
      const directory = await open(this.directory, 'r');
      try { await directory.sync(); } finally { await directory.close(); }
    } finally { await unlink(tmp).catch(() => {}); }
  }
  async remove(owner, kind, id) {
    await unlink(this.filename(owner, kind, id).path).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  }
  async exclusive(key, fn) {
    const previous = this.locks.get(key) || Promise.resolve();
    let release;
    const next = new Promise((resolve) => { release = resolve; });
    this.locks.set(key, next);
    await previous;
    try { return await fn(); }
    finally { release(); if (this.locks.get(key) === next) this.locks.delete(key); }
  }
}

export const PRESETS = Object.freeze({
  qq: { imapHost: 'imap.qq.com', smtpHost: 'smtp.qq.com' },
  '163': { imapHost: 'imap.163.com', smtpHost: 'smtp.163.com' },
  '126': { imapHost: 'imap.126.com', smtpHost: 'smtp.126.com' },
  icloud: { imapHost: 'imap.mail.me.com', smtpHost: 'smtp.mail.me.com', smtpPort: 587 },
});
export function validateAccount(input, allowedHosts = []) {
  ensure(input && typeof input === 'object', 'INVALID_INPUT', 'Account is required');
  const email = address(input.email);
  const preset = text(input.preset, 'preset', 32);
  ensure(Object.hasOwn(PRESETS, preset) || preset === 'custom', 'INVALID_INPUT', 'Unknown provider');
  const selected = preset === 'custom' ? input : PRESETS[preset];
  const imapHost = headerText(selected.imapHost, 'IMAP host', 253).toLowerCase();
  const smtpHost = headerText(selected.smtpHost, 'SMTP host', 253).toLowerCase();
  for (const host of [imapHost, smtpHost]) {
    ensure(/^[a-z\d](?:[a-z\d.-]*[a-z\d])?$/.test(host), 'INVALID_INPUT', 'Invalid server hostname');
    if (preset === 'custom') ensure(allowedHosts.includes(host), 'HOST_NOT_ALLOWED', 'Ask the server administrator to allow this custom mail hostname');
  }
  const imapPort = selected.imapPort ?? 993;
  const smtpPort = selected.smtpPort ?? 465;
  ensure(imapPort === 993 && [465, 587].includes(smtpPort), 'INVALID_INPUT', 'Only IMAPS 993 and SMTP TLS 465/587 are supported');
  const password = text(input.password, 'authorization code', 2048);
  return {
    email, name: headerText(input.name ?? '', 'name', 128, true), preset,
    imapHost, smtpHost, imapPort, smtpPort,
    username: headerText(input.username || email, 'username'), password,
    smtpUsername: headerText(input.smtpUsername || input.username || email, 'SMTP username'),
    smtpPassword: input.smtpPassword ? text(input.smtpPassword, 'SMTP authorization code', 2048) : password,
    saveSent: input.saveSent === true,
  };
}
export function messageId(folder, validity, uid) {
  return Buffer.from(JSON.stringify([folder, String(validity), Number(uid)])).toString('base64url');
}
export function parseMessageId(id) {
  text(id, 'message id', 4096);
  let parts;
  try { parts = JSON.parse(Buffer.from(id, 'base64url').toString('utf8')); }
  catch { throw new BridgeError('INVALID_ID', 'Invalid message identifier'); }
  ensure(Array.isArray(parts) && parts.length === 3, 'INVALID_ID', 'Invalid message identifier');
  const [folder, validity, uid] = parts;
  headerText(folder, 'folder', 1024);
  ensure(typeof validity === 'string' && /^[1-9]\d*$/.test(validity) &&
    Number.isSafeInteger(uid) && uid >= 1 && uid <= 4294967295, 'INVALID_ID', 'Invalid UID or UIDVALIDITY');
  return { folder, validity, uid };
}
export function pageUids(uids, before, limit) {
  ensure(Number.isInteger(limit) && limit >= 1 && limit <= 50, 'INVALID_INPUT', 'Page size must be 1–50');
  const all = [...new Set(uids)].filter((uid) => Number.isSafeInteger(uid) && uid > 0 && (!before || uid < before)).sort((a, b) => b - a);
  return { selected: all.slice(0, limit), hasMore: all.length > limit };
}
export function aiEndpoint(baseUrl, allowedOrigins) {
  let url;
  try { url = new URL(text(baseUrl, 'AI base URL', 1024)); }
  catch { throw new BridgeError('INVALID_INPUT', 'Invalid AI base URL'); }
  ensure(!url.username && !url.password && !url.search && !url.hash, 'INVALID_INPUT', 'AI base URL must not include credentials, query, or fragment');
  ensure(['https:', 'http:'].includes(url.protocol) && allowedOrigins.includes(url.origin), 'AI_ORIGIN_NOT_ALLOWED', 'AI endpoint origin is not in the administrator allowlist');
  // HTTP/private-network providers are only reachable after an explicit administrator allowlist entry.
  url.pathname = `${url.pathname.replace(/\/$/, '')}/chat/completions`;
  return url.toString();
}

// Persist before dispatch: an ambiguous SMTP result must never trigger an automatic resend.
export async function dispatchOnce(vault, owner, accountId, operationId, payload, send) {
  ensure(typeof operationId === 'string' && /^[a-zA-Z\d_-]{16,128}$/.test(operationId), 'INVALID_INPUT', 'A stable operationId (16–128 characters) is required');
  const id = `${accountId}:${operationId}`;
  return vault.exclusive(`outbox:${owner}:${id}`, async () => {
    const fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const previous = await vault.get(owner, 'outbox', id);
    if (previous) {
      ensure(previous.fingerprint === fingerprint, 'IDEMPOTENCY_CONFLICT', 'This operationId was already used for a different message', 409);
      if (previous.status === 'sent') return { ...previous.result, replayed: true };
      throw new BridgeError('SEND_UNCERTAIN', 'Previous SMTP attempt may have sent this message. Check Sent before creating a new operationId.', 409);
    }
    await vault.put(owner, 'outbox', id, { status: 'sending', fingerprint, at: new Date().toISOString() });
    // If send() or the final durable write fails, retain "sending" instead of pretending it is safe to retry.
    const result = await send();
    await vault.put(owner, 'outbox', id, { status: 'sent', fingerprint, result, at: new Date().toISOString() });
    return result;
  });
}
