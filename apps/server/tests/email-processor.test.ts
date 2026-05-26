import { describe, expect, it } from 'vitest';
import * as cheerio from 'cheerio';

import { processEmailHtml } from '../src/lib/email-processor';

describe('processEmailHtml', () => {
  it('does not reintroduce executable markup when replacing blocked images', () => {
    const payload =
      '<p>blocked-image breakout test</p><img src="https://example.com/--><img src=x onerror=alert(1)" width="2">';

    const result = processEmailHtml({
      html: payload,
      shouldLoadImages: false,
      theme: 'light',
    });

    const $ = cheerio.load(result.processedHtml);

    expect(result.hasBlockedImages).toBe(true);
    expect($('img').length).toBe(0);
    expect($('[onerror]').length).toBe(0);
    expect($('[data-blocked-image="true"]').length).toBe(1);
    expect(result.processedHtml).not.toContain('<!-- blocked image:');
    expect(result.processedHtml).not.toContain('alert(1)');
  });

  it('keeps inline CID images while external images are blocked', () => {
    const result = processEmailHtml({
      html: '<p>inline image</p><img src="cid:inline-attachment" onerror="alert(1)">',
      shouldLoadImages: false,
      theme: 'light',
    });

    const $ = cheerio.load(result.processedHtml);

    expect(result.hasBlockedImages).toBe(false);
    expect($('img').length).toBe(1);
    expect($('img').attr('src')).toBe('cid:inline-attachment');
    expect($('[onerror]').length).toBe(0);
  });
});
