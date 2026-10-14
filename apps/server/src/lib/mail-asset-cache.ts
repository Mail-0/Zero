export interface MailAssetBucket {
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  put(key: string, value: string): Promise<unknown>;
}

// Gmail attachment bytes and MIME parts are immutable for a message ID. Draft
// edits replace the underlying message ID, so changed attachments get new keys.
export class MailAssetCache {
  private inFlight = new Map<string, Promise<string | undefined>>();

  constructor(
    private bucket: MailAssetBucket,
    private mailbox: string,
  ) {}

  async read(parts: string[], load: () => Promise<string | undefined>) {
    const hash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(JSON.stringify([this.mailbox, ...parts])),
    );
    const key = `mail-assets/v1/${Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const request = this.fetch(key, load);
    this.inFlight.set(key, request);
    try {
      return await request;
    } finally {
      this.inFlight.delete(key);
    }
  }

  private async fetch(key: string, load: () => Promise<string | undefined>) {
    try {
      const cached = await this.bucket.get(key);
      if (cached) return await cached.text();
    } catch {
      // Storage availability must not prevent a provider download.
    }
    const value = await load();
    if (value !== undefined) {
      try {
        await this.bucket.put(key, value);
      } catch {
        // A successful download remains usable even if caching fails.
      }
    }
    return value;
  }
}
