import { beforeAll, describe, expect, it, vi } from 'vitest';
import { verifyGmailPushToken } from './gmail-push';
import { generateKeyPair, SignJWT } from 'jose';

const keys = vi.hoisted(() => ({ publicKey: undefined as CryptoKey | undefined }));
vi.mock('jose', async (importOriginal) => ({
  ...(await importOriginal<typeof import('jose')>()),
  createRemoteJWKSet: () => async () => keys.publicKey,
}));

let privateKey: CryptoKey;
const audience = 'https://api.example.com/a8n/notify/google';
const email = 'push@example.iam.gserviceaccount.com';
beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  keys.publicKey = pair.publicKey;
});

async function token(aud = audience, identity = email, verified = true) {
  return new SignJWT({ email: identity, email_verified: verified })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer('https://accounts.google.com')
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

describe('signed Pub/Sub identity verification', () => {
  it('accepts a correctly signed token for the configured audience and service account', async () => {
    expect(await verifyGmailPushToken(await token(), audience, email)).toBe(true);
  });
  it('rejects an audience mismatch and unverified or different email identity', async () => {
    await expect(
      verifyGmailPushToken(await token('https://other.example.com'), audience, email),
    ).rejects.toThrow();
    expect(
      await verifyGmailPushToken(await token(audience, 'other@example.com'), audience, email),
    ).toBe(false);
    expect(await verifyGmailPushToken(await token(audience, email, false), audience, email)).toBe(
      false,
    );
  });
  it('rejects invalid signatures', async () => {
    const parts = (await token()).split('.');
    parts[2] = `${parts[2]!.startsWith('A') ? 'B' : 'A'}${parts[2]!.slice(1)}`;
    await expect(verifyGmailPushToken(parts.join('.'), audience, email)).rejects.toThrow();
  });
});
