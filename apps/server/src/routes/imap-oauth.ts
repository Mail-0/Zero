/**
 * OAuth (authorization code + PKCE) flow that connects a Microsoft 365 / Outlook.com or Gmail
 * mailbox over IMAP/SMTP with XOAUTH2. Mounted at /api/imap-oauth.
 *
 *   GET /:provider/start     -> redirects to the provider's consent screen
 *   GET /:provider/callback  -> exchanges the code, verifies IMAP + SMTP, saves the connection
 *
 * The redirect URI `${VITE_PUBLIC_BACKEND_URL}/api/imap-oauth/<provider>/callback` must be
 * registered with the provider's OAuth app.
 */
import {
  OAUTH_PROVIDERS,
  authorizationUrl,
  emailFromIdToken,
  exchangeAuthorizationCode,
  type ImapOAuthProvider,
} from '../lib/imap/oauth';
import { cloudflareSocketFactory } from '../lib/mail-transport/cloudflare-socket';
import { getZeroAgent, getZeroDB } from '../lib/server-utils';
import { CredentialCipher } from '../lib/crypto/credentials';
import { testImapSmtpSettings } from '../lib/driver/imap';
import type { HonoContext } from '../ctx';
import { redis } from '../lib/services';
import { env } from '../env';
import { Hono } from 'hono';

const STATE_TTL_SECONDS = 600;

interface PendingState {
  userId: string;
  provider: ImapOAuthProvider;
  verifier: string;
  loginHint?: string;
}

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const randomToken = () => base64Url(crypto.getRandomValues(new Uint8Array(32)));

const challengeFor = async (verifier: string) =>
  base64Url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))),
  );

const clientFor = (provider: ImapOAuthProvider) => {
  const clientId = provider === 'microsoft' ? env.MICROSOFT_CLIENT_ID : env.GOOGLE_CLIENT_ID;
  const clientSecret =
    provider === 'microsoft' ? env.MICROSOFT_CLIENT_SECRET : env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
};

const redirectUri = (provider: ImapOAuthProvider) =>
  `${env.VITE_PUBLIC_BACKEND_URL}/api/imap-oauth/${provider}/callback`;

const appRedirect = (params: Record<string, string>) =>
  `${env.VITE_PUBLIC_APP_URL}/settings/connections?${new URLSearchParams(params).toString()}`;

const isProvider = (value: string): value is ImapOAuthProvider => value in OAUTH_PROVIDERS;

export const imapOAuthApi = new Hono<HonoContext>()
  .get('/:provider/start', async (c) => {
    const provider = c.req.param('provider');
    if (env.IMAP_ENABLED !== 'true' || !isProvider(provider)) return c.notFound();
    const user = c.var.sessionUser;
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const client = clientFor(provider);
    if (!client) return c.redirect(appRedirect({ imapError: 'oauth_not_configured' }));

    const state = randomToken();
    const verifier = randomToken();
    const loginHint = c.req.query('email') || undefined;
    const pending: PendingState = { userId: user.id, provider, verifier, loginHint };
    await redis().set(`imap-oauth:${state}`, JSON.stringify(pending), { ex: STATE_TTL_SECONDS });
    return c.redirect(
      authorizationUrl(provider, {
        clientId: client.clientId,
        redirectUri: redirectUri(provider),
        state,
        codeChallenge: await challengeFor(verifier),
        loginHint,
      }),
    );
  })
  .get('/:provider/callback', async (c) => {
    const provider = c.req.param('provider');
    if (env.IMAP_ENABLED !== 'true' || !isProvider(provider)) return c.notFound();
    const { code, state, error } = c.req.query();
    if (error || !code || !state)
      return c.redirect(appRedirect({ imapError: error || 'cancelled' }));

    const key = `imap-oauth:${state}`;
    const stored = await redis().get<PendingState | string>(key);
    await redis().del(key);
    const pending: PendingState | null =
      typeof stored === 'string' ? (JSON.parse(stored) as PendingState) : stored;
    const user = c.var.sessionUser;
    if (!pending || pending.provider !== provider || !user || pending.userId !== user.id)
      return c.redirect(appRedirect({ imapError: 'invalid_state' }));

    const client = clientFor(provider);
    if (!client) return c.redirect(appRedirect({ imapError: 'oauth_not_configured' }));
    const cipher = new CredentialCipher(env.CREDENTIALS_ENCRYPTION_KEYS);
    if (!cipher.configured)
      return c.redirect(appRedirect({ imapError: 'encryption_not_configured' }));

    try {
      const tokens = await exchangeAuthorizationCode(
        provider,
        client,
        code,
        redirectUri(provider),
        pending.verifier,
      );
      if (!tokens.refreshToken) return c.redirect(appRedirect({ imapError: 'no_refresh_token' }));
      const identity = emailFromIdToken(tokens.idToken);
      const email = identity?.email;
      if (!email) return c.redirect(appRedirect({ imapError: 'no_email' }));

      const config = OAUTH_PROVIDERS[provider];
      const imap = { ...config.imap, username: email };
      const smtp = { ...config.smtp, username: email };
      const test = await testImapSmtpSettings(
        { imap, smtp, auth: { method: 'xoauth2', accessToken: tokens.accessToken } },
        cloudflareSocketFactory,
      );
      if (!test.imap.ok || !test.smtp.ok) {
        console.warn('[imap-oauth] connection test failed', {
          provider,
          imap: test.imap,
          smtp: test.smtp,
        });
        return c.redirect(
          appRedirect({ imapError: !test.imap.ok ? 'imap_failed' : 'smtp_failed' }),
        );
      }

      const db = await getZeroDB(user.id);
      const existing = (await db.findManyConnections()).find((conn) => conn.email === email);
      if (existing && existing.providerId !== 'imap')
        return c.redirect(appRedirect({ imapError: 'already_connected' }));
      const id = existing?.id ?? crypto.randomUUID();
      const secret = await cipher.encrypt(tokens.refreshToken, id);
      const result = await db.upsertImapConnection({
        id,
        email,
        name: identity?.name ?? null,
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: new Date(tokens.expiresAt),
        settings: {
          imapHost: imap.host,
          imapPort: imap.port,
          imapSecurity: imap.security,
          imapUsername: imap.username,
          smtpHost: smtp.host,
          smtpPort: smtp.port,
          smtpSecurity: smtp.security,
          smtpUsername: smtp.username,
          authMethod: 'xoauth2',
          oauthProvider: provider,
          encryptedSecret: secret.ciphertext,
          iv: secret.iv,
          keyVersion: secret.keyVersion,
          serverSavesSent: config.serverSavesSent,
          capabilities: test.imap.capabilities ?? [],
        },
      });
      const userRow = await db.findUser();
      if (!userRow?.defaultConnectionId) await db.updateUser({ defaultConnectionId: result.id });
      try {
        const agent = await getZeroAgent(result.id);
        await agent.retryMailboxSync();
      } catch (syncError) {
        console.warn('[imap-oauth] failed to start sync', { error: String(syncError) });
      }
      return c.redirect(appRedirect({ imapConnected: result.id }));
    } catch (callbackError) {
      console.error('[imap-oauth] callback failed', {
        provider,
        error: callbackError instanceof Error ? callbackError.message : String(callbackError),
      });
      return c.redirect(appRedirect({ imapError: 'oauth_failed' }));
    }
  });
