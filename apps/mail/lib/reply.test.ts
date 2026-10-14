import {
  anchorDrafts,
  buildForwardedOriginal,
  buildNameDirectory,
  buildQuotedOriginal,
  buildReplyRecipients,
  buildReplySubject,
  isInlineAttachment,
  isLikelyNoReply,
  modeForDraft,
  parseAddressList,
  pickFromAddress,
  pickResumableDraft,
  stripSubjectPrefixes,
  toSender,
} from './reply';
import { describe, expect, it } from 'vitest';

const me = 'me@example.com';
const alias = 'me+work@example.com';
const emails = (list: { email: string }[]) => list.map((s) => s.email);

describe('subjects', () => {
  it('never stacks Re:', () => {
    expect(buildReplySubject('Hello', 'reply')).toBe('Re: Hello');
    expect(buildReplySubject('Re: Hello', 'reply')).toBe('Re: Hello');
    expect(buildReplySubject('RE: Hello', 'replyAll')).toBe('Re: Hello');
    expect(buildReplySubject('re:Hello', 'reply')).toBe('Re: Hello');
  });

  it('forwards with exactly one Fwd:', () => {
    expect(buildReplySubject('Fwd: Re: Hello', 'forward')).toBe('Fwd: Hello');
    expect(buildReplySubject('FW: Hello', 'forward')).toBe('Fwd: Hello');
    expect(stripSubjectPrefixes('RE: Fwd: re: Hello')).toBe('Hello');
  });

  it('handles empty subjects', () => {
    expect(buildReplySubject(undefined, 'reply')).toBe('Re:');
  });
});

describe('parseAddressList', () => {
  it('handles names with commas and bare addresses', () => {
    expect(parseAddressList('"Doe, Jane" <jane@x.com>, bob@y.com')).toEqual([
      { name: 'Doe, Jane', email: 'jane@x.com' },
      { email: 'bob@y.com' },
    ]);
  });
});

describe('buildReplyRecipients', () => {
  const base = {
    sender: { name: 'Ann', email: 'ann@x.com' },
    to: [{ email: me }, { email: 'bob@x.com' }],
    cc: [{ email: 'Carl@x.com' }, { email: 'ME@example.com' }],
  };

  it('reply goes to the sender only', () => {
    const r = buildReplyRecipients(base, 'reply', [me]);
    expect(emails(r.to)).toEqual(['ann@x.com']);
    expect(r.cc).toEqual([]);
  });

  it('honors Reply-To', () => {
    const r = buildReplyRecipients({ ...base, replyTo: 'List <list@x.com>' }, 'reply', [me]);
    expect(emails(r.to)).toEqual(['list@x.com']);
  });

  it('reply all removes every own address case-insensitively and dedupes', () => {
    const r = buildReplyRecipients(
      { ...base, to: [...base.to, { email: alias }, { email: 'ANN@x.com' }] },
      'replyAll',
      [me, alias],
    );
    expect(emails(r.to)).toEqual(['ann@x.com', 'bob@x.com']);
    expect(emails(r.cc)).toEqual(['Carl@x.com']);
  });

  it('replying to my own message goes back to its recipients', () => {
    const r = buildReplyRecipients(
      { sender: { email: me }, to: [{ email: 'bob@x.com' }], cc: [{ email: 'carl@x.com' }] },
      'reply',
      [me],
    );
    expect(emails(r.to)).toEqual(['bob@x.com']);
    expect(r.cc).toEqual([]);
  });

  it('note to self replies to self', () => {
    const r = buildReplyRecipients(
      { sender: { email: me }, to: [{ email: me }], cc: null },
      'reply',
      [me],
    );
    expect(emails(r.to)).toEqual([me]);
  });

  it('forward starts empty', () => {
    expect(buildReplyRecipients(base, 'forward', [me])).toEqual({ to: [], cc: [] });
  });
});

describe('pickFromAddress', () => {
  it('replies from the alias the message was sent to', () => {
    const from = pickFromAddress(
      {
        sender: { email: 'ann@x.com' },
        to: [{ email: 'ME+WORK@example.com' }],
        cc: null,
        bcc: null,
      },
      [{ email: me, primary: true }, { email: alias }],
    );
    expect(from).toBe(alias);
  });
});

describe('isLikelyNoReply', () => {
  it('flags bulk senders', () => {
    expect(isLikelyNoReply('contact@mailer.humblebundle.com')).toBe(true);
    expect(isLikelyNoReply('no-reply@github.com')).toBe(true);
    expect(isLikelyNoReply('noreply@x.com')).toBe(true);
    expect(isLikelyNoReply('notifications@github.com')).toBe(true);
  });
  it('leaves people alone', () => {
    expect(isLikelyNoReply('ann@x.com')).toBe(false);
    expect(isLikelyNoReply('student@mail.utoronto.ca')).toBe(false);
  });
});

describe('quoting', () => {
  it('attributes the quote to the sender, not the recipients, and escapes names', () => {
    const html = buildQuotedOriginal({
      sender: { name: 'Ann <script>', email: 'ann@x.com' },
      date: 'Mon 1',
      body: '<p>original</p>',
    });
    expect(html).toContain('Ann &lt;script&gt; &lt;ann@x.com&gt; wrote:');
    expect(html).toContain('<blockquote class="gmail_quote"');
    expect(html).toContain('<p>original</p></blockquote>');
  });

  it('forward header lists the original recipients', () => {
    const html = buildForwardedOriginal({
      sender: { email: 'ann@x.com' },
      date: 'Mon 1',
      subject: 'Hi',
      to: [{ email: 'bob@x.com', name: 'Bob' }],
      body: 'b',
    });
    expect(html).toContain('To: Bob &lt;bob@x.com&gt;');
  });
});

describe('names', () => {
  it('keeps display names when sending', () => {
    const names = buildNameDirectory([
      { sender: { name: 'Ann', email: 'ann@x.com' }, to: [], cc: null, bcc: null },
    ]);
    expect(toSender('ANN@x.com', names)).toEqual({ email: 'ANN@x.com', name: 'Ann' });
    expect(toSender('zed@x.com', names)).toEqual({ email: 'zed@x.com' });
  });
});

describe('pickResumableDraft', () => {
  const msg = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    subject: 'Re: Hi',
    messageId: `<${id}@x>`,
    isDraft: false,
    inReplyTo: undefined as string | undefined,
    ...extra,
  });
  const a = msg('a');
  const b = msg('b');

  it('prefers the draft that replies to the chosen message', () => {
    const d1 = msg('d1', { isDraft: true, inReplyTo: '<a@x>' });
    const d2 = msg('d2', { isDraft: true, inReplyTo: '<b@x>' });
    expect(pickResumableDraft([a, b, d1, d2], a, 'reply', false)?.id).toBe('d1');
    expect(pickResumableDraft([a, b, d1, d2], b, 'reply', true)?.id).toBe('d2');
  });

  it('resumes a legacy draft (no In-Reply-To) only when replying to the latest message', () => {
    const d = msg('d', { isDraft: true });
    expect(pickResumableDraft([a, b, d], b, 'reply', true)?.id).toBe('d');
    expect(pickResumableDraft([a, b, d], a, 'reply', false)).toBeUndefined();
  });

  it("doesn't resume a draft that answers a different message", () => {
    const d = msg('d', { isDraft: true, inReplyTo: '<a@x>' });
    expect(pickResumableDraft([a, b, d], b, 'reply', true)).toBeUndefined();
  });

  it('keeps forwards and replies apart', () => {
    const fwd = msg('f', { isDraft: true, subject: 'Fwd: Hi' });
    expect(pickResumableDraft([a, fwd], a, 'reply', true)).toBeUndefined();
    expect(pickResumableDraft([a, fwd], a, 'forward', true)?.id).toBe('f');
  });
});

describe('isInlineAttachment', () => {
  it('detects inline images', () => {
    expect(
      isInlineAttachment({
        headers: [
          { name: 'Content-Disposition', value: 'inline; filename="a.png"' },
          { name: 'Content-ID', value: '<a>' },
        ],
      }),
    ).toBe(true);
    expect(
      isInlineAttachment({ headers: [{ name: 'Content-Disposition', value: 'attachment' }] }),
    ).toBe(false);
  });
});

describe('anchorDrafts', () => {
  const a = { id: 'a', messageId: '<a@x>' };
  const b = { id: 'b', messageId: '<b@x>' };
  it('puts drafts under the message they reply to, else after the latest', () => {
    const d1 = { id: 'd1', inReplyTo: 'a@x' };
    const d2 = { id: 'd2', inReplyTo: undefined };
    const d3 = { id: 'd3', inReplyTo: '<gone@x>' };
    const map = anchorDrafts([a, b], [d1, d2, d3]);
    expect(map.get('a')?.map((d) => d.id)).toEqual(['d1']);
    expect(map.get('b')?.map((d) => d.id)).toEqual(['d2', 'd3']);
  });
  it('ignores drafts in an empty thread', () => {
    expect(anchorDrafts([], [{ id: 'd', inReplyTo: undefined }]).size).toBe(0);
  });
});

describe('modeForDraft', () => {
  it('infers the mode', () => {
    expect(modeForDraft({ subject: 'Fwd: x', to: [], cc: null })).toBe('forward');
    expect(modeForDraft({ subject: 'Re: x', to: [{ email: 'a@x' }], cc: null })).toBe('reply');
    expect(modeForDraft({ subject: 'Re: x', to: [{ email: 'a@x' }], cc: [{ email: 'b@x' }] })).toBe(
      'replyAll',
    );
  });
});
