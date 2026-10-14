/**
 * OAuth 2.0 helpers for IMAP/SMTP XOAUTH2 connections (Microsoft 365 / Outlook.com and Gmail).
 */
export type ImapOAuthProvider = 'google' | 'microsoft';

export interface OAuthProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  imap: { host: string; port: number; security: 'tls' | 'starttls' };
  smtp: { host: string; port: number; security: 'tls' | 'starttls' };
  /** Servers that file submitted mail into Sent themselves. */
  serverSavesSent: boolean;
}

export const OAUTH_PROVIDERS: Record<ImapOAuthProvider, OAuthProviderConfig> = {
  microsoft: {
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: [
      'openid',
      'email',
      'profile',
      'offline_access',
      'https://outlook.office.com/IMAP.AccessAsUser.All',
      'https://outlook.office.com/SMTP.Send',
    ],
    imap: { host: 'outlook.office365.com', port: 993, security: 'tls' },
    smtp: { host: 'smtp.office365.com', port: 587, security: 'starttls' },
    serverSavesSent: true,
  },
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['openid', 'email', 'profile', 'https://mail.google.com/'],
    imap: { host: 'imap.gmail.com', port: 993, security: 'tls' },
    smtp: { host: 'smtp.gmail.com', port: 465, security: 'tls' },
    serverSavesSent: true,
  },
};

export interface OAuthClientCredentials {
  clientId: string;
  clientSecret: string;
}

export interface TokenSet {
  accessToken: string;
  /** Epoch ms. */
  expiresAt: number;
  /** Present when the provider rotated or issued a refresh token. */
  refreshToken?: string;
  idToken?: string;
}

export class OAuthRefreshError extends Error {
  constructor(
    message: string,
    readonly permanent: boolean,
  ) {
    super(message);
    this.name = 'OAuthRefreshError';
  }
}

const tokenRequest = async (
  provider: ImapOAuthProvider,
  client: OAuthClientCredentials,
  params: Record<string, string>,
  fetcher: typeof fetch,
): Promise<TokenSet> => {
  const config = OAUTH_PROVIDERS[provider];
  const response = await fetcher(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: client.clientId,
      client_secret: client.clientSecret,
      ...params,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || typeof body.access_token !== 'string') {
    const error = typeof body.error === 'string' ? body.error : `HTTP ${response.status}`;
    throw new OAuthRefreshError(
      `OAuth token request failed: ${error}`,
      error === 'invalid_grant' || error === 'unauthorized_client',
    );
  }
  return {
    accessToken: body.access_token,
    expiresAt: Date.now() + Number(body.expires_in ?? 3600) * 1000,
    refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : undefined,
    idToken: typeof body.id_token === 'string' ? body.id_token : undefined,
  };
};

export const refreshAccessToken = (
  provider: ImapOAuthProvider,
  client: OAuthClientCredentials,
  refreshToken: string,
  fetcher: typeof fetch = fetch,
) =>
  tokenRequest(
    provider,
    client,
    {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: OAUTH_PROVIDERS[provider].scopes.join(' '),
    },
    fetcher,
  );

export const exchangeAuthorizationCode = (
  provider: ImapOAuthProvider,
  client: OAuthClientCredentials,
  code: string,
  redirectUri: string,
  codeVerifier: string,
  fetcher: typeof fetch = fetch,
) =>
  tokenRequest(
    provider,
    client,
    {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    },
    fetcher,
  );

export const authorizationUrl = (
  provider: ImapOAuthProvider,
  options: {
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
    loginHint?: string;
  },
) => {
  const config = OAUTH_PROVIDERS[provider];
  const url = new URL(config.authorizeUrl);
  url.search = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state: options.state,
    code_challenge: options.codeChallenge,
    code_challenge_method: 'S256',
    ...(provider === 'google' ? { access_type: 'offline', prompt: 'consent' } : {}),
    ...(options.loginHint ? { login_hint: options.loginHint } : {}),
  }).toString();
  return url.toString();
};

/** Email claim from an (unverified-signature) id_token returned directly by the token endpoint. */
export const emailFromIdToken = (idToken: string | undefined) => {
  if (!idToken) return null;
  try {
    const payload = idToken.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload + '==='.slice((payload.length + 3) % 4))) as {
      email?: string;
      preferred_username?: string;
      name?: string;
    };
    return {
      email: (claims.email ?? claims.preferred_username ?? '').toLowerCase() || null,
      name: claims.name ?? null,
    };
  } catch {
    return null;
  }
};
