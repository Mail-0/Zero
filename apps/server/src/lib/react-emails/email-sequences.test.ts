import {
  WelcomeEmail,
  Mail0ProEmail,
  AutoLabelingEmail,
  CategoriesEmail,
  ShortcutsEmail,
  SuperSearchEmail,
  AIWritingAssistantEmail,
} from './email-sequences';
import { describe, expect, it } from 'vitest';
import { render } from '@react-email/render';

describe('onboarding email templates', () => {
  it.each([
    WelcomeEmail,
    Mail0ProEmail,
    AutoLabelingEmail,
    CategoriesEmail,
    ShortcutsEmail,
    SuperSearchEmail,
    AIWritingAssistantEmail,
  ])('renders %s without requiring a global React', async (template) => {
    const html = await render(template({ name: 'Test User' }));
    expect(html).toContain('Test User');
    expect(html).toContain('<html');
  });
});
