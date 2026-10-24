import { resolveReplyEnvelope } from './assistant-addressing';
import { describe, expect, it } from 'vitest';

const source = {
  sender: { email: 'sam@example.com' },
  replyTo: 'support@example.com',
  to: [{ email: 'me@example.com' }, { email: 'other@example.com' }],
  cc: [
    { email: 'team@example.com' },
    { email: 'OTHER@example.com' },
    { email: 'alias@example.com' },
  ],
};
const self = ['me@example.com', 'alias@example.com', 'second-mailbox@example.com'];

describe('deterministic reply envelope', () => {
  it('replies to Reply-To without copying original Cc or Bcc', () => {
    expect(resolveReplyEnvelope(source, self, 'reply')).toEqual({
      to: [{ email: 'support@example.com' }],
      cc: [],
      bcc: [],
    });
  });
  it('reply-all includes other To/Cc participants with case-insensitive deduplication', () => {
    expect(resolveReplyEnvelope(source, self, 'reply_all')).toEqual({
      to: [{ email: 'support@example.com' }, { email: 'other@example.com' }],
      cc: [{ email: 'team@example.com' }],
      bcc: [],
    });
  });
  it('uses original recipients when replying to an email sent by the owner', () => {
    expect(
      resolveReplyEnvelope(
        { ...source, sender: { email: 'alias@example.com' }, replyTo: undefined },
        self,
        'reply',
      ),
    ).toMatchObject({ to: [{ email: 'other@example.com' }], cc: [] });
  });
  it('applies explicit overrides, distinguishes omitted fields from empty lists, and deduplicates', () => {
    expect(
      resolveReplyEnvelope(source, self, 'reply_all', {
        to: [{ email: 'chosen@example.com' }],
        cc: [],
        bcc: [{ email: 'chosen@example.com' }, { email: 'private@example.com' }],
      }),
    ).toEqual({
      to: [{ email: 'chosen@example.com' }],
      cc: [],
      bcc: [{ email: 'private@example.com' }],
    });
  });
  it('allows an explicitly requested copy to self but not accidental default copies', () => {
    expect(
      resolveReplyEnvelope(source, self, 'reply', { cc: [{ email: 'me@example.com' }] }).cc,
    ).toEqual([{ email: 'me@example.com' }]);
  });
  it('requires a real remaining recipient rather than inventing one', () => {
    expect(() =>
      resolveReplyEnvelope({ sender: { email: 'me@example.com' }, to: [], cc: [] }, self, 'reply'),
    ).toThrow();
    expect(() => resolveReplyEnvelope(source, self, 'reply', { to: [] })).toThrow();
  });
});
