import { CredentialCipher, CredentialKeyError, parseKeyring } from './credentials';
import { describe, expect, it } from 'vitest';

const key = (fill: number) => btoa(String.fromCharCode(...new Uint8Array(32).fill(fill)));

describe('CredentialCipher', () => {
  it('round-trips with the current key and binds to the AAD', async () => {
    const cipher = new CredentialCipher(`1:${key(1)}`);
    const secret = await cipher.encrypt('hunter2', 'conn-1');
    expect(secret.keyVersion).toBe(1);
    expect(secret.ciphertext).not.toContain('hunter2');
    expect(await cipher.decrypt(secret, 'conn-1')).toBe('hunter2');
    await expect(cipher.decrypt(secret, 'conn-2')).rejects.toThrow();
  });

  it('encrypts with the newest key and still decrypts old versions', async () => {
    const old = new CredentialCipher(`1:${key(1)}`);
    const secret = await old.encrypt('pw', 'c');
    const rotated = new CredentialCipher(`1:${key(1)},2:${key(2)}`);
    expect(await rotated.decrypt(secret, 'c')).toBe('pw');
    expect(rotated.needsRotation(secret)).toBe(true);
    expect((await rotated.encrypt('pw', 'c')).keyVersion).toBe(2);
  });

  it('uses a fresh IV per encryption', async () => {
    const cipher = new CredentialCipher(`1:${key(3)}`);
    const a = await cipher.encrypt('same', 'c');
    const b = await cipher.encrypt('same', 'c');
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('rejects malformed key config', async () => {
    expect(() => parseKeyring('nope')).toThrow(CredentialKeyError);
    expect(() => parseKeyring(`1:${btoa('short')}`)).toThrow(CredentialKeyError);
    expect(parseKeyring('').size).toBe(0);
    await expect(new CredentialCipher('').encrypt('x', 'c')).rejects.toThrow(CredentialKeyError);
  });
});
