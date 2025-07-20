import { Effect, Duration, Schedule } from 'effect';

/**
 * Gmail signals per-user quota problems in two ways:
 *  – HTTP 429 Too Many Requests
 *  – HTTP 403 with reason == userRateLimitExceeded or quotaExceeded
 */
export function isRateLimit(err: unknown): boolean {
  const e: any = err || {};
  const status = e.code ?? e.status ?? e.response?.status;

  if (status === 429) return true;
  if (status === 403) {
    const errors = e.errors ?? e.response?.data?.error?.errors ?? [];
    return errors.some((x: any) =>
      [
        'userRateLimitExceeded',
        'rateLimitExceeded',
        'quotaExceeded',
        'dailyLimitExceeded',
        'backendError',
        'limitExceeded',
      ].includes(x.reason),
    );
  }
  return false;
}

/**
 * A schedule that:
 *  – retries while the error *is* a rate-limit error (max 10 attempts)
 *  – waits 60 seconds between retries (conservative for Gmail user quotas)
 *  – stops immediately for any other error
 */
export const rateLimitSchedule = Schedule.recurWhile(isRateLimit)
  .pipe(Schedule.intersect(Schedule.recurs(3))) // max 3 attempts
  .pipe(Schedule.addDelay(() => Duration.seconds(60))); // 60s delay between retries

/**
 * Generic wrapper that applies the schedule
 */
export function withRetry<A>(
  eff: Effect.Effect<A, unknown, never>,
): Effect.Effect<A, unknown, never> {
  return eff.pipe(Effect.retry(rateLimitSchedule));
}
