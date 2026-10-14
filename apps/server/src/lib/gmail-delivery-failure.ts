import { unwrapGmailError } from './gmail-quota-error';

export function gmailDeliveryFailure(error: unknown, attempts: number) {
  const unwrapped = unwrapGmailError(error);
  const deferred = unwrapped as { quotaDeferred?: boolean; retryAt?: number } | undefined;
  if (deferred?.quotaDeferred && Number.isFinite(deferred.retryAt)) {
    return {
      blocked: false,
      reason: 'quota_deferred',
      delayMs: Math.max(1000, deferred.retryAt! - Date.now()),
    };
  }
  const value = unwrapped as
    | {
        code?: number | string;
        message?: string;
        response?: {
          status?: number;
          headers?: { get?: (key: string) => string | null; 'retry-after'?: string };
          data?: { error?: { errors?: { reason?: string }[] } };
        };
        errors?: { reason?: string }[];
      }
    | undefined;
  const status = Number(value?.response?.status ?? value?.code);
  const reasons = value?.response?.data?.error?.errors ?? value?.errors ?? [];
  const rateLimited =
    status === 429 ||
    reasons.some(({ reason }) =>
      [
        'rateLimitExceeded',
        'userRateLimitExceeded',
        'quotaExceeded',
        'dailyLimitExceeded',
      ].includes(reason ?? ''),
    );
  const auth = status === 401 || value?.message?.includes('invalid_grant');
  const blocked = Boolean(
    auth || (status >= 400 && status < 500 && !rateLimited && status !== 408),
  );
  const headers = value?.response?.headers;
  const retryAfter = headers?.get?.('retry-after') ?? headers?.['retry-after'];
  const retryAfterMs = retryAfter
    ? /^\d+(\.\d+)?$/.test(retryAfter)
      ? Number(retryAfter) * 1000
      : Math.max(0, Date.parse(retryAfter) - Date.now())
    : 0;
  const backoff = Math.min(
    rateLimited ? 3600000 : 60000,
    (rateLimited ? 60000 : 2000) * 2 ** Math.min(attempts, 10),
  );
  return {
    blocked,
    reason: auth
      ? 'reauth_required'
      : blocked
        ? `permanent_${status}`
        : rateLimited
          ? 'rate_limited'
          : 'transient',
    delayMs: Math.max(
      Number.isFinite(retryAfterMs) ? retryAfterMs : 0,
      backoff * (1 + Math.random() * 0.25),
    ),
  };
}
