import { GmailQuotaDeferredError, unwrapGmailError } from './gmail-quota-error';
import { gmailDeliveryFailure } from './gmail-delivery-failure';
import { gmailQuotaCost } from './gmail-quota-cost';
import { gmailPriority } from './gmail-priority';
import { env } from '../env';

export function getGmailQuotaGovernor() {
  const project = env.GOOGLE_CLIENT_ID.split('-')[0];
  if (!project || !env.GMAIL_QUOTA) throw new Error('Gmail quota governor is not configured');
  return env.GMAIL_QUOTA.get(env.GMAIL_QUOTA.idFromName(`gmail-project:${project}`));
}

export async function budgetGmailRequest<T>(
  mailbox: string,
  url: string | URL,
  method: string | undefined,
  request: () => Promise<T>,
) {
  const cost = gmailQuotaCost(url, method);
  if (cost === undefined) return request();
  const governor = getGmailQuotaGovernor();
  const key = mailbox.trim().toLowerCase();
  const priority = gmailPriority();
  let decision = await governor.reserve(key, cost, priority);
  const started = Date.now();
  while (
    !decision.allowed &&
    decision.concurrent &&
    priority === 'foreground' &&
    Date.now() - started < 2000
  ) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    decision = await governor.reserve(key, cost, priority);
  }
  if (!decision.allowed) throw GmailQuotaDeferredError.from(decision);
  try {
    return await request();
  } catch (error) {
    const failure = gmailDeliveryFailure(error, 0);
    if (failure.reason === 'rate_limited') {
      const value = unwrapGmailError(error) as {
        errors?: { reason?: string }[];
        message?: string;
        response?: { data?: { error?: { message?: string; errors?: { reason?: string }[] } } };
      };
      const reasons = value?.response?.data?.error?.errors ?? value?.errors ?? [];
      const userSpecific = /for user|concurrent/i.test(
        value?.response?.data?.error?.message ?? value?.message ?? '',
      );
      const projectLimit =
        !userSpecific &&
        reasons.some(({ reason }) =>
          ['rateLimitExceeded', 'quotaExceeded', 'dailyLimitExceeded'].includes(reason ?? ''),
        );
      await governor.cooldown(
        key,
        projectLimit ? 'project' : 'mailbox',
        Date.now() + failure.delayMs,
      );
    }
    throw error;
  } finally {
    if (decision.leaseId) {
      try {
        await governor.release(decision.leaseId);
      } catch {
        console.error('[gmail-quota] lease release failed; expiry will recover it');
      }
    }
  }
}
