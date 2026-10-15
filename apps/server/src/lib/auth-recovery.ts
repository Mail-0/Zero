import type { Account } from 'better-auth';

export function getAuthRecoveryURL(
  appURL: string,
  account: Pick<Account, 'providerId' | 'accountId'>,
) {
  const url = new URL('/login/reconnect', appURL);
  url.searchParams.set('provider', account.providerId);
  // Google accepts the provider's subject ID as a login hint, even without a mailbox connection.
  url.searchParams.set('loginHint', account.accountId);
  url.searchParams.set('error', 'missing_tokens');
  return url.toString();
}

export async function handleAuthRequest(
  request: Request,
  handler: (request: Request) => Promise<Response>,
  getRecoveryURL: () => string | undefined,
) {
  try {
    const response = await handler(request);
    // Better Auth catches some database-hook errors and turns them into generic OAuth redirects.
    const recoveryURL = getRecoveryURL();
    return recoveryURL ? Response.redirect(recoveryURL, 302) : response;
  } catch (error) {
    const recoveryURL = getRecoveryURL();
    if (recoveryURL) return Response.redirect(recoveryURL, 302);
    throw error;
  }
}
