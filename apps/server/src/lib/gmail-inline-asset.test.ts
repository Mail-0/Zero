import { GmailQuotaDeferredError } from './gmail-quota-error';
import { loadGmailInlineAsset } from './gmail-inline-asset';
import { describe, expect, it } from 'vitest';
import { Effect } from 'effect';

describe('inline Gmail attachment failures', () => {
  it('returns downloaded bytes', async () => {
    await expect(loadGmailInlineAsset(async () => 'image-base64')).resolves.toBe('image-base64');
  });

  it.each([404, '404'])('skips a wrapped missing attachment (%s)', async (code) => {
    const error = { originalError: { code } };
    await expect(loadGmailInlineAsset(() => Promise.reject(error))).resolves.toBeUndefined();
  });

  it('skips a missing attachment wrapped by Effect and the driver', async () => {
    await expect(
      loadGmailInlineAsset(() =>
        Effect.runPromise(Effect.fail({ originalError: { response: { status: 404 } } })),
      ),
    ).resolves.toBeUndefined();
  });

  it.each([
    new GmailQuotaDeferredError(Date.now() + 60000, 'mailbox'),
    Object.assign(new Error('Unavailable'), { response: { status: 503 } }),
    Object.assign(new Error('Rate limited'), { response: { status: 429 } }),
    new Error('Connection reset'),
    Object.assign(new Error('Unauthorized'), { response: { status: 401 } }),
  ])('preserves non-missing failure wrappers for import retry: %s', async (originalError) => {
    const wrapped = { originalError };
    const error = await Effect.runPromise(Effect.fail(wrapped)).catch(
      (failure: unknown) => failure,
    );
    await expect(loadGmailInlineAsset(() => Promise.reject(error))).rejects.toBe(error);
  });
});
