import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OutlookMailManager } from './microsoft';
import { GoogleMailManager } from './google';

const state = vi.hoisted(() => ({
  gmailGet: vi.fn(),
  gmailProfile: vi.fn(),
  gmailAliases: vi.fn(),
  gmailMessage: vi.fn(),
  gmailAttachment: vi.fn(),
  gmailCreate: vi.fn(),
  graphGet: vi.fn(),
  graphPatch: vi.fn(),
  graphPost: vi.fn(),
  graphDelete: vi.fn(),
}));
vi.mock('../../env', () => ({ env: {} }));
vi.mock('../server-utils', () => ({ getActiveConnection: vi.fn(), getZeroDB: vi.fn() }));
vi.mock('../gmail-quota-auth', () => ({
  GmailQuotaAuth: class {
    setCredentials() {}
  },
}));
vi.mock('../mail-asset-cache', () => ({
  MailAssetCache: class {
    read(_key: unknown, load: () => unknown) {
      return load();
    }
  },
}));
vi.mock('@googleapis/gmail', () => ({
  gmail: () => ({
    users: {
      drafts: { get: state.gmailGet, create: state.gmailCreate },
      getProfile: state.gmailProfile,
      settings: { sendAs: { list: state.gmailAliases } },
      messages: { get: state.gmailMessage, attachments: { get: state.gmailAttachment } },
    },
  }),
}));
vi.mock('@microsoft/microsoft-graph-client', () => ({
  Client: {
    initWithMiddleware: () => ({
      api: (path: string) => {
        const request = {
          select: () => request,
          top: () => request,
          get: () => state.graphGet(path),
          patch: (body: unknown) => state.graphPatch(path, body),
          post: (body: unknown) => state.graphPost(path, body),
          delete: () => state.graphDelete(path),
        };
        return request;
      },
    }),
  },
}));
vi.mock('../sanitize-tip-tap-html', () => ({
  sanitizeTipTapHtml: async (html: string) => ({ html, inlineImages: [] }),
}));

const config = {
  auth: { userId: 'fixture-owner', email: 'owner@example.com', accessToken: '', refreshToken: '' },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('provider draft safety', () => {
  it('offers only the primary Gmail sender and accepted sending aliases', async () => {
    state.gmailProfile.mockResolvedValueOnce({ data: { emailAddress: 'owner@example.com' } });
    state.gmailAliases.mockResolvedValueOnce({
      data: {
        sendAs: [
          { sendAsEmail: 'owner@example.com', isPrimary: true },
          { sendAsEmail: 'verified@example.com', verificationStatus: 'accepted' },
          { sendAsEmail: 'pending@example.com', verificationStatus: 'pending' },
        ],
      },
    });
    expect(await new GoogleMailManager(config).getEmailAliases()).toEqual([
      { email: 'owner@example.com', primary: true },
      { email: 'verified@example.com', name: undefined, primary: false },
    ]);
  });

  it('writes the selected Gmail From address into the real saved MIME', async () => {
    state.gmailCreate.mockResolvedValueOnce({ data: { id: 'saved' } });
    await new GoogleMailManager(config).createDraft({
      id: null,
      threadId: null,
      fromEmail: 'alias@example.com',
      to: 'recipient@example.com',
      subject: 'Hello',
      message: '<p>Hi</p>',
    });
    const request = state.gmailCreate.mock.calls[0]![0] as {
      requestBody: { message: { raw: string } };
    };
    expect(Buffer.from(request.requestBody.message.raw, 'base64url').toString()).toMatch(
      /^From:.*alias@example.com/m,
    );
  });

  it('fails closed when a fresh original Gmail attachment cannot be retrieved', async () => {
    state.gmailMessage.mockResolvedValueOnce({
      data: {
        payload: {
          parts: [
            {
              filename: 'file.txt',
              mimeType: 'text/plain',
              body: { attachmentId: 'file', size: 5 },
            },
          ],
        },
      },
    });
    state.gmailAttachment.mockRejectedValueOnce(new Error('Attachment unavailable'));
    await expect(
      new GoogleMailManager(config).getMessageAttachments('source', {
        fresh: true,
        includeInline: true,
      }),
    ).rejects.toThrow();
    expect(state.gmailAttachment).toHaveBeenCalled();
  });
  it('does not replace or delete an Outlook draft when patch fails', async () => {
    state.graphPatch.mockRejectedValueOnce(new Error('temporary provider error'));
    const driver = new OutlookMailManager(config);
    await expect(
      driver.createDraft({
        id: 'existing',
        to: 'recipient@example.com',
        subject: 'Hi',
        message: '<p>Hello</p>',
        threadId: null,
        fromEmail: null,
      }),
    ).rejects.toThrow();
    expect(state.graphPatch).toHaveBeenCalledOnce();
    expect(state.graphPost).not.toHaveBeenCalled();
    expect(state.graphDelete).not.toHaveBeenCalled();
  });

  it('does not treat a sent Outlook message as a draft', async () => {
    state.graphGet.mockResolvedValueOnce({
      id: 'sent',
      isDraft: false,
      body: { content: 'private' },
    });
    await expect(new OutlookMailManager(config).getDraft('sent')).rejects.toThrow();
    expect(state.graphGet).toHaveBeenCalledTimes(1);
  });

  it('follows only a scoped Outlook drafts pagination cursor', async () => {
    const cursor =
      'https://graph.microsoft.com/v1.0/me/mailfolders/drafts/messages?$skiptoken=next';
    state.graphGet.mockResolvedValueOnce({ value: [] });
    expect(await new OutlookMailManager(config).listDrafts({ pageToken: cursor })).toEqual({
      threads: [],
      nextPageToken: null,
    });
    expect(state.graphGet).toHaveBeenCalledWith(cursor);
    state.graphGet.mockClear();
    await expect(
      new OutlookMailManager(config).listDrafts({
        pageToken: 'https://example.com/v1.0/me/mailfolders/drafts/messages',
      }),
    ).rejects.toThrow();
    expect(state.graphGet).not.toHaveBeenCalled();
  });

  it('reads nested Gmail MIME content and retains threading and quoted recipients', async () => {
    state.gmailGet.mockResolvedValueOnce({
      data: {
        id: 'draft',
        message: {
          threadId: 'thread',
          payload: {
            headers: [
              { name: 'to', value: '"Doe, Sam" <sam@example.com>' },
              { name: 'subject', value: 'Re: Hello' },
              { name: 'In-Reply-To', value: '<source@example.com>' },
              { name: 'References', value: '<prior@example.com>' },
            ],
            parts: [
              {
                mimeType: 'multipart/alternative',
                parts: [{ mimeType: 'text/html', body: { data: btoa('<p>Stored body</p>') } }],
              },
            ],
          },
        },
      },
    });
    const draft = await new GoogleMailManager(config).getDraft('draft');
    expect(draft).toMatchObject({
      id: 'draft',
      to: ['sam@example.com'],
      subject: 'Re: Hello',
      content: '<p>Stored body</p>',
      threadId: 'thread',
      inReplyTo: '<source@example.com>',
      references: '<prior@example.com>',
    });
  });

  it('converts plain-text Gmail drafts without losing newlines or interpreting HTML', async () => {
    state.gmailGet.mockResolvedValueOnce({
      data: {
        id: 'plain',
        message: { payload: { mimeType: 'text/plain', body: { data: btoa('Hi <Sam>\nHello') } } },
      },
    });
    const draft = await new GoogleMailManager(config).getDraft('plain');
    expect(draft.content).toContain('&lt;Sam&gt;<br>Hello');
  });

  it('rejects a partial Gmail draft when an attachment cannot be read', async () => {
    state.gmailGet.mockResolvedValueOnce({
      data: {
        id: 'attached',
        message: {
          id: 'message',
          payload: {
            parts: [
              {
                filename: 'file.txt',
                mimeType: 'text/plain',
                body: { attachmentId: 'attachment', size: 5 },
              },
            ],
          },
        },
      },
    });
    await expect(new GoogleMailManager(config).getDraft('attached')).rejects.toThrow();
  });
});
