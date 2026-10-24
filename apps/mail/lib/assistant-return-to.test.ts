import { assistantReturnTo } from './assistant-return-to';
import { describe, expect, it } from 'vitest';

describe('assistant login return paths', () => {
  it('preserves a scoped draft preview through OAuth, including encoded provider IDs', () => {
    expect(assistantReturnTo('/assistant/draft/mail-id/opaque%2Fid%3D')).toBe(
      '/assistant/draft/mail-id/opaque%2Fid%3D',
    );
  });
  it('preserves existing action and connection links', () => {
    const action = `/assistant/action/${'a'.repeat(64)}`;
    expect(assistantReturnTo(action)).toBe(action);
    expect(assistantReturnTo('/assistant/connect?token=fixture')).toBe(
      '/assistant/connect?token=fixture',
    );
  });
  it('rejects external, normalized traversal and unrelated return targets', () => {
    for (const path of [
      null,
      '//evil.test',
      'https://evil.test',
      '/assistant/draft/../..',
      '/assistant/draft/mail/id?next=https://evil.test',
      '/assistant/action/not-an-id',
      '/assistant/other',
      '/assistant/draft/mail\\evil.test/id',
    ])
      expect(assistantReturnTo(path)).toBe('/mail');
  });
});
