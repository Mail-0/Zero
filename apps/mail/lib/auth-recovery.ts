export function getConsentURL(authorizationURL: string, provider: string, loginHint: string) {
  const url = new URL(authorizationURL);
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('login_hint', loginHint);
  if (provider === 'google') url.searchParams.set('access_type', 'offline');
  return url.toString();
}

export function getReconnectPath(provider: string, email: string) {
  const params = new URLSearchParams({ provider, loginHint: email, email });
  return `/login/reconnect?${params}`;
}
