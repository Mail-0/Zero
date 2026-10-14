import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withGmailPriority } from './gmail-priority';
import { GmailQuotaAuth } from './gmail-quota-auth';
const governor = vi.hoisted(() => ({ reserve: vi.fn(), cooldown: vi.fn(), release: vi.fn() }));
vi.mock('../env', () => ({
  env: {
    GOOGLE_CLIENT_ID: '123-test',
    GMAIL_QUOTA: { idFromName: (name: string) => name, get: () => governor },
  },
}));

function fixture() {
  const auth = new GmailQuotaAuth('USER@example.com', 'client', 'secret');
  auth.setCredentials({ access_token: 'test', expiry_date: Date.now() + 3600000 });
  const transport = vi.spyOn(auth.transporter, 'request').mockResolvedValue({
    data: {},
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
    request: { responseURL: 'https://gmail.googleapis.com' },
  });
  return { auth, transport };
}
beforeEach(() => {
  governor.reserve.mockReset().mockResolvedValue({ allowed: true });
  governor.cooldown.mockReset().mockResolvedValue(undefined);
  governor.release.mockReset().mockResolvedValue(undefined);
});

describe('Gmail transport quota gate', () => {
  it('releases in-flight capacity after a successful request', async () => {
    const { auth } = fixture();
    governor.reserve.mockResolvedValue({ allowed: true, leaseId: 'lease' });
    await auth.request({ url: 'https://gmail.googleapis.com/gmail/v1/users/me/threads/id' });
    expect(governor.release).toHaveBeenCalledWith('lease');
  });
  it('charges every SDK call with its method cost and ambient priority', async () => {
    const { auth, transport } = fixture();
    await withGmailPriority('backfill', () =>
      auth.request({ url: 'https://gmail.googleapis.com/gmail/v1/users/me/threads/id' }),
    );
    expect(governor.reserve).toHaveBeenCalledWith('user@example.com', 40, 'backfill');
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({ retry: false, timeout: 30000 }),
    );
  });
  it('does not send an HTTP request when shared capacity is exhausted', async () => {
    const { auth, transport } = fixture();
    governor.reserve.mockResolvedValue({
      allowed: false,
      scope: 'project',
      retryAt: Date.now() + 60000,
    });
    await expect(
      auth.request({ url: 'https://www.googleapis.com/gmail/v1/users/me/messages/id' }),
    ).rejects.toMatchObject({ quotaDeferred: true, scope: 'project' });
    expect(transport).not.toHaveBeenCalled();
  });
  it('leaves People and OAuth requests outside the Gmail budget', async () => {
    const { auth } = fixture();
    await auth.request({ url: 'https://people.googleapis.com/v1/people/me' });
    expect(governor.reserve).not.toHaveBeenCalled();
  });
  it('keeps priority isolated between concurrent asynchronous requests', async () => {
    const { auth } = fixture();
    await Promise.all([
      withGmailPriority('backfill', async () => {
        await Promise.resolve();
        await auth.request({ url: 'https://gmail.googleapis.com/gmail/v1/users/me/threads/id' });
      }),
      withGmailPriority('foreground', () =>
        auth.request({ url: 'https://gmail.googleapis.com/gmail/v1/users/me/labels/id' }),
      ),
    ]);
    expect(governor.reserve.mock.calls).toContainEqual(['user@example.com', 40, 'backfill']);
    expect(governor.reserve.mock.calls).toContainEqual(['user@example.com', 1, 'foreground']);
  });
  it('publishes provider Retry-After to a shared mailbox cooldown', async () => {
    const { auth, transport } = fixture();
    transport.mockRejectedValue(
      Object.assign(new Error('Rate limited'), {
        config: {},
        response: {
          config: {},
          status: 429,
          headers: { 'retry-after': '300' },
          data: { error: { errors: [{ reason: 'userRateLimitExceeded' }] } },
        },
      }),
    );
    await expect(
      auth.request({ url: 'https://gmail.googleapis.com/gmail/v1/users/me/threads/id' }),
    ).rejects.toThrow('Rate limited');
    expect(governor.cooldown).toHaveBeenCalledWith(
      'user@example.com',
      'mailbox',
      expect.any(Number),
    );
    expect(governor.cooldown.mock.calls[0]?.[2]).toBeGreaterThan(Date.now() + 290000);
  });
});
