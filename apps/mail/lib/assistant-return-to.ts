export function assistantReturnTo(value: string | null) {
  if (!value?.startsWith('/assistant/')) return '/mail';
  const origin = 'https://zero.invalid';
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin || url.hash || value.includes('\\')) return '/mail';
    if (url.pathname === '/assistant/connect') return `${url.pathname}${url.search}`;
    if (url.search) return '/mail';
    if (/^\/assistant\/action\/[a-f0-9]{64}$/.test(url.pathname)) return url.pathname;
    if (/^\/assistant\/draft\/[^/?#]+\/[^/?#]+$/.test(url.pathname)) return url.pathname;
  } catch {
    return '/mail';
  }
  return '/mail';
}
