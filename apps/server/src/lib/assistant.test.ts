import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParsedDraft } from './driver/types';
import { PGlite } from '@electric-sql/pglite';
import type { ParsedMessage } from '../types';
import { drizzle } from 'drizzle-orm/pglite';
import { readFile } from 'node:fs/promises';
import type { HonoContext } from '../ctx';
import { createHmac } from 'node:crypto';
import { Hono } from 'hono';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  execute: vi.fn(),
  ai: true,
  drafts: new Map<string, ParsedDraft>(),
  draftRead: vi.fn(),
  draftSave: vi.fn(),
  draftSend: vi.fn(),
  threadRead: vi.fn(),
  aliases: vi.fn(),
  contacts: vi.fn(),
  forwardRead: vi.fn(),
}));
const settings = vi.hoisted(() => ({
  KEIKI_API_KEY: 'fixture',
  KEIKI_AGENT_ID: 'shared-agent',
  KEIKI_WEBHOOK_SECRET: 'x'.repeat(40),
  KEIKI_PHOTON_LINE: '+15550000000',
  KEIKI_CALLBACK_URL: undefined as string | undefined,
  VITE_PUBLIC_APP_URL: 'https://zero.test',
  VITE_PUBLIC_BACKEND_URL: 'https://api.zero.test',
  HYPERDRIVE: { connectionString: 'unused' },
}));
vi.mock('../env', () => ({ env: settings }));
vi.mock('../db', () => ({ createDb: () => ({ db: state.db, conn: { end: async () => {} } }) }));
vi.mock('./ai-access', () => ({ isAiEnabledForUser: async () => state.ai }));
vi.mock('./server-utils', () => ({
  getZeroAgent: async (connectionId: string) => ({
    getDraft: (id: string) => state.draftRead(connectionId, id),
    createDraft: (input: unknown) => state.draftSave(connectionId, input),
    sendDraft: (id: string, input: unknown) => state.draftSend(connectionId, id, input),
    getThread: (id: string) => state.threadRead(connectionId, id),
    getEmailAliases: () => state.aliases(connectionId),
    searchContacts: (query: string, limit: number) => state.contacts(connectionId, query, limit),
    getForwardSource: (threadId: string, messageId: string) =>
      state.forwardRead(connectionId, threadId, messageId),
    listDrafts: async () => ({
      threads: [...state.drafts.entries()]
        .filter(([key]) => key.startsWith(`${connectionId}:`))
        .map(([, draft]) => ({ id: draft.id, $raw: draft })),
      nextPageToken: null,
    }),
  }),
}));
vi.mock('../routes/agent/tools', async () => {
  const { z } = await import('zod');
  return {
    tools: async (connectionId: string) => ({
      getThread: { parameters: z.object({ id: z.string() }) },
      getThreadSummary: {
        description: 'fixture read',
        parameters: z.object({ id: z.string() }),
        execute: async (input: unknown) => {
          state.execute(connectionId, input);
          return { connectionId };
        },
      },
      sendEmail: {
        description: 'fixture write',
        parameters: z.object({
          to: z.array(z.object({ email: z.string(), name: z.string().optional() })),
          subject: z.string(),
          message: z.string(),
        }),
        execute: async (input: unknown) => {
          state.execute(connectionId, input);
          return { success: true };
        },
      },
      composeEmail: {
        description: 'fixture compose',
        parameters: z.object({ prompt: z.string() }),
        execute: async (input: unknown) => {
          state.execute(connectionId, input);
          return { newBody: 'Hi!' };
        },
      },
    }),
  };
});
import {
  assistantTools,
  authorizedAssistantContext,
  bindAssistantConversation,
  configureAssistant,
  digest,
  ownedMailbox,
} from './assistant';
import { assistantApi, assistantHooks } from '../routes/assistant';

const pg = new PGlite();
const app = new Hono<HonoContext>()
  .use('*', async (c, next) => {
    const id = c.req.header('x-test-user');
    if (id)
      c.set('sessionUser', {
        id,
        email: `${id}@zero.test`,
        name: id,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    await next();
  })
  .route('/hooks', assistantHooks)
  .route('/api', assistantApi);
function api(
  path: string,
  userId?: string,
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST',
) {
  return app.request(`/api${path}`, {
    method,
    headers: {
      ...(userId ? { 'x-test-user': userId } : {}),
      Origin: settings.VITE_PUBLIC_APP_URL,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function hook(path: string, body: unknown, secret = settings.KEIKI_WEBHOOK_SECRET) {
  const raw = JSON.stringify(body);
  const timestamp = Date.now();
  return app.request(`/hooks${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-keiki-timestamp': String(timestamp),
      'x-keiki-signature': `sha256=${createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex')}`,
    },
    body: raw,
  });
}
function photon(
  handle = '+15551111111',
  text = 'hello',
  messageId = crypto.randomUUID(),
  isDm = true,
) {
  return {
    agent: { id: settings.KEIKI_AGENT_ID },
    sender: {
      channel: 'photon',
      teamId: settings.KEIKI_PHOTON_LINE,
      userId: handle,
      addressing: { isDm },
    },
    conversation: { id: handle },
    messages: [{ id: messageId, text }],
  };
}
const scopes = ['mail:read', 'mail:request_action'];
function webContext(userId = 'alice', id = `${userId}-chat`) {
  return {
    agentId: settings.KEIKI_AGENT_ID,
    phone: `api:${settings.KEIKI_AGENT_ID}:${id}`,
    channel: { channel: 'api', conversationId: id },
    principal: { userId, scopes },
  };
}
function photonContext(handle: string, userId = 'alice') {
  return {
    agentId: settings.KEIKI_AGENT_ID,
    phone: handle,
    channel: {
      channel: 'sms',
      provider: 'photon',
      gateway: settings.KEIKI_PHOTON_LINE,
      userId: handle,
      isDirect: true,
    },
    principal: { userId, scopes },
  };
}
async function loginLink(handle: string) {
  const { reply } = (await (await hook('/identity', photon(handle))).json()) as { reply: string };
  return new URL(reply.match(/https:\/\/\S+/)![0]).searchParams.get('token')!;
}
async function link(handle: string, userId: string) {
  const token = await loginLink(handle);
  const { command } = (await (await api(`/links/${token}`, userId, {})).json()) as {
    command: string;
  };
  return hook('/identity', photon(handle, command));
}
beforeAll(async () => {
  state.db = drizzle(pg);
  await pg.exec(`CREATE TABLE mail0_user (id text PRIMARY KEY, default_connection_id text);
    CREATE TABLE mail0_connection (id text PRIMARY KEY, user_id text REFERENCES mail0_user(id), email text, name text, picture text, access_token text, refresh_token text, scope text, provider_id text, expires_at timestamp, created_at timestamp, updated_at timestamp);`);
  await pg.exec(
    await readFile(
      new URL('../db/migrations/0039_account_assistants.sql', import.meta.url).pathname,
      'utf8',
    ),
  );
});
beforeEach(async () => {
  state.execute.mockClear();
  state.ai = true;
  state.drafts.clear();
  state.draftRead.mockReset().mockImplementation(async (connectionId: string, id: string) => {
    const draft = state.drafts.get(`${connectionId}:${id}`);
    if (!draft) throw new Error('Draft not found');
    return structuredClone(draft);
  });
  state.draftSave.mockReset().mockImplementation(async (connectionId: string, input) => {
    const id = input.id || 'saved-draft';
    state.drafts.set(`${connectionId}:${id}`, {
      id,
      to: input.to.split(', '),
      cc: input.cc ? input.cc.split(', ') : [],
      bcc: input.bcc ? input.bcc.split(', ') : [],
      subject: input.subject,
      content: input.message,
      threadId: input.threadId ?? undefined,
      inReplyTo: input.inReplyTo,
      references: input.references,
      fromEmail: input.fromEmail,
      attachments: (input.attachments ?? []).map(
        (file: { name: string; type: string; size: number; base64: string }) => ({
          filename: file.name,
          mimeType: file.type,
          size: file.size,
          body: file.base64,
        }),
      ),
    });
    return { id };
  });
  state.draftSend.mockReset().mockResolvedValue(undefined);
  state.threadRead.mockReset().mockResolvedValue({ messages: [] });
  state.aliases.mockReset().mockResolvedValue([]);
  state.contacts.mockReset().mockResolvedValue({
    contacts: [],
    hasMore: false,
    backfillComplete: true,
    source: 'known_mailbox_correspondents',
  });
  state.forwardRead.mockReset().mockRejectedValue(new Error('Source not found'));
  await pg.exec(`TRUNCATE mail0_user CASCADE;
    INSERT INTO mail0_user VALUES ('alice','alice-mail'),('bob','bob-mail');
    INSERT INTO mail0_connection (id,user_id,email) VALUES ('alice-mail','alice','alice@zero.test'),('bob-mail','bob','bob@zero.test');
    INSERT INTO mail0_assistant_conversation (id,user_id) VALUES ('alice-chat','alice'),('bob-chat','bob');`);
});

describe('owner-approved saved drafts', () => {
  const content = {
    to: [{ email: 'recipient@zero.test' }],
    subject: 'Hi',
    message: 'Hi Sam!\n\nAlice',
  };
  const request = (tool: string, input: unknown, traceId = 'draft-trace') =>
    hook(`/tools/${tool}`, {
      input: { connectionId: 'alice-mail', input },
      context: { ...webContext(), traceId },
    });
  async function save() {
    const response = await request('create_draft', content);
    expect(response.status).toBe(200);
    const { id } = (await response.json()) as { id: string };
    expect(state.draftSave).not.toHaveBeenCalled();
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(200);
    return {
      id,
      draft: (await (await request('get_draft', { draftId: 'saved-draft' })).json()) as {
        draftId: string;
        version: string;
        body: string;
      },
    };
  }

  it('saves only after approval, reads back the saved content and returns a real draft link', async () => {
    const { id, draft } = await save();
    expect(draft).toMatchObject({ draftId: 'saved-draft', saved: true, sent: false });
    expect(state.draftSave).toHaveBeenCalledOnce();
    const status = await (
      await hook('/tools/get_action_status', { input: { id }, context: webContext() })
    ).json();
    expect(status).toMatchObject({
      status: 'completed',
      result: {
        draftId: 'saved-draft',
        saved: true,
        sent: false,
        verified: true,
        url: 'https://zero.test/assistant/draft/alice-mail/saved-draft',
      },
    });
    expect(state.draftSend).not.toHaveBeenCalled();
    expect((await api('/drafts/alice-mail/saved-draft', 'alice')).status).toBe(200);
    expect((await api('/drafts/alice-mail/saved-draft', 'bob')).status).toBe(400);
  });

  it('updates the same draft, preserving untouched fields and blocking duplicate approvals', async () => {
    const { draft } = await save();
    const response = await request('update_draft', {
      draftId: draft.draftId,
      version: draft.version,
      message: 'Updated greeting',
    });
    expect(response.status).toBe(200);
    const { id } = (await response.json()) as { id: string };
    expect(state.draftSave).toHaveBeenCalledTimes(1);
    expect((await api(`/actions/${id}`, 'bob', { approve: true })).status).toBe(409);
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(200);
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(409);
    expect(state.draftSave).toHaveBeenLastCalledWith(
      'alice-mail',
      expect.objectContaining({
        id: 'saved-draft',
        subject: 'Hi',
        to: 'recipient@zero.test',
        message: expect.stringContaining('Updated greeting'),
      }),
    );
    expect(state.drafts.size).toBe(1);
    expect(state.draftSend).not.toHaveBeenCalled();
  });

  it('refuses stale updates both when requested and at approval time', async () => {
    const { draft } = await save();
    expect(
      (
        await request('update_draft', {
          draftId: draft.draftId,
          version: '0'.repeat(64),
          message: 'wrong',
        })
      ).status,
    ).toBe(409);
    const response = await request('update_draft', {
      draftId: draft.draftId,
      version: draft.version,
      message: 'change',
    });
    const { id } = (await response.json()) as { id: string };
    state.drafts.get('alice-mail:saved-draft')!.content = 'Owner edited in mailbox';
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(409);
    expect(state.draftSave).toHaveBeenCalledTimes(1);
  });

  it('sends a saved snapshot only through a separate owner approval', async () => {
    const { draft } = await save();
    const response = await request('send_draft', {
      draftId: draft.draftId,
      version: draft.version,
    });
    expect(response.status).toBe(200);
    const { id } = (await response.json()) as { id: string };
    expect(state.draftSend).not.toHaveBeenCalled();
    const preview = await (await api(`/actions/${id}`, 'alice')).json();
    expect(preview).toMatchObject({
      input: { draft: { to: 'recipient@zero.test', subject: 'Hi' } },
    });
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(200);
    expect(state.draftSend).toHaveBeenCalledExactlyOnceWith(
      'alice-mail',
      'saved-draft',
      expect.objectContaining({ subject: 'Hi', to: [{ email: 'recipient@zero.test' }] }),
    );
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(409);
  });

  it('refuses to send a draft changed after approval was requested', async () => {
    const { draft } = await save();
    const { id } = (await (
      await request('send_draft', { draftId: draft.draftId, version: draft.version })
    ).json()) as { id: string };
    state.drafts.get('alice-mail:saved-draft')!.to = ['different@zero.test'];
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(409);
    expect(state.draftSend).not.toHaveBeenCalled();
  });

  it('does not read another mailbox, leak attachment bytes, or claim unsaved text is a draft', async () => {
    state.drafts.set('bob-mail:private', { id: 'private', content: 'private body' });
    expect(
      (
        await hook('/tools/get_draft', {
          input: { connectionId: 'bob-mail', input: { draftId: 'private' } },
          context: webContext(),
        })
      ).status,
    ).toBe(400);
    expect(state.draftRead).not.toHaveBeenCalled();
    state.drafts.set('alice-mail:attached', {
      id: 'attached',
      to: ['recipient@zero.test'],
      content: 'body',
      attachments: [{ filename: 'file.txt', mimeType: 'text/plain', size: 6, body: 'c2VjcmV0' }],
    });
    const response = await request('get_draft', { draftId: 'attached' });
    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).not.toContain('c2VjcmV0');
  });

  it('reuses a create request across retries without saving twice or extending expiry', async () => {
    const first = await request('create_draft', content);
    const result = (await first.json()) as { id: string };
    expect(first.status).toBe(200);
    expect(await (await request('create_draft', content)).json()).toEqual(result);
    expect((await api(`/actions/${result.id}`, 'alice', { approve: true })).status).toBe(200);
    expect(await (await request('create_draft', content)).json()).toMatchObject({
      id: result.id,
      status: 'completed',
    });
    expect(state.draftSave).toHaveBeenCalledOnce();
  });

  it('retains the real draft ID when save succeeds but preview read-back fails', async () => {
    const response = await request('create_draft', content);
    const { id } = (await response.json()) as { id: string };
    expect(response.status).toBe(200);
    state.draftRead.mockRejectedValueOnce(new Error('temporary provider error'));
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(200);
    const status = await (
      await hook('/tools/get_action_status', { input: { id }, context: webContext() })
    ).json();
    expect(status).toMatchObject({
      result: { draftId: 'saved-draft', saved: true, verified: false },
    });
    expect(state.draftSave).toHaveBeenCalledOnce();
  });

  it('grounds reply recipients and threading in the fetched message rather than model guesses', async () => {
    state.threadRead.mockResolvedValue({
      messages: [
        {
          id: 'source',
          sender: { email: 'sender@zero.test' },
          replyTo: 'reply@zero.test',
          subject: 'Question',
          messageId: '<source@zero.test>',
          references: '<prior@zero.test>',
        },
      ],
    });
    const thread = await (await request('get_thread', { id: 'thread' })).json();
    expect(thread).toMatchObject({
      id: 'thread',
      messages: [{ id: 'source', replyTo: 'reply@zero.test' }],
    });
    const response = await request('create_reply_draft', {
      threadId: 'thread',
      replyToMessageId: 'source',
      message: 'The answer is yes.',
    });
    expect(response.status).toBe(200);
    const { id } = (await response.json()) as { id: string };
    expect(state.threadRead).toHaveBeenCalledWith('alice-mail', 'thread');
    expect(state.draftSave).not.toHaveBeenCalled();
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(200);
    expect(state.draftSave).toHaveBeenCalledWith(
      'alice-mail',
      expect.objectContaining({
        to: 'reply@zero.test',
        subject: 'Re: Question',
        threadId: 'thread',
        replyToMessageId: 'source',
        inReplyTo: '<source@zero.test>',
        references: '<prior@zero.test> <source@zero.test>',
      }),
    );
  });

  it('blocks fake reply threads and accidental recipient substitutions', async () => {
    expect((await request('create_draft', { ...content, subject: 'Re: Fake' })).status).toBe(400);
    expect(
      (
        await request('create_reply_draft', {
          threadId: 'missing',
          replyToMessageId: 'source',
          message: 'Yes',
        })
      ).status,
    ).toBe(400);
    state.threadRead.mockResolvedValue({
      messages: [{ id: 'source', sender: { email: 'sender@zero.test' }, subject: 'Question' }],
    });
    expect(
      (
        await request('create_reply_draft', {
          threadId: 'thread',
          replyToMessageId: 'source',
          to: [{ email: 'wrong@zero.test' }],
          message: 'Yes',
        })
      ).status,
    ).toBe(400);
    expect(state.draftSave).not.toHaveBeenCalled();
  });

  it('does not accept placeholder reply fields on a standalone draft', async () => {
    const response = await request('create_draft', {
      ...content,
      threadId: '/dev/null',
      replyToMessageId: '/dev/null',
    });
    expect(response.status).toBe(400);
    expect(state.threadRead).not.toHaveBeenCalled();
    expect(state.draftSave).not.toHaveBeenCalled();
  });

  it('preserves attachment bytes and threading when editing a saved draft', async () => {
    state.drafts.set('alice-mail:attached', {
      id: 'attached',
      to: ['recipient@zero.test'],
      subject: 'Reply',
      content: '<p>Old</p>',
      threadId: 'thread',
      inReplyTo: '<message@zero.test>',
      references: '<prior@zero.test>',
      attachments: [{ filename: 'file.txt', mimeType: 'text/plain', size: 6, body: 'c2VjcmV0' }],
    });
    const draft = (await (await request('get_draft', { draftId: 'attached' })).json()) as {
      version: string;
    };
    const response = await request('update_draft', {
      draftId: 'attached',
      version: draft.version,
      message: 'New',
    });
    const { id } = (await response.json()) as { id: string };
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(200);
    expect(state.draftSave).toHaveBeenCalledWith(
      'alice-mail',
      expect.objectContaining({
        id: 'attached',
        threadId: 'thread',
        inReplyTo: '<message@zero.test>',
        references: '<prior@zero.test>',
        attachments: [expect.objectContaining({ name: 'file.txt', base64: 'c2VjcmV0' })],
      }),
    );
    expect(JSON.stringify(await (await api(`/actions/${id}`, 'alice')).json())).not.toContain(
      'c2VjcmV0',
    );
  });

  it('rejects model-supplied action snapshots and legacy draft-send bypasses', async () => {
    expect(
      (await request('create_draft', { ...content, draft: { fromEmail: 'wrong@zero.test' } }))
        .status,
    ).toBe(400);
    expect((await request('send_email', { ...content, draftId: 'unknown' })).status).toBe(400);
    expect(state.draftSave).not.toHaveBeenCalled();
    expect(state.draftSend).not.toHaveBeenCalled();
  });

  it('does not save a declined, expired or AI-disabled draft action', async () => {
    const first = (await (await request('create_draft', content, 'decline')).json()) as {
      id: string;
    };
    expect((await api(`/actions/${first.id}`, 'alice', { approve: false })).status).toBe(200);
    expect((await api(`/actions/${first.id}`, 'alice', { approve: true })).status).toBe(409);
    const second = (await (await request('create_draft', content, 'expired')).json()) as {
      id: string;
    };
    await pg.query('UPDATE mail0_assistant_action SET expires_at = $1 WHERE id = $2', [
      new Date(0),
      second.id,
    ]);
    expect((await api(`/actions/${second.id}`, 'alice', { approve: true })).status).toBe(409);
    const third = (await (await request('create_draft', content, 'disabled')).json()) as {
      id: string;
    };
    state.ai = false;
    expect((await api(`/actions/${third.id}`, 'alice', { approve: true })).status).toBe(403);
    expect(state.draftSave).not.toHaveBeenCalled();
  });

  it('never queues drafts without mutation scope or returns an ID after an uncertain save', async () => {
    const denied = await hook('/tools/create_draft', {
      input: { connectionId: 'alice-mail', input: content },
      context: { ...webContext(), principal: { userId: 'alice', scopes: ['mail:read'] } },
    });
    expect(denied.status).toBe(403);
    const { id } = (await (await request('create_draft', content)).json()) as { id: string };
    state.draftSave.mockResolvedValueOnce({ success: false });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(500);
    } finally {
      log.mockRestore();
    }
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(409);
    expect(state.draftSave).toHaveBeenCalledOnce();
  });
  it('requires stable mutation trace IDs and lists only the selected mailbox drafts', async () => {
    expect(
      (await hook('/tools/create_draft', { input: { input: content }, context: webContext() }))
        .status,
    ).toBe(400);
    state.drafts.set('alice-mail:owned', { id: 'owned', subject: 'Owned draft' });
    state.drafts.set('bob-mail:private', { id: 'private', subject: 'Private draft' });
    const response = await request('list_drafts', {});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      drafts: [
        {
          draftId: 'owned',
          subject: 'Owned draft',
          url: 'https://zero.test/assistant/draft/alice-mail/owned',
        },
      ],
      nextPageToken: null,
    });
  });
});
afterAll(() => pg.close());

describe('reply recipients and real forwards', () => {
  const message = (): ParsedMessage => ({
    title: 'Invoice',
    tags: [],
    tls: false,
    unread: false,
    body: '',
    processedHtml: '',
    blobUrl: '',
    id: 'source',
    subject: 'Re: Invoice',
    sender: { email: 'sam@zero.test', name: 'Sam' },
    replyTo: 'reply@zero.test',
    to: [{ email: 'alice@zero.test' }, { email: 'other@zero.test' }],
    cc: [{ email: 'team@zero.test' }, { email: 'OTHER@zero.test' }],
    bcc: [{ email: 'hidden@zero.test' }],
    messageId: '<source@zero.test>',
    references: '<prior@zero.test>',
    receivedOn: '2026-10-15T10:00:00Z',
    decodedBody: '<p>Original <a href="https://example.com/invoice">invoice</a></p>',
    attachments: [
      {
        filename: 'invoice.txt',
        mimeType: 'text/plain',
        size: 5,
        body: '',
        attachmentId: 'file',
        headers: [],
      },
    ],
  });
  const forward = () => ({
    message: message(),
    attachments: [
      { filename: 'invoice.txt', mimeType: 'text/plain', size: 5, body: 'aGVsbG8=', headers: [] },
    ],
  });
  const request = (name: string, input: unknown, connectionId = 'alice-mail') =>
    hook(`/tools/${name}`, {
      input: { connectionId, input },
      context: { ...webContext(), traceId: 'recipient-trace' },
    });
  const reply = (extra: Record<string, unknown> = {}) => ({
    threadId: 'thread',
    replyToMessageId: 'source',
    message: 'Yes',
    ...extra,
  });
  const fwd = (extra: Record<string, unknown> = {}) => ({
    threadId: 'thread',
    forwardMessageId: 'source',
    to: [{ email: 'destination@zero.test' }],
    ...extra,
  });

  it('freezes deterministic reply-all To/Cc and never inherits Bcc', async () => {
    state.threadRead.mockResolvedValue({ messages: [message()] });
    const { id } = (await (
      await request('create_reply_draft', reply({ mode: 'reply_all' }))
    ).json()) as { id: string };
    const action = await (await api(`/actions/${id}`, 'alice')).json();
    expect(action).toMatchObject({
      preview: {
        fromEmail: 'alice@zero.test',
        to: 'reply@zero.test, other@zero.test',
        cc: 'team@zero.test',
        bcc: '',
      },
    });
    expect(state.draftSave).not.toHaveBeenCalled();
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(200);
    expect(state.draftSave).toHaveBeenCalledWith(
      'alice-mail',
      expect.objectContaining({
        to: 'reply@zero.test, other@zero.test',
        cc: 'team@zero.test',
        bcc: '',
      }),
    );
  });

  it('supports user-requested recipient overrides, including explicitly clearing Cc', async () => {
    state.threadRead.mockResolvedValue({ messages: [message()] });
    const response = await request(
      'create_reply_draft',
      reply({ mode: 'reply_all', overrides: { to: [{ email: 'only@zero.test' }], cc: [] } }),
    );
    expect(response.status).toBe(200);
    const { id } = (await response.json()) as { id: string };
    expect(await (await api(`/actions/${id}`, 'alice')).json()).toMatchObject({
      preview: { to: 'only@zero.test', cc: '', bcc: '' },
    });
  });

  it('prefers the unique To identity over an alias copied on Cc', async () => {
    const source = message();
    source.to = [{ email: 'alice@zero.test' }];
    source.cc = [{ email: 'alias@zero.test' }, { email: 'team@zero.test' }];
    state.aliases.mockResolvedValue([{ email: 'alias@zero.test' }]);
    state.threadRead.mockResolvedValue({ messages: [source] });
    const response = await request('create_reply_draft', reply({ mode: 'reply_all' }));
    expect(response.status).toBe(200);
    const { id } = (await response.json()) as { id: string };
    expect(await (await api(`/actions/${id}`, 'alice')).json()).toMatchObject({
      preview: { fromEmail: 'alice@zero.test', cc: 'team@zero.test' },
    });
  });

  it('requires a sender choice when multiple verified aliases are direct recipients', async () => {
    const source = message();
    source.to = [{ email: 'alice@zero.test' }, { email: 'alias@zero.test' }];
    state.threadRead.mockResolvedValue({ messages: [source] });
    state.aliases.mockResolvedValue([{ email: 'alias@zero.test' }]);
    const ambiguous = await request('create_reply_draft', reply());
    expect(ambiguous.status).toBe(400);
    expect(await ambiguous.json()).toMatchObject({ code: 'sender_ambiguous' });
    const explicit = await request(
      'create_reply_draft',
      reply({ overrides: { fromEmail: 'alias@zero.test' } }),
    );
    expect(explicit.status).toBe(200);
    expect(state.draftSave).not.toHaveBeenCalled();
  });

  it('selects a verified receiving alias as From, persists it, and refuses unverified From overrides', async () => {
    const source = message();
    source.to = [{ email: 'alias@zero.test' }];
    source.cc = [];
    state.threadRead.mockResolvedValue({ messages: [source] });
    state.aliases.mockResolvedValue([{ email: 'alias@zero.test', name: 'Alice Alias' }]);
    const response = await request('create_reply_draft', reply());
    expect(response.status).toBe(200);
    const { id } = (await response.json()) as { id: string };
    expect(await (await api(`/actions/${id}`, 'alice')).json()).toMatchObject({
      preview: { fromEmail: 'alias@zero.test' },
    });
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(200);
    expect(state.draftSave).toHaveBeenCalledWith(
      'alice-mail',
      expect.objectContaining({ fromEmail: 'alias@zero.test' }),
    );
    const saved = (await (await request('get_draft', { draftId: 'saved-draft' })).json()) as {
      version: string;
    };
    const send = (await (
      await request('send_draft', { draftId: 'saved-draft', version: saved.version })
    ).json()) as { id: string };
    expect((await api(`/actions/${send.id}`, 'alice', { approve: true })).status).toBe(200);
    expect(state.draftSend).toHaveBeenCalledWith(
      'alice-mail',
      'saved-draft',
      expect.objectContaining({ fromEmail: 'alias@zero.test' }),
    );
    const invalid = await request(
      'create_reply_draft',
      reply({ overrides: { fromEmail: 'not-owned@zero.test' } }),
    );
    expect(invalid.status).toBe(400);
  });

  it('allows another owned sender mailbox, but never another account’s credentials', async () => {
    await pg.exec(
      `INSERT INTO mail0_connection (id,user_id,email) VALUES ('alice-work','alice','work@zero.test');`,
    );
    state.threadRead.mockResolvedValue({ messages: [message()] });
    const response = await request(
      'create_reply_draft',
      reply({ overrides: { senderConnectionId: 'alice-work' } }),
    );
    expect(response.status).toBe(200);
    const { id } = (await response.json()) as { id: string };
    expect(await (await api(`/actions/${id}`, 'alice')).json()).toMatchObject({
      connectionId: 'alice-work',
      preview: { fromEmail: 'work@zero.test' },
    });
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(200);
    expect(state.draftSave).toHaveBeenCalledWith(
      'alice-work',
      expect.objectContaining({
        fromEmail: 'work@zero.test',
        threadId: null,
        inReplyTo: '<source@zero.test>',
      }),
    );
    const calls = state.threadRead.mock.calls.length;
    expect(
      (
        await request(
          'create_reply_draft',
          reply({ overrides: { senderConnectionId: 'bob-mail' } }),
        )
      ).status,
    ).toBe(400);
    expect(state.threadRead).toHaveBeenCalledTimes(calls);
  });

  it('rechecks source ownership even when a different owned mailbox would save the draft', async () => {
    await pg.exec(
      `INSERT INTO mail0_connection (id,user_id,email) VALUES ('alice-work','alice','work@zero.test');`,
    );
    state.threadRead.mockResolvedValue({ messages: [message()] });
    const { id } = (await (
      await request(
        'create_reply_draft',
        reply({ overrides: { senderConnectionId: 'alice-work' } }),
      )
    ).json()) as { id: string };
    await pg.exec(`UPDATE mail0_connection SET user_id='bob' WHERE id='alice-mail';`);
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(400);
    expect(state.draftSave).not.toHaveBeenCalled();
  });

  it('does not fabricate cross-mailbox Outlook threading', async () => {
    await pg.exec(
      `INSERT INTO mail0_connection (id,user_id,email,provider_id) VALUES ('alice-outlook','alice','outlook@zero.test','microsoft');`,
    );
    const response = await request(
      'create_reply_draft',
      reply({ overrides: { senderConnectionId: 'alice-outlook' } }),
    );
    expect(response.status).toBe(400);
    expect(state.threadRead).not.toHaveBeenCalled();
    expect(state.draftSave).not.toHaveBeenCalled();
  });

  it('preserves saved inline content through a separate send approval', async () => {
    state.drafts.set('alice-mail:inline', {
      id: 'inline',
      fromEmail: 'alice@zero.test',
      to: ['destination@zero.test'],
      subject: 'Fwd: Image',
      content: '<p>Original</p><img src="cid:logo@x">',
      attachments: [
        {
          filename: 'logo.png',
          mimeType: 'image/png',
          size: 5,
          body: 'aGVsbG8=',
          headers: [{ name: 'Content-ID', value: '<logo@x>' }],
        },
      ],
    });
    const saved = (await (await request('get_draft', { draftId: 'inline' })).json()) as {
      version: string;
    };
    const response = await request('send_draft', { draftId: 'inline', version: saved.version });
    expect(response.status).toBe(200);
    const { id } = (await response.json()) as { id: string };
    expect(state.draftSend).not.toHaveBeenCalled();
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(200);
    expect(state.draftSend).toHaveBeenCalledWith(
      'alice-mail',
      'inline',
      expect.objectContaining({
        message: expect.stringContaining('data:image/png;base64,aGVsbG8='),
        attachments: [],
      }),
    );
  });

  it('returns scoped contact candidates without auto-selecting ambiguous names or queuing mutations', async () => {
    state.contacts.mockResolvedValue({
      contacts: [
        { email: 'sarah1@zero.test', name: 'Sarah A' },
        { email: 'sarah2@zero.test', name: 'Sarah B' },
      ],
      hasMore: false,
      backfillComplete: true,
      source: 'known_mailbox_correspondents',
    });
    const response = await request('search_contacts', { query: 'Sarah' });
    expect(response.status).toBe(200);
    expect(state.contacts).toHaveBeenCalledExactlyOnceWith('alice-mail', 'Sarah', 10);
    expect(await response.json()).toMatchObject({
      contacts: [{ email: 'sarah1@zero.test' }, { email: 'sarah2@zero.test' }],
    });
    expect((await request('search_contacts', { query: 'Sarah' }, 'bob-mail')).status).toBe(400);
    expect(state.contacts).toHaveBeenCalledOnce();
    expect((await pg.query('SELECT * FROM mail0_assistant_action')).rows).toHaveLength(0);
  });

  it('creates a forward from stored HTML and attachments only after owner approval', async () => {
    state.forwardRead.mockResolvedValue(forward());
    const response = await request('create_forward_draft', fwd({ note: 'Please review' }));
    expect(response.status).toBe(200);
    const { id } = (await response.json()) as { id: string };
    const action = await (await api(`/actions/${id}`, 'alice')).json();
    expect(action).toMatchObject({
      preview: {
        to: 'destination@zero.test',
        cc: '',
        bcc: '',
        subject: 'Fwd: Invoice',
        attachments: [{ filename: 'invoice.txt' }],
      },
    });
    expect(JSON.stringify(action)).not.toContain('hidden@zero.test');
    expect(JSON.stringify(action)).not.toContain('aGVsbG8=');
    expect(state.draftSave).not.toHaveBeenCalled();
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(200);
    expect(state.forwardRead).toHaveBeenCalledTimes(2);
    expect(state.draftSave).toHaveBeenCalledWith(
      'alice-mail',
      expect.objectContaining({
        isForward: true,
        subject: 'Fwd: Invoice',
        message: expect.stringContaining('<a href="https://example.com/invoice">invoice</a>'),
        attachments: [expect.objectContaining({ name: 'invoice.txt', base64: 'aGVsbG8=' })],
      }),
    );
    expect(state.draftSend).not.toHaveBeenCalled();
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(409);
  });

  it('refuses missing or invented destinations, model-reconstructed forwards, and unavailable attachments', async () => {
    expect(
      (await request('create_forward_draft', { threadId: 'thread', forwardMessageId: 'source' }))
        .status,
    ).toBe(400);
    expect((await request('create_forward_draft', fwd({ to: [{ email: 'Sarah' }] }))).status).toBe(
      400,
    );
    expect(
      (await request('create_forward_draft', fwd({ message: 'Invented original' }))).status,
    ).toBe(400);
    expect(state.forwardRead).not.toHaveBeenCalled();
    state.forwardRead.mockResolvedValue({ message: message(), attachments: [] });
    expect((await request('create_forward_draft', fwd())).status).toBe(409);
    expect(state.draftSave).not.toHaveBeenCalled();
  });

  it('blocks source/attachment changes between forward review and approval', async () => {
    state.forwardRead.mockResolvedValue(forward());
    const { id } = (await (await request('create_forward_draft', fwd())).json()) as { id: string };
    const changed = forward();
    changed.attachments[0]!.body = 'Y2hhbmdlZA==';
    state.forwardRead.mockResolvedValue(changed);
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(409);
    expect(state.draftSave).not.toHaveBeenCalled();
  });

  it('forwards through a different owned sender while fetching the source only from its own mailbox', async () => {
    await pg.exec(
      `INSERT INTO mail0_connection (id,user_id,email) VALUES ('alice-work','alice','work@zero.test');`,
    );
    state.forwardRead.mockResolvedValue(forward());
    const response = await request(
      'create_forward_draft',
      fwd({ overrides: { senderConnectionId: 'alice-work' } }),
    );
    expect(response.status).toBe(200);
    const { id } = (await response.json()) as { id: string };
    expect(await (await api(`/actions/${id}`, 'alice')).json()).toMatchObject({
      connectionId: 'alice-work',
      preview: { fromEmail: 'work@zero.test' },
    });
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(200);
    expect(state.forwardRead).toHaveBeenNthCalledWith(1, 'alice-mail', 'thread', 'source');
    expect(state.forwardRead).toHaveBeenNthCalledWith(2, 'alice-mail', 'thread', 'source');
    expect(state.draftSave).toHaveBeenCalledWith(
      'alice-work',
      expect.objectContaining({
        fromEmail: 'work@zero.test',
        subject: 'Fwd: Invoice',
      }),
    );
    expect(state.draftSave.mock.calls[0]?.[1].replyToMessageId).toBeUndefined();
  });

  it('rechecks alias availability before executing an approved save', async () => {
    state.threadRead.mockResolvedValue({ messages: [message()] });
    state.aliases.mockResolvedValue([{ email: 'alias@zero.test' }]);
    const { id } = (await (
      await request('create_reply_draft', reply({ overrides: { fromEmail: 'alias@zero.test' } }))
    ).json()) as { id: string };
    state.aliases.mockResolvedValue([]);
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(400);
    expect(state.draftSave).not.toHaveBeenCalled();
  });

  it('changes a saved draft’s From alias in place and can recover from a revoked old alias', async () => {
    state.drafts.set('alice-mail:existing', {
      id: 'existing',
      fromEmail: 'alice@zero.test',
      to: ['destination@zero.test'],
      subject: 'Reply',
      content: '<p>Body</p>',
    });
    state.aliases.mockResolvedValue([{ email: 'alias@zero.test' }]);
    let draft = (await (await request('get_draft', { draftId: 'existing' })).json()) as {
      version: string;
    };
    const change = await request('update_draft', {
      draftId: 'existing',
      version: draft.version,
      fromEmail: 'alias@zero.test',
    });
    expect(change.status).toBe(200);
    const { id } = (await change.json()) as { id: string };
    expect(state.draftSave).not.toHaveBeenCalled();
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(200);
    expect(state.draftSave).toHaveBeenCalledWith(
      'alice-mail',
      expect.objectContaining({ id: 'existing', fromEmail: 'alias@zero.test' }),
    );
    state.aliases.mockResolvedValue([]);
    draft = (await (await request('get_draft', { draftId: 'existing' })).json()) as {
      version: string;
    };
    const reset = await request('update_draft', {
      draftId: 'existing',
      version: draft.version,
      fromEmail: 'alice@zero.test',
    });
    expect(reset.status).toBe(200);
    const result = (await reset.json()) as { id: string };
    expect((await api(`/actions/${result.id}`, 'alice', { approve: true })).status).toBe(200);
    expect(state.drafts.get('alice-mail:existing')?.fromEmail).toBe('alice@zero.test');
    draft = (await (await request('get_draft', { draftId: 'existing' })).json()) as {
      version: string;
    };
    expect(
      (
        await request('update_draft', {
          draftId: 'existing',
          version: draft.version,
          fromEmail: 'bob@zero.test',
        })
      ).status,
    ).toBe(400);
    expect(state.drafts.size).toBe(1);
  });
});

describe('one Keiki agent with account-scoped conversation principals', () => {
  it('uses the same agent for both accounts without provisioning per-user agents', async () => {
    expect((await bindAssistantConversation('alice', 'new-alice-chat')).agentId).toBe(
      settings.KEIKI_AGENT_ID,
    );
    expect((await bindAssistantConversation('bob', 'new-bob-chat')).agentId).toBe(
      settings.KEIKI_AGENT_ID,
    );
    await expect(bindAssistantConversation('bob', 'alice-chat')).rejects.toThrow();
    expect((await ownedMailbox('alice')).id).toBe('alice-mail');
    await expect(ownedMailbox('alice', 'bob-mail')).rejects.toThrow();
  });
  it('configures only one shared deployment and generic scoped tools', async () => {
    let payload: Record<string, unknown> | undefined;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      payload = JSON.parse(String(init?.body));
      return Response.json({
        deployment: {
          externalRef: 'zero-shared-gateway',
          agent: { id: settings.KEIKI_AGENT_ID, name: 'Zero Shared Gateway' },
          channels: [],
        },
      });
    });
    try {
      await configureAssistant();
      expect(payload).toMatchObject({
        external_ref: 'zero-shared-gateway',
        agent: { features: { imessageApps: true } },
        identity: { webhook_url: 'https://api.zero.test/api/assistant/hooks/identity' },
      });
      const prompt = (payload?.agent as { system_prompt: string }).system_prompt;
      expect(prompt).toContain('compose_email only generates unsaved text');
      expect(prompt).toContain('for draft/write-only requests');
      expect(prompt).toContain('call send_email with the final content');
      expect(prompt).toContain('show that exact URL');
      expect(prompt.toLowerCase()).toContain('nothing has been sent or changed until');
      expect(prompt).toContain('presentationDelivery.state = accepted');
      expect(prompt).toContain('never claim a card was delivered');
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      fetchMock.mockRestore();
    }
    settings.KEIKI_CALLBACK_URL = 'https://callback.zero.test/';
    try {
      for (const tool of await assistantTools()) {
        expect(new URL(tool.webhookUrl).origin).toBe('https://callback.zero.test');
        expect(new URL(tool.webhookUrl).pathname).toMatch(/^\/api\/assistant\/hooks\/tools\//);
        expect(tool.policy?.requiredScopes?.length).toBe(1);
        const writes = tool.policy?.requiredScopes?.[0] === 'mail:request_action';
        expect(tool.policy).toMatchObject(
          writes
            ? {
                approval: 'ask',
                approvalProof: 'verified',
                approvalFallback: 'tool',
                preflight: true,
              }
            : { requiredScopes: ['mail:read'] },
        );
        if (!writes) expect(tool.policy).not.toHaveProperty('approval');
      }
    } finally {
      settings.KEIKI_CALLBACK_URL = undefined;
    }
  });
  it('reports missing credentials and does not provision anything implicitly', async () => {
    const key = settings.KEIKI_API_KEY;
    settings.KEIKI_API_KEY = '';
    try {
      await expect(bindAssistantConversation('alice', 'new')).rejects.toThrow('KEIKI_API_KEY');
    } finally {
      settings.KEIKI_API_KEY = key;
    }
  });
  it('requires authentic callbacks and denies groups before looking up mailbox data', async () => {
    expect((await app.request('/hooks/identity', { method: 'POST', body: '{}' })).status).toBe(401);
    const result = (await (
      await hook('/identity', photon('+15551111111', 'hello', crypto.randomUUID(), false))
    ).json()) as { userId: unknown; reply: string };
    expect(result.userId).toBeNull();
    expect(result.reply).toBeTruthy();
    expect((await pg.query('SELECT * FROM mail0_assistant_link')).rows).toHaveLength(0);
  });
  it('requires OAuth plus proof from the originating iMessage identity', async () => {
    const handle = '+15551111111';
    const token = await loginLink(handle);
    expect((await api(`/links/${token}`)).status).toBe(401);
    const { command } = (await (await api(`/links/${token}`, 'alice', {})).json()) as {
      command: string;
    };
    await hook('/identity', photon('+15552222222', command));
    expect((await pg.query('SELECT * FROM mail0_assistant_identity')).rows).toHaveLength(0);
    await hook('/identity', photon(handle, command));
    const result = await (await hook('/identity', photon(handle))).json();
    expect(result).toMatchObject({ userId: 'alice', scopes, ttlSeconds: 0 });
    expect((await api(`/links/${token}`, 'alice', {})).status).toBe(404);
  });
  it('resolves two senders to different principals on the same agent and line', async () => {
    await link('+15551111111', 'alice');
    await link('+15552222222', 'bob');
    expect(await (await hook('/identity', photon('+15551111111'))).json()).toMatchObject({
      userId: 'alice',
    });
    expect(await (await hook('/identity', photon('+15552222222'))).json()).toMatchObject({
      userId: 'bob',
    });
    expect(await authorizedAssistantContext(photonContext('+15551111111', 'alice'))).toBe('alice');
    expect(await authorizedAssistantContext(photonContext('+15551111111', 'bob'))).toBeUndefined();
  });
  it('bounds login attempts but makes provider delivery retries idempotent', async () => {
    const event = photon('+15553333333');
    const first = await (await hook('/identity', event)).json();
    for (let i = 0; i < 5; i++) await hook('/identity', photon('+15553333333'));
    expect((await pg.query('SELECT * FROM mail0_assistant_link')).rows).toHaveLength(5);
    expect(await (await hook('/identity', event)).json()).toEqual(first);
  });
  it('rejects expired codes and never reassigns an existing messaging identity to a different account', async () => {
    const handle = '+15551111111';
    const token = await loginLink(handle);
    const { command } = (await (await api(`/links/${token}`, 'alice', {})).json()) as {
      command: string;
    };
    await pg.query('UPDATE mail0_assistant_link SET expires_at = $1 WHERE token_hash = $2', [
      new Date(0),
      await digest(token),
    ]);
    await hook('/identity', photon(handle, command));
    expect((await pg.query('SELECT * FROM mail0_assistant_identity')).rows).toHaveLength(0);
    await link(handle, 'alice');
    const { id } = (await pg.query<{ id: string }>('SELECT id FROM mail0_assistant_identity'))
      .rows[0]!;
    await api(`/identities/${id}`, 'alice', undefined, 'DELETE');
    await link(handle, 'bob');
    expect((await pg.query('SELECT user_id,active FROM mail0_assistant_identity')).rows).toEqual([
      { user_id: 'alice', active: false },
    ]);
  });
  it('revokes queued tool access and pending connection codes immediately on disconnect', async () => {
    const handle = '+15551111111';
    await link(handle, 'alice');
    const { id } = (await pg.query<{ id: string }>('SELECT id FROM mail0_assistant_identity'))
      .rows[0]!;
    await api(`/identities/${id}`, 'alice', undefined, 'DELETE');
    expect(await authorizedAssistantContext(photonContext(handle))).toBeUndefined();
    const token = await loginLink(handle);
    const { command } = (await (await api(`/links/${token}`, 'alice', {})).json()) as {
      command: string;
    };
    await api(`/identities/${id}`, 'alice', undefined, 'DELETE');
    await hook('/identity', photon(handle, command));
    expect(await authorizedAssistantContext(photonContext(handle))).toBeUndefined();
  });
  it('authorizes web conversations from server-owned bindings, not supplied account IDs', async () => {
    const request = (userId: string, id: string) => ({
      agent: { id: settings.KEIKI_AGENT_ID },
      sender: { channel: 'api', conversationId: id },
      conversation: { id: `api:${settings.KEIKI_AGENT_ID}:${id}` },
      userId,
    });
    expect(await (await hook('/identity', request('bob', 'alice-chat'))).json()).toMatchObject({
      userId: 'alice',
    });
    const unknown = (await (await hook('/identity', request('alice', 'missing'))).json()) as {
      userId: unknown;
      reply: string;
    };
    expect(unknown.userId).toBeNull();
    expect(unknown.reply).toBeTruthy();
    expect(await authorizedAssistantContext(webContext('bob', 'alice-chat'))).toBeUndefined();
  });
  it('checks current account and mailbox ownership on every generic tool call', async () => {
    const body = {
      input: { connectionId: 'alice-mail', input: { id: 'thread' } },
      context: webContext(),
    };
    expect((await hook('/tools/get_thread_summary', body, 'wrong-secret')).status).toBe(401);
    expect((await hook('/tools/get_thread_summary', body)).status).toBe(200);
    expect(state.execute).toHaveBeenCalledWith('alice-mail', { id: 'thread' });
    state.execute.mockClear();
    body.context = webContext('bob', 'alice-chat');
    expect((await hook('/tools/get_thread_summary', body)).status).toBe(403);
    expect(state.execute).not.toHaveBeenCalled();
    body.context = webContext();
    body.input.connectionId = 'bob-mail';
    expect((await hook('/tools/get_thread_summary', body)).status).toBe(400);
    expect(state.execute).not.toHaveBeenCalled();
  });
  it('requires discovery IDs and returns actionable, non-leaking mailbox errors', async () => {
    for (const connectionId of ['alice@zero.test', 'missing', 'bob-mail', 'bob@zero.test']) {
      const response = await hook('/tools/compose_email', {
        input: { connectionId, input: { prompt: 'Say hi' } },
        context: webContext(),
      });
      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result).toMatchObject({ code: 'mailbox_selection_required' });
      expect(JSON.stringify(result)).toContain('list_mailboxes');
      expect(JSON.stringify(result)).not.toContain('bob');
    }
    expect(state.execute).not.toHaveBeenCalled();
    const discovery = await hook('/tools/list_mailboxes', { input: {}, context: webContext() });
    expect(await discovery.json()).toEqual({
      mailboxes: [{ connectionId: 'alice-mail', email: 'alice@zero.test' }],
    });
    const retry = await hook('/tools/compose_email', {
      input: { connectionId: 'alice-mail', input: { prompt: 'Say hi' } },
      context: webContext(),
    });
    expect(retry.status).toBe(200);
    expect(state.execute).toHaveBeenCalledExactlyOnceWith('alice-mail', { prompt: 'Say hi' });
  });
  it('uses only an owned default and asks for selection when no mailbox is unambiguous', async () => {
    await pg.exec(
      `INSERT INTO mail0_connection (id,user_id,email) VALUES ('alice-other','alice','other@zero.test');`,
    );
    expect((await ownedMailbox('alice')).id).toBe('alice-mail');
    await pg.exec(`UPDATE mail0_user SET default_connection_id = NULL WHERE id = 'alice';`);
    await expect(ownedMailbox('alice')).rejects.toThrow('list_mailboxes');
    await pg.exec(`UPDATE mail0_user SET default_connection_id = 'bob-mail' WHERE id = 'alice';`);
    await expect(ownedMailbox('alice')).rejects.toThrow('list_mailboxes');
    await pg.exec(`UPDATE mail0_user SET default_connection_id = NULL WHERE id = 'alice';
      DELETE FROM mail0_connection WHERE id = 'alice-other';`);
    expect((await ownedMailbox('alice')).id).toBe('alice-mail');
    await pg.exec(`DELETE FROM mail0_connection WHERE user_id = 'alice';`);
    await expect(ownedMailbox('alice')).rejects.toThrow('list_mailboxes');
  });
  it('returns field-level 400 errors for malformed inputs and 404 for unknown tools', async () => {
    for (const [tool, input, path] of [
      ['compose_email', { connectionId: '', input: { prompt: 'hi' } }, ['connectionId']],
      ['compose_email', { input: {} }, ['prompt']],
      ['send_email', { input: { to: [], message: 'hi' } }, ['subject']],
      ['get_action_status', {}, ['id']],
    ] as const) {
      const response = await hook(`/tools/${tool}`, { input, context: webContext() });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: 'invalid_tool_input',
        issues: expect.arrayContaining([expect.objectContaining({ path })]),
      });
    }
    const unknown = await hook('/tools/unknown', { input: { input: {} }, context: webContext() });
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toMatchObject({ code: 'unknown_tool' });
    expect(state.execute).not.toHaveBeenCalled();
    expect((await pg.query('SELECT * FROM mail0_assistant_action')).rows).toHaveLength(0);
  });
  it('labels composition as unsaved text and never implicitly persists or requests a send', async () => {
    const definitions = await assistantTools();
    expect(definitions.find((tool) => tool.name === 'compose_email')?.description).toContain(
      'Does not save a mailbox draft or send anything',
    );
    expect(definitions.find((tool) => tool.name === 'send_email')?.description).toContain(
      'Request owner approval',
    );
    const response = await hook('/tools/compose_email', {
      input: { input: { prompt: 'Write a greeting' } },
      context: webContext(),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      newBody: 'Hi!',
      status: 'generated',
      saved: false,
      sent: false,
      instructions: expect.stringContaining('call send_email'),
    });
    expect(state.execute).toHaveBeenCalledExactlyOnceWith('alice-mail', {
      prompt: 'Write a greeting',
    });
    expect((await pg.query('SELECT * FROM mail0_assistant_action')).rows).toHaveLength(0);
  });
  it('answers a Keiki preflight without recording or running the action, and rejects a bad mailbox first', async () => {
    const handle = '+15551111111';
    await link(handle, 'alice');
    const payload = { to: [{ email: 'recipient@zero.test' }], subject: 'Hi', message: 'Private' };
    const context = { ...photonContext(handle), traceId: 'preflight-trace', preflight: true };
    const ok = await hook('/tools/send_email', {
      input: { connectionId: 'alice-mail', input: payload },
      context,
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true, preflight: true });
    const bad = await hook('/tools/send_email', {
      input: { connectionId: 'gmail', input: payload },
      context,
    });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ code: 'mailbox_selection_required' });
    expect(state.execute).not.toHaveBeenCalled();
    expect((await pg.query('SELECT * FROM mail0_assistant_action')).rows).toHaveLength(0);
  });
  it('requests Keiki presentation without credentials, delivery claims or bypassing owner approval', async () => {
    const handle = '+15551111111';
    await link(handle, 'alice');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (target) =>
        String(target).includes('imessageAvailability')
          ? Response.json({ isAvailable: true })
          : Response.json({ message: { guid: 'review-card' } }),
      );
    try {
      const payload = { to: [{ email: 'recipient@zero.test' }], subject: 'Hi', message: 'Private' };
      const request = {
        input: { connectionId: 'alice-mail', input: payload },
        context: { ...photonContext(handle), traceId: 'card-trace' },
      };
      const response = await hook('/tools/send_email', request);
      expect(response.status).toBe(200);
      const result = (await response.json()) as { id: string };
      expect(result).toMatchObject({
        status: 'confirmation_required',
        presentation: {
          type: 'app',
          id: result.id,
          url: `https://zero.test/assistant/action/${result.id}`,
          caption: 'Review Zero action',
          subcaption: 'Sign in to review and approve',
        },
        instructions: expect.stringContaining('presentationDelivery.state = accepted'),
      });
      expect(result).not.toHaveProperty('presentationDelivery');
      expect(result).not.toHaveProperty('approval');
      expect(state.execute).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      expect((await api(`/actions/${result.id}`, undefined, { approve: true })).status).toBe(401);
      expect((await api(`/actions/${result.id}`, 'bob', { approve: true })).status).toBe(409);
      expect(state.execute).not.toHaveBeenCalled();
      expect((await api(`/actions/${result.id}`, 'alice', { approve: true })).status).toBe(200);
      expect(state.execute).toHaveBeenCalledExactlyOnceWith('alice-mail', payload);
      const completed = await (await hook('/tools/send_email', request)).json();
      expect(completed).toMatchObject({
        id: result.id,
        status: 'completed',
      });
      expect(completed).not.toHaveProperty('presentation');
      expect(fetchMock).not.toHaveBeenCalled();
      expect((await api(`/actions/${result.id}`, 'alice', { approve: true })).status).toBe(409);
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('retains browser fallback without delivery support and skips expired or revoked presentations', async () => {
    const handle = '+15551111111';
    await link(handle, 'alice');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 503 }));
    try {
      const request = {
        input: {
          connectionId: 'alice-mail',
          input: { to: [{ email: 'recipient@zero.test' }], subject: 'Hi', message: 'Private' },
        },
        context: { ...photonContext(handle), traceId: 'failed-card-trace' },
      };
      const response = await hook('/tools/send_email', request);
      expect(response.status).toBe(200);
      const result = (await response.json()) as { id: string };
      expect(result).toMatchObject({
        status: 'confirmation_required',
        url: `https://zero.test/assistant/action/${result.id}`,
        instructions: expect.stringContaining('Otherwise show this exact URL'),
      });
      expect(state.execute).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      await pg.query('UPDATE mail0_assistant_action SET expires_at = $1 WHERE id = $2', [
        new Date(0),
        result.id,
      ]);
      const expired = await (await hook('/tools/send_email', request)).json();
      expect(expired).toMatchObject({
        expired: true,
      });
      expect(expired).not.toHaveProperty('presentation');
      expect(fetchMock).not.toHaveBeenCalled();
      await pg.exec('UPDATE mail0_assistant_identity SET active = false');
      expect((await hook('/tools/send_email', request)).status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(state.execute).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('only executes the exact owner-approved action once', async () => {
    const payload = {
      to: [{ email: 'recipient@zero.test' }],
      subject: 'Hello',
      message: 'approved content',
    };
    const response = await hook('/tools/send_email', {
      input: { connectionId: 'alice-mail', input: payload },
      context: { ...webContext(), traceId: 'trace-1' },
    });
    const { id } = (await response.json()) as { id: string };
    expect(state.execute).not.toHaveBeenCalled();
    expect((await api(`/actions/${id}`, 'bob')).status).toBe(404);
    const results = await Promise.all([
      api(`/actions/${id}`, 'alice', { approve: true, input: { message: 'tampered' } }),
      api(`/actions/${id}`, 'alice', { approve: true }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(state.execute).toHaveBeenCalledExactlyOnceWith('alice-mail', payload);
  });
  it('creates an immutable pending send with an actual link, idempotently across callback retries', async () => {
    const payload = { to: [{ email: 'recipient@zero.test' }], subject: 'Hello', message: 'Hi!' };
    const request = {
      input: { connectionId: 'alice-mail', input: payload },
      context: { ...webContext(), traceId: 'send-trace' },
    };
    const first = await hook('/tools/send_email', request);
    expect(first.status).toBe(200);
    const result = (await first.json()) as { id: string; url: string };
    expect(result).toMatchObject({
      status: 'confirmation_required',
      url: `https://zero.test/assistant/action/${result.id}`,
      instructions: expect.stringContaining('has NOT executed'),
    });
    expect(await (await hook('/tools/send_email', request)).json()).toEqual(result);
    expect((await pg.query('SELECT * FROM mail0_assistant_action')).rows).toHaveLength(1);
    expect(state.execute).not.toHaveBeenCalled();
    expect((await api(`/actions/${result.id}`, 'bob', { approve: true })).status).toBe(409);
    expect((await api(`/actions/${result.id}`, undefined, { approve: true })).status).toBe(401);
    expect(state.execute).not.toHaveBeenCalled();
    expect((await api(`/actions/${result.id}`, 'alice')).status).toBe(200);
    expect((await api(`/actions/${result.id}`, 'alice', { approve: true })).status).toBe(200);
    expect(await (await hook('/tools/send_email', request)).json()).toMatchObject({
      id: result.id,
      status: 'completed',
    });
    expect(state.execute).toHaveBeenCalledExactlyOnceWith('alice-mail', payload);
    expect((await pg.query('SELECT * FROM mail0_assistant_action')).rows).toHaveLength(1);
  });
  it('never queues sends without the request-action scope or for another owner mailbox', async () => {
    const input = {
      connectionId: 'alice-mail',
      input: { to: [{ email: 'recipient@zero.test' }], subject: 'Hello', message: 'Hi!' },
    };
    expect(
      (
        await hook('/tools/send_email', {
          input,
          context: { ...webContext(), principal: { userId: 'alice', scopes: ['mail:read'] } },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await hook('/tools/send_email', {
          input: { ...input, connectionId: 'bob-mail' },
          context: webContext(),
        })
      ).status,
    ).toBe(400);
    expect(state.execute).not.toHaveBeenCalled();
    expect((await pg.query('SELECT * FROM mail0_assistant_action')).rows).toHaveLength(0);
  });
  it('does not renew expired sends or execute after mailbox ownership changes', async () => {
    const request = {
      input: {
        input: { to: [{ email: 'recipient@zero.test' }], subject: 'Hello', message: 'Hi!' },
      },
      context: { ...webContext(), traceId: 'stale-send' },
    };
    const { id } = (await (await hook('/tools/send_email', request)).json()) as { id: string };
    await pg.query('UPDATE mail0_assistant_action SET expires_at = $1 WHERE id = $2', [
      new Date(0),
      id,
    ]);
    expect(await (await hook('/tools/send_email', request)).json()).toMatchObject({
      id,
      expired: true,
    });
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(409);
    await pg.query('UPDATE mail0_assistant_action SET expires_at = $1 WHERE id = $2', [
      new Date(Date.now() + 60_000),
      id,
    ]);
    await pg.exec(`UPDATE mail0_connection SET user_id = 'bob' WHERE id = 'alice-mail';`);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(400);
    } finally {
      log.mockRestore();
    }
    expect((await api(`/actions/${id}`, 'alice', { approve: true })).status).toBe(409);
    expect(state.execute).not.toHaveBeenCalled();
  });
  it('does not permit an identity callback to be replayed as an integration setup command', async () => {
    expect((await hook('/setup', photon())).status).toBe(400);
  });
  it('deleting one account revokes only its bindings, not the shared agent or another account', async () => {
    await pg.exec(
      "DELETE FROM mail0_connection WHERE user_id='alice'; DELETE FROM mail0_user WHERE id='alice';",
    );
    expect(await authorizedAssistantContext(webContext())).toBeUndefined();
    expect(await authorizedAssistantContext(webContext('bob'))).toBe('bob');
    expect(settings.KEIKI_AGENT_ID).toBe('shared-agent');
  });
  it('respects AI-off settings and rejects cross-origin approvals', async () => {
    state.ai = false;
    await expect(bindAssistantConversation('alice', 'new')).rejects.toThrow();
    expect((await api('/actions/anything', 'alice', { approve: true })).status).toBe(403);
    expect(
      (
        await app.request('/api/links/token', {
          method: 'POST',
          headers: { 'x-test-user': 'alice', Origin: 'https://attacker.test' },
        })
      ).status,
    ).toBe(403);
  });
});
