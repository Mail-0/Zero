import { describe, it, expect } from 'vitest';
import { getListUnsubscribeAction } from './email-utils';

describe('getListUnsubscribeAction', () => {
  it('parses a valid http List-Unsubscribe URL', () => {
    expect(
      getListUnsubscribeAction({ listUnsubscribe: '<https://example.com/u?id=1>' }),
    ).toEqual({ type: 'get', url: 'https://example.com/u?id=1', host: 'example.com' });
  });

  it('returns null for an angle-bracketed value that is not a valid URL', () => {
    // Regression: previously threw `TypeError: Invalid URL` because the primary
    // `new URL(match[1])` path had no try/catch, unlike the fallback path.
    expect(getListUnsubscribeAction({ listUnsubscribe: '<here>' })).toBeNull();
    expect(
      getListUnsubscribeAction({ listUnsubscribe: 'Click <here> to unsubscribe' }),
    ).toBeNull();
  });
});
