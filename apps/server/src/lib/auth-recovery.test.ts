import { getAuthRecoveryURL, handleAuthRequest } from './auth-recovery';
import { describe, expect, it } from 'vitest';

describe('auth recovery', () => {
  const request = new Request('https://api.example.com/api/auth/callback/google');
  const recoveryURL = getAuthRecoveryURL('https://app.example.com', {
    providerId: 'google',
    accountId: 'google-subject-id',
  });

  it('targets the broken provider account without exposing tokens', () => {
    const url = new URL(recoveryURL);
    expect(url.origin).toBe('https://app.example.com');
    expect(url.pathname).toBe('/login/reconnect');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      provider: 'google',
      loginHint: 'google-subject-id',
      error: 'missing_tokens',
    });
  });

  it('replaces generic OAuth error redirects when the hook detected missing tokens', async () => {
    const response = await handleAuthRequest(
      request,
      async () => Response.redirect('https://app.example.com/login?error=unable_to_link_account'),
      () => recoveryURL,
    );
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(recoveryURL);
  });

  it('recovers even when Better Auth propagates the hook error', async () => {
    const response = await handleAuthRequest(
      request,
      async () => {
        throw new Error('Missing Access/Refresh Tokens');
      },
      () => recoveryURL,
    );
    expect(response.headers.get('location')).toBe(recoveryURL);
  });

  it('preserves normal responses and unrelated errors', async () => {
    const response = new Response('OK');
    expect(
      await handleAuthRequest(
        request,
        async () => response,
        () => undefined,
      ),
    ).toBe(response);
    const error = new Error('Unrelated error');
    await expect(
      handleAuthRequest(
        request,
        async () => {
          throw error;
        },
        () => undefined,
      ),
    ).rejects.toBe(error);
  });
});
