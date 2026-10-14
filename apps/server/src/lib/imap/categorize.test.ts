import { classifyMessage, emailAddress, emailAddresses } from './categorize';
import { parseHeaderBlock } from './imap-store';
import { describe, expect, it } from 'vitest';

const classify = (lines: string[], knownContact = false) =>
  classifyMessage({ headers: parseHeaderBlock(lines.join('\r\n')), knownContact });

describe('classifyMessage', () => {
  it.each([
    [['From: Alice <alice@example.com>'], 'personal'],
    [['From: info@smallbiz.com'], 'personal'],
    [['From: Shop <news@shop.com>', 'List-Unsubscribe: <https://shop.com/u>'], 'promotions'],
    [['From: deals@shop.com', 'Precedence: bulk'], 'promotions'],
    [['From: x@esp.com', 'Feedback-ID: 1:2:3:esp'], 'promotions'],
    [['From: no-reply@bank.com', 'List-Unsubscribe: <mailto:u@bank.com>'], 'updates'],
    [['From: GitHub <notifications@github.com>'], 'updates'],
    [['From: robot@ci.dev', 'Auto-Submitted: auto-generated'], 'updates'],
    [['From: bob@lists.dev', 'List-Id: <dev.lists.dev>'], 'updates'],
    [
      [
        'From: bob@lists.dev',
        'List-Id: <dev.lists.dev>',
        'Precedence: list',
        'List-Unsubscribe: <x>',
      ],
      'updates',
    ],
  ] as const)('%j -> %s', (lines, expected) => {
    expect(classify([...lines])).toBe(expected);
  });

  it('keeps contacts personal unless it is a mass mailing', () => {
    expect(classify(['From: support@vendor.com'], true)).toBe('personal');
    expect(classify(['From: news@vendor.com', 'List-Unsubscribe: <x>'], true)).toBe('promotions');
  });

  it('parses addresses', () => {
    expect(emailAddress('"Alice A." <Alice@Example.com>')).toBe('alice@example.com');
    expect(emailAddresses(['a@x.com, "B" <b@y.com>', 'c@z.com'])).toEqual([
      'a@x.com',
      'b@y.com',
      'c@z.com',
    ]);
  });
});
