import {
  buildForwardContent,
  forwardSourceVersion,
  materializeForwardAttachments,
  type ForwardSource,
} from './assistant-forward';
import { describe, expect, it } from 'vitest';

function source(): ForwardSource {
  return {
    message: {
      id: 'message',
      subject: 'Re: Fwd: Invoice',
      sender: { email: 'sam@example.com', name: 'Sam' },
      to: [{ email: 'me@example.com' }],
      cc: [],
      bcc: [{ email: 'private@example.com' }],
      receivedOn: '2026-10-15T10:00:00Z',
      decodedBody:
        '<div><strong>Original</strong><a href="https://example.com">Link</a><p>Sam’s signature</p></div>',
      attachments: [
        {
          filename: 'invoice.txt',
          mimeType: 'text/plain',
          size: 5,
          attachmentId: 'file',
          body: '',
          headers: [],
        },
      ],
      title: 'Invoice',
      tags: [],
      tls: false,
      unread: false,
      body: '',
      processedHtml: '',
      blobUrl: '',
    },
    attachments: [
      { filename: 'invoice.txt', mimeType: 'text/plain', size: 5, body: 'aGVsbG8=', headers: [] },
    ],
  };
}

describe('server-built forward content', () => {
  it('preserves original HTML, links and signatures without exposing Bcc or accepting reconstructed body text', () => {
    const result = buildForwardContent(source(), 'Please <review>');
    expect(result.subject).toBe('Fwd: Invoice');
    expect(result.message).toContain(source().message.decodedBody);
    expect(result.message).toContain('Please &lt;review&gt;');
    expect(result.message).not.toContain('private@example.com');
  });
  it('fails closed on missing or empty original attachment data', () => {
    const missing = source();
    missing.attachments = [];
    expect(() => buildForwardContent(missing)).toThrow('attachment');
    const empty = source();
    empty.attachments[0]!.body = '';
    expect(() => buildForwardContent(empty)).toThrow('attachment');
  });
  it('carries ordinary files and rehydrates original inline images instead of dropping them', () => {
    const files = [
      ...source().attachments,
      {
        filename: 'logo.png',
        mimeType: 'image/png',
        size: 5,
        body: 'aGVsbG8=',
        headers: [{ name: 'Content-ID', value: '<logo@x>' }],
      },
    ];
    const result = materializeForwardAttachments('<p>Hello</p><img src="cid:logo@x">', files);
    expect(result.message).toContain('src="data:image/png;base64,aGVsbG8="');
    expect(materializeForwardAttachments('<img src=cid:logo@x>', files).message).toContain(
      'src="data:image/png;base64,aGVsbG8="',
    );
    expect(result.attachments).toEqual([
      expect.objectContaining({ name: 'invoice.txt', base64: 'aGVsbG8=' }),
    ]);
  });
  it('refuses a forward with an unresolved inline image', () => {
    expect(() =>
      materializeForwardAttachments('<img src="cid:missing">', source().attachments),
    ).toThrow('inline image');
  });
  it('versions the actual original body and attachment bytes, not provider attachment IDs', async () => {
    const original = source(),
      changed = source();
    changed.attachments[0]!.body = 'ZGlmZmVyZW50';
    expect(await forwardSourceVersion(original)).not.toBe(await forwardSourceVersion(changed));
    changed.attachments = source().attachments;
    changed.message.decodedBody = '<p>Changed original</p>';
    expect(await forwardSourceVersion(original)).not.toBe(await forwardSourceVersion(changed));
  });
});
