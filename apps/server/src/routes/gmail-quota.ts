import { GmailQuotaStore, type GmailPriority } from '../lib/gmail-quota-store';
import { DurableObject } from 'cloudflare:workers';
import type { ZeroEnv } from '../env';

export class GmailQuota extends DurableObject<ZeroEnv> {
  private budget: GmailQuotaStore;
  constructor(ctx: DurableObjectState, env: ZeroEnv) {
    super(ctx, env);
    const limit = (value: string | undefined, fallback: number, maximum: number) => {
      const number = Number(value);
      return Number.isFinite(number) && number >= 100 ? Math.min(number, maximum) : fallback;
    };
    this.budget = new GmailQuotaStore(
      {
        exec: (sql, ...args) => ctx.storage.sql.exec(sql, ...args),
        transaction: (fn) => ctx.storage.transactionSync(fn),
      },
      {
        project: limit(env.GMAIL_PROJECT_QUOTA_PER_MINUTE, 960000, 1200000),
        mailbox: limit(env.GMAIL_MAILBOX_QUOTA_PER_MINUTE, 4800, 6000),
      },
    );
    this.budget.initialize();
  }
  reserve(mailbox: string, units: number, priority: GmailPriority) {
    return this.budget.reserve(mailbox, units, priority, Date.now(), true);
  }
  release(leaseId: string) {
    this.budget.release(leaseId);
  }
  cooldown(mailbox: string, scope: 'project' | 'mailbox', until: number) {
    this.budget.cooldown(mailbox, scope, until);
  }
  status(mailbox: string) {
    return this.budget.status(mailbox, Date.now());
  }
}
