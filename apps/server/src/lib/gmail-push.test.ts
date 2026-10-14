import { gmailNotification, gmailSubscriptionConnection } from './gmail-push';
import { describe, expect, it } from 'vitest';

const id = '12345678-1234-1234-1234-123456789abc';
const subscription = `projects/test-project/subscriptions/notifications__${id}`;

describe('Gmail push admission', () => {
  it('accepts wrapped and unwrapped notifications', () => {
    expect(gmailNotification({ historyId: '123' }, subscription)).toEqual({
      historyId: '123',
      subscriptionName: subscription,
    });
    expect(
      gmailNotification({
        subscription,
        message: { data: btoa(JSON.stringify({ historyId: '123' })) },
      }),
    ).toEqual({ historyId: '123', subscriptionName: subscription });
  });
  it('rejects malformed history IDs and subscriptions from another project', () => {
    expect(() => gmailNotification({ historyId: 1.5 }, subscription)).toThrow();
    expect(() => gmailSubscriptionConnection(subscription, 'other-project')).toThrow();
    expect(() => gmailSubscriptionConnection(`${subscription}/extra`, 'test-project')).toThrow();
    expect(gmailSubscriptionConnection(subscription, 'test-project')).toBe(id);
  });

  it('accepts the numeric history IDs emitted in actual Gmail push messages', () => {
    expect(
      gmailNotification({
        subscription,
        message: {
          data: btoa(JSON.stringify({ emailAddress: 'test@example.com', historyId: 4910605 })),
        },
      }),
    ).toEqual({ historyId: '4910605', subscriptionName: subscription });
  });
});
