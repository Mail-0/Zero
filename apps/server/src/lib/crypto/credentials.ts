/**
 * AES-256-GCM encryption for stored mail credentials (IMAP/SMTP passwords, XOAUTH2 refresh
 * tokens). Keys are versioned so they can be rotated: new secrets use the highest version and
 * every configured version can still decrypt.
 *
 * Key config format: `version:base64Key[,version:base64Key...]`, each key 32 raw bytes.
 */

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  keyVersion: number;
}

export class CredentialKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialKeyError';
  }
}

const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const fromBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export const parseKeyring = (config: string | undefined): Map<number, Uint8Array> => {
  const keys = new Map<number, Uint8Array>();
  for (const entry of (config ?? '').split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf(':');
    if (separator <= 0) throw new CredentialKeyError('Malformed credential key entry');
    const version = Number(trimmed.slice(0, separator));
    if (!Number.isInteger(version) || version <= 0)
      throw new CredentialKeyError('Credential key version must be a positive integer');
    const key = fromBase64(trimmed.slice(separator + 1));
    if (key.length !== 32) throw new CredentialKeyError('Credential keys must be 32 bytes');
    keys.set(version, key);
  }
  return keys;
};

export class CredentialCipher {
  private readonly keys: Map<number, Uint8Array>;
  private readonly imported = new Map<number, Promise<CryptoKey>>();

  constructor(config: string | undefined) {
    this.keys = parseKeyring(config);
  }

  get configured() {
    return this.keys.size > 0;
  }

  private get currentVersion() {
    if (!this.keys.size) throw new CredentialKeyError('CREDENTIALS_ENCRYPTION_KEYS is not set');
    return Math.max(...this.keys.keys());
  }

  private key(version: number) {
    const raw = this.keys.get(version);
    if (!raw) throw new CredentialKeyError(`Unknown credential key version ${version}`);
    let key = this.imported.get(version);
    if (!key) {
      key = crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
      this.imported.set(version, key);
    }
    return key;
  }

  /** `aad` binds the ciphertext to its owner (e.g. the connection id) so rows can't be swapped. */
  async encrypt(plaintext: string, aad: string): Promise<EncryptedSecret> {
    const keyVersion = this.currentVersion;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad) },
      await this.key(keyVersion),
      new TextEncoder().encode(plaintext),
    );
    return { ciphertext: toBase64(new Uint8Array(ciphertext)), iv: toBase64(iv), keyVersion };
  }

  async decrypt(secret: EncryptedSecret, aad: string): Promise<string> {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: fromBase64(secret.iv),
        additionalData: new TextEncoder().encode(aad),
      },
      await this.key(secret.keyVersion),
      fromBase64(secret.ciphertext),
    );
    return new TextDecoder().decode(plaintext);
  }

  /** True when the secret was encrypted with an older key and should be re-encrypted. */
  needsRotation(secret: Pick<EncryptedSecret, 'keyVersion'>) {
    return secret.keyVersion !== this.currentVersion;
  }
}
