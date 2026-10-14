import { describe, expect, it } from 'vitest';
import { translateSearch } from './search';

describe('translateSearch', () => {
  it('maps operators, phrases and negation', () => {
    expect(translateSearch('from:alice "quarterly report" -is:read')).toEqual({
      folder: undefined,
      criteria: [
        'FROM',
        { quoted: 'alice' },
        'TEXT',
        { quoted: 'quarterly report' },
        'NOT',
        'SEEN',
      ],
      empty: false,
    });
  });

  it('handles OR, folders and ignores unsupported operators', () => {
    const result = translateSearch('in:sent (to:bob OR to:carol) category:promotions');
    expect(result.folder).toBe('SENT');
    expect(result.criteria).toEqual(['OR', ['TO', { quoted: 'bob' }], ['TO', { quoted: 'carol' }]]);
  });

  it('never inverts a negated folder term into a folder selection', () => {
    expect(translateSearch('NOT is:draft from:a')).toEqual({
      folder: undefined,
      criteria: ['NOT', 'DRAFT', 'FROM', { quoted: 'a' }],
      empty: false,
    });
    expect(translateSearch('-in:spam subject:x').folder).toBeUndefined();
  });

  it('returns ALL for empty or unsupported-only queries', () => {
    expect(translateSearch('')).toEqual({ folder: undefined, criteria: ['ALL'], empty: true });
    expect(translateSearch('is:personal category:updates').empty).toBe(true);
  });

  it('maps is:important to the $Important keyword', () => {
    expect(translateSearch('is:important').criteria).toEqual(['KEYWORD', '$Important']);
  });

  it('converts dates', () => {
    expect(translateSearch('after:2026/01/05 before:2026-02-01').criteria).toEqual([
      'SINCE',
      '5-Jan-2026',
      'BEFORE',
      '1-Feb-2026',
    ]);
  });
});
