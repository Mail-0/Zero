import { gmailDeliveryFailure } from './gmail-delivery-failure';
import { GmailQuotaDeferredError } from './gmail-quota-error';
import { describe, expect, it } from 'vitest';
import { Effect } from 'effect';

describe('Gmail durable retry classification', () => {
  it('unwraps Effect failures and honors local admission retry times', async () => {
    const retryAt = Date.now() + 300000;
    let wrapped: unknown;
    try {
      await Effect.runPromise(Effect.fail(new GmailQuotaDeferredError(retryAt, 'project')));
    } catch (error) {
      wrapped = error;
    }
    const failure = gmailDeliveryFailure(wrapped, 99);
    expect(failure.reason).toBe('quota_deferred');
    expect(failure.blocked).toBe(false);
    expect(failure.delayMs).toBeGreaterThan(290000);
    expect(failure.delayMs).toBeLessThanOrEqual(300000);
  });
  it('retries 403 rate limits and honors Retry-After', () => {
    const failure = gmailDeliveryFailure(
      {
        response: {
          status: 403,
          headers: { 'retry-after': '300' },
          data: { error: { errors: [{ reason: 'userRateLimitExceeded' }] } },
        },
      },
      0,
    );
    expect(failure.blocked).toBe(false);
    expect(failure.reason).toBe('rate_limited');
    expect(failure.delayMs).toBeGreaterThanOrEqual(300000);
  });
  it('pauses revoked credentials rather than retrying them forever', () => {
    expect(gmailDeliveryFailure({ originalError: { message: 'invalid_grant' } }, 0).reason).toBe(
      'reauth_required',
    );
    expect(gmailDeliveryFailure({ code: 401 }, 0).blocked).toBe(true);
  });
  it('retries network and server failures, but blocks invalid requests', () => {
    expect(gmailDeliveryFailure(new Error('network reset'), 0).blocked).toBe(false);
    expect(gmailDeliveryFailure({ code: 503 }, 0).blocked).toBe(false);
    expect(gmailDeliveryFailure({ code: 400 }, 0).blocked).toBe(true);
  });
});
