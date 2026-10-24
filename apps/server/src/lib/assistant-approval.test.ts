import { assistantAppPresentation } from './assistant-approval';
import type { AssistantContext } from './assistant';
import { describe, expect, it } from 'vitest';

const id = 'a'.repeat(64);
const url = `https://zero.test/assistant/action/${id}`;
const context = (): AssistantContext => ({
  agentId: 'shared-agent',
  phone: '+15551111111',
  channel: { channel: 'sms', userId: '+15551111111', isDirect: true },
});

describe('Keiki app presentation requests', () => {
  it('returns only the stable intent and review URL, never credentials or a delivery claim', () => {
    expect(assistantAppPresentation(context(), id, url)).toEqual({
      type: 'app',
      id,
      url,
      caption: 'Review Zero action',
      subcaption: 'Sign in to review and approve',
    });
    expect(assistantAppPresentation(context(), id, url)).not.toHaveProperty('live');
  });

  it.each(['channel', 'userId', 'isDirect'] as const)(
    'does not request cards outside a verified DM: %s',
    (field) => {
      const input = context();
      Object.assign(input.channel, { [field]: field === 'isDirect' ? false : 'wrong' });
      expect(assistantAppPresentation(input, id, url)).toBeUndefined();
    },
  );

  it.each([
    'http://localhost/action',
    'https://user:password@example.com/action',
    '/relative',
    'invalid',
  ])('does not ask Keiki to render unsafe review URLs: %s', (target) => {
    expect(assistantAppPresentation(context(), id, target)).toBeUndefined();
  });
});
