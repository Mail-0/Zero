import {
  emailContentQueryKey,
  resolveEmailContentTheme,
  shouldLoadEmailImages,
} from './email-content-query';
import { describe, expect, it } from 'vitest';

describe('email content query key', () => {
  it('normalizes theme so prefetch and renderer agree', () => {
    expect(resolveEmailContentTheme('dark')).toBe('dark');
    expect(resolveEmailContentTheme('light')).toBe('light');
    // next-themes `theme` can be 'system'; must never leak into the key
    expect(resolveEmailContentTheme('system')).toBe('light');
    expect(resolveEmailContentTheme(undefined)).toBe('light');
  });

  it('always yields a boolean image flag (undefined would split the cache)', () => {
    expect(shouldLoadEmailImages(undefined, 'a@b.c')).toBe(false);
    expect(shouldLoadEmailImages({ trustedSenders: [] }, 'a@b.c')).toBe(false);
    expect(shouldLoadEmailImages({ trustedSenders: ['a@b.c'] }, 'a@b.c')).toBe(true);
    expect(shouldLoadEmailImages({ externalImages: true }, undefined)).toBe(true);
    expect(shouldLoadEmailImages({ trustedSenders: ['a@b.c'] }, undefined)).toBe(false);
  });

  it('produces identical keys for the same message/settings', () => {
    const settings = { externalImages: false, trustedSenders: ['a@b.c'] };
    const prefetch = emailContentQueryKey(
      'm1',
      shouldLoadEmailImages(settings, 'a@b.c'),
      resolveEmailContentTheme('dark'),
    );
    const render = emailContentQueryKey(
      'm1',
      shouldLoadEmailImages(settings, 'a@b.c') || false,
      resolveEmailContentTheme('dark'),
    );
    expect(prefetch).toEqual(render);
  });
});
