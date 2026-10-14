import { MailAssetCache } from './mail-asset-cache';
import { describe, expect, it, vi } from 'vitest';

function fixture() {
  const objects = new Map<string, string>();
  const bucket = {
    get: vi.fn(async (key: string) =>
      objects.has(key) ? { text: async () => objects.get(key)! } : null,
    ),
    put: vi.fn(async (key: string, value: string) => {
      objects.set(key, value);
    }),
  };
  return { objects, bucket, cache: new MailAssetCache(bucket, 'mailbox-a') };
}

describe('immutable mailbox attachment cache', () => {
  it('coalesces downloads and reuses R2 bytes across cache reconstruction', async () => {
    const { cache, bucket } = fixture();
    const load = vi.fn(async () => 'cGF5bG9hZA==');
    const values = await Promise.all(
      Array.from({ length: 8 }, () => cache.read(['attachment', 'm', 'a'], load)),
    );
    expect(values).toEqual(Array(8).fill('cGF5bG9hZA=='));
    expect(load).toHaveBeenCalledTimes(1);
    expect(await new MailAssetCache(bucket, 'mailbox-a').read(['attachment', 'm', 'a'], load)).toBe(
      'cGF5bG9hZA==',
    );
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('isolates mailboxes, message versions, attachment IDs and MIME metadata keys', async () => {
    const { cache, bucket, objects } = fixture();
    const load = vi.fn(async () => 'bytes');
    for (const parts of [
      ['attachment', 'm', 'a'],
      ['attachment', 'new-message', 'a'],
      ['attachment', 'm', 'b'],
      ['attachment-parts', 'm'],
    ])
      await cache.read(parts, load);
    await new MailAssetCache(bucket, 'mailbox-b').read(['attachment', 'm', 'a'], load);
    expect(load).toHaveBeenCalledTimes(5);
    expect(objects.size).toBe(5);
    expect([...objects.keys()].every((key) => /^mail-assets\/v1\/[a-f0-9]{64}$/.test(key))).toBe(
      true,
    );
  });

  it('does not cache provider errors or missing data and retries a failed download', async () => {
    const { cache, objects } = fixture();
    const load = vi
      .fn<() => Promise<string | undefined>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue('ok');
    await expect(cache.read(['attachment', 'm', 'a'], load)).rejects.toThrow('offline');
    expect(await cache.read(['attachment', 'm', 'a'], load)).toBeUndefined();
    expect(objects.size).toBe(0);
    expect(await cache.read(['attachment', 'm', 'a'], load)).toBe('ok');
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('returns provider data when R2 reads or writes fail', async () => {
    const { cache, bucket } = fixture();
    bucket.get.mockRejectedValue(new Error('R2 unavailable'));
    bucket.put.mockRejectedValue(new Error('R2 unavailable'));
    const load = vi.fn(async () => 'bytes');
    expect(await cache.read(['attachment', 'm', 'a'], load)).toBe('bytes');
    expect(await cache.read(['attachment', 'm', 'a'], load)).toBe('bytes');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('caches legitimate empty attachment bytes and empty MIME inventories', async () => {
    const { cache } = fixture();
    const bytes = vi.fn(async () => '');
    const parts = vi.fn(async () => '[]');
    for (let i = 0; i < 2; i++) {
      expect(await cache.read(['attachment', 'm', 'a'], bytes)).toBe('');
      expect(await cache.read(['attachment-parts', 'm'], parts)).toBe('[]');
    }
    expect(bytes).toHaveBeenCalledTimes(1);
    expect(parts).toHaveBeenCalledTimes(1);
  });
});
