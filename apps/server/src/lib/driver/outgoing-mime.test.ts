import { buildDraftMime, buildOutgoingMime, toMessageIdList } from './outgoing-mime';
import { describe, expect, it } from 'vitest';

describe('outgoing MIME', () => {
  it('collects envelope recipients and honours a fixed Message-ID', async () => {
    const { raw, recipients } = await buildOutgoingMime(
      {
        to: [{ email: 'Alice <a@x.com>' }, { email: 'a@x.com' }],
        cc: [{ email: 'c@x.com' }],
        bcc: [{ email: 'b@x.com' }],
        subject: 'Hi',
        message: '<p>Hello</p>',
        attachments: [],
        headers: { References: 'r1@x r2@x' },
      },
      { defaultFrom: 'me@x.com', messageId: '<fixed@x.com>' },
    );
    expect(recipients).toEqual(['a@x.com', 'c@x.com', 'b@x.com']);
    expect(raw).toMatch(/^Message-ID: <fixed@x\.com>/m);
    expect(raw).toMatch(/^References: <r1@x> <r2@x>/m);
    expect(raw).toMatch(/^From: <?me@x\.com>?/m);
  });

  it('builds drafts without recipients', async () => {
    const raw = await buildDraftMime(
      { to: '', subject: 'Draft', message: '<p>x</p>', id: null, threadId: null, fromEmail: null },
      { from: 'me@x.com', messageId: '<d@x.com>' },
    );
    expect(raw).toMatch(/^Subject: /m);
    expect(raw).toMatch(/^Message-ID: <d@x\.com>/m);
    expect(raw).not.toMatch(/^To:/m);
  });

  it('normalizes message id lists', () => {
    expect(toMessageIdList('a@b  <c@d>')).toBe('<a@b> <c@d>');
  });
});
