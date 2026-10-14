import {
  BRAIN_FEATURE_ID,
  RunCoalescer,
  hasBrainEntitlement,
  localDevBilling,
  selectAiThreads,
  trackBrainActivity,
  type BrainBilling,
} from './thread-ai-dispatch';
import { describe, expect, it, vi } from 'vitest';

const added = (threadId: string, labelIds: string[] = ['INBOX', 'UNREAD']) => ({
  messagesAdded: [{ message: { threadId, labelIds } }],
});

describe('selectAiThreads', () => {
  it('keeps distinct threads that received mail from someone else', () => {
    expect(
      selectAiThreads([
        added('a'),
        added('a'),
        added('sent', ['SENT']),
        added('draft', ['DRAFT']),
        added('spam', ['SPAM', 'UNREAD']),
        added('trash', ['TRASH']),
        added('promo', ['INBOX', 'CATEGORY_PROMOTIONS']),
        added('social', ['CATEGORY_SOCIAL']),
        added('updates', ['INBOX', 'CATEGORY_UPDATES']),
        { messagesAdded: [{ message: { labelIds: ['INBOX'] } }] },
        {},
        added('b'),
      ]),
    ).toEqual(['a', 'updates', 'b']);
  });

  it('runs a thread when someone else replied even if the user also sent in the same delta', () => {
    expect(selectAiThreads([added('t', ['SENT']), added('t')])).toEqual(['t']);
  });

  it('treats a delta above the limit as backfill', () => {
    const history = Array.from({ length: 4 }, (_, i) => added(`t${i}`));
    expect(selectAiThreads(history, 4)).toHaveLength(4);
    expect(selectAiThreads(history, 3)).toEqual([]);
  });
});

function billing(overrides: Partial<BrainBilling> = {}): BrainBilling {
  return {
    check: vi.fn(async () => ({ data: { allowed: true }, error: null })),
    track: vi.fn(async () => ({ data: {}, error: null })),
    ...overrides,
  };
}

describe('brain entitlement', () => {
  it('treats every user as entitled with local dev billing', async () => {
    expect(await hasBrainEntitlement(localDevBilling, 'u1')).toBe(true);
  });

  it('asks Autumn about the brain-activity feature for the user', async () => {
    const b = billing();
    expect(await hasBrainEntitlement(b, 'u1')).toBe(true);
    expect(b.check).toHaveBeenCalledWith({ customer_id: 'u1', feature_id: BRAIN_FEATURE_ID });
  });

  it('fails closed when not allowed, on API errors, and on exceptions', async () => {
    expect(
      await hasBrainEntitlement(
        billing({ check: async () => ({ data: { allowed: false }, error: null }) }),
        'u',
      ),
    ).toBe(false);
    expect(
      await hasBrainEntitlement(billing({ check: async () => ({ error: { message: 'x' } }) }), 'u'),
    ).toBe(false);
    expect(
      await hasBrainEntitlement(
        billing({
          check: async () => {
            throw new Error('network');
          },
        }),
        'u',
      ),
    ).toBe(false);
  });

  it('tracks one idempotent unit per run and never throws', async () => {
    const b = billing();
    await trackBrainActivity(b, 'u1', 'conn:t:v1');
    expect(b.track).toHaveBeenCalledWith({
      customer_id: 'u1',
      feature_id: BRAIN_FEATURE_ID,
      value: 1,
      idempotency_key: 'conn:t:v1',
    });
    await expect(
      trackBrainActivity(
        billing({
          track: async () => {
            throw new Error('down');
          },
        }),
        'u',
        'k',
      ),
    ).resolves.toBeUndefined();
  });
});

describe('RunCoalescer', () => {
  it('serializes runs and folds waiting duplicates into one', async () => {
    const runs = new RunCoalescer();
    const order: string[] = [];
    let release!: () => void;
    const first = runs.run('live', async () => {
      order.push('first');
      await new Promise<void>((resolve) => (release = resolve));
      return 1;
    });
    await Promise.resolve();
    const second = runs.run('live', async () => {
      order.push('second');
      return 2;
    });
    const third = runs.run('live', async () => {
      order.push('third');
      return 3;
    });
    const summary = runs.run('summary', async () => {
      order.push('summary');
      return 4;
    });
    expect(third).toBe(second);
    release();
    expect(await Promise.all([first, second, third, summary])).toEqual([1, 2, 2, 4]);
    expect(order).toEqual(['first', 'second', 'summary']);
  });

  it('keeps running after a failed task', async () => {
    const runs = new RunCoalescer();
    await expect(runs.run('a', async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    expect(await runs.run('a', async () => 'ok')).toBe('ok');
  });
});
