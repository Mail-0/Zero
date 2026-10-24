import { AssistantEmailPreview } from '../components/ai-chat/assistant-email-preview';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';

describe('assistant email preview', () => {
  it('renders recipients, subject, paragraphs and attachments as inert text', () => {
    const html = renderToStaticMarkup(
      createElement(AssistantEmailPreview, {
        email: {
          fromEmail: 'sender@example.com',
          to: ['sam@example.com'],
          cc: 'cc@example.com',
          bcc: ['private@example.com'],
          subject: 'Hello',
          body: '<img src=x onerror=alert(1)>\n\nBody text',
          attachments: [{ filename: '<script>file.txt', size: 6 }],
        },
      }),
    );
    expect(html).toContain('sam@example.com');
    expect(html).toContain('sender@example.com');
    expect(html).toContain('private@example.com');
    expect(html).toContain('Body text');
    expect(html).toContain('&lt;img');
    expect(html).toContain('&lt;script&gt;file.txt');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>');
  });
});
