import { pickForwardedAttachments } from './forward-attachments';
import { describe, expect, it } from 'vitest';

const file = (filename: string, size: number, body = 'x') => ({
  filename,
  size,
  body,
  mimeType: 'application/pdf',
});

describe('pickForwardedAttachments', () => {
  it('matches by name and size, using each original once', () => {
    const a1 = file('a.pdf', 10);
    const a2 = file('a.pdf', 20);
    const b = file('b.png', 5);
    expect(
      pickForwardedAttachments(
        [a1, a2, b],
        [
          { filename: 'a.pdf', size: 20 },
          { filename: 'a.pdf', size: 10 },
        ],
      ),
    ).toEqual([a2, a1]);
  });

  it('falls back to the name when the size differs', () => {
    const a = file('a.pdf', 10);
    expect(pickForwardedAttachments([a], [{ filename: 'a.pdf', size: 11 }])).toEqual([a]);
  });

  it('skips missing files and files without content', () => {
    expect(
      pickForwardedAttachments([file('a.pdf', 1, '')], [{ filename: 'a.pdf' }, { filename: 'z' }]),
    ).toEqual([]);
  });
});
