import { getConsentURL, getReconnectPath } from './auth-recovery';
import { describe, expect, it } from 'vitest';

describe('connection repair', () => {
  it('forces Google consent and offline access for the broken account, preserving OAuth state', () => {
    const url = new URL(
      getConsentURL(
        'https://accounts.google.com/o/oauth2/auth?state=state-token&code_challenge=challenge&prompt=none&access_type=online&scope=email',
        'google',
        'google-subject-id',
      ),
    );
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('login_hint')).toBe('google-subject-id');
    expect(url.searchParams.get('state')).toBe('state-token');
    expect(url.searchParams.get('code_challenge')).toBe('challenge');
    expect(url.searchParams.get('scope')).toBe('email');
  });

  it('forces Microsoft consent without adding Google-specific parameters', () => {
    const url = new URL(
      getConsentURL(
        'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?scope=offline_access',
        'microsoft',
        'user@example.com',
      ),
    );
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('login_hint')).toBe('user@example.com');
    expect(url.searchParams.has('access_type')).toBe(false);
    expect(url.searchParams.get('scope')).toBe('offline_access');
  });

  it('targets the selected connection from settings', () => {
    const url = new URL(
      getReconnectPath('google', 'user+mail@example.com'),
      'https://app.example.com',
    );
    expect(url.pathname).toBe('/login/reconnect');
    expect(url.searchParams.get('provider')).toBe('google');
    expect(url.searchParams.get('loginHint')).toBe('user+mail@example.com');
    expect(url.searchParams.get('email')).toBe('user+mail@example.com');
  });
});
