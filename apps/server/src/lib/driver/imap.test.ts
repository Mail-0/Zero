import { ImapMailManager, testImapSmtpSettings, type ImapDriverDeps } from './imap';
import { MemoryImapServer, sampleMessage } from '../imap/testing/memory-server';
import { FakeMailServer } from '../mail-transport/fake-socket';
import type { SocketFactory } from '../mail-transport/socket';
import { CredentialCipher } from '../crypto/credentials';
import type { LabelStorage } from '../mail-label-store';
import { describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

const KEY = `1:${btoa(String.fromCharCode(...new Uint8Array(32).fill(7)))}`;

const storage = (): LabelStorage => {
  const db = new DatabaseSync(':memory:');
  return {
    exec: (query, ...args) => {
      const statement = db.prepare(query);
      return /^\s*(SELECT|PRAGMA)/i.test(query)
        ? (statement.all(...args) as Record<string, string | number | null>[])
        : (statement.run(...args), []);
    },
    transaction: (fn) => {
      db.exec('BEGIN');
      try {
        fn();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
};

const smtpServer = () => {
  const messages: { from: string; to: string[]; data: string }[] = [];
  let current: { from: string; to: string[]; data: string } | null = null;
  let inData = false;
  const server = new FakeMailServer('220 ready\r\n', (line, { tls }) => {
    if (inData) {
      if (line === '.') {
        inData = false;
        messages.push(current!);
        return '250 ok\r\n';
      }
      current!.data += `${line}\r\n`;
      return;
    }
    if (line.startsWith('EHLO'))
      return ['250-hi\r\n', ...(tls ? [] : ['250-STARTTLS\r\n']), '250 AUTH PLAIN\r\n'];
    if (line === 'STARTTLS') return '220 go\r\n';
    if (line.startsWith('AUTH PLAIN')) return '235 ok\r\n';
    if (line.startsWith('MAIL FROM:')) {
      current = { from: /<(.*)>/.exec(line)![1]!, to: [], data: '' };
      return '250 ok\r\n';
    }
    if (line.startsWith('RCPT TO:')) {
      current!.to.push(/<(.*)>/.exec(line)![1]!);
      return '250 ok\r\n';
    }
    if (line === 'DATA') {
      inData = true;
      return '354 go\r\n';
    }
    if (line === 'QUIT') return '221 bye\r\n';
    return '500 ?\r\n';
  });
  return { server, messages };
};

const setup = async () => {
  const imap = new MemoryImapServer();
  imap.addFolder('Sent', '\\Sent');
  imap.addFolder('Drafts', '\\Drafts');
  imap.addFolder('Trash', '\\Trash');
  imap.addFolder('Junk', '\\Junk');
  const smtp = smtpServer();
  const socketFactory: SocketFactory = (options) =>
    options.port === 587 ? smtp.server.factory(options) : imap.factory(options);
  const cipher = new CredentialCipher(KEY);
  const blobs = new Map<string, Uint8Array>();
  const deps: ImapDriverDeps = {
    socketFactory,
    cipher,
    blobs: {
      get: async (key) => blobs.get(key) ?? null,
      put: async (key, value) => void blobs.set(key, value),
    },
    oauthClients: {},
  };
  const driver = new ImapMailManager(
    {
      auth: {
        userId: 'u1',
        email: 'me@example.com',
        accessToken: 'imap:managed',
        refreshToken: 'imap:managed',
      },
      storage: storage(),
      imap: {
        connectionId: 'conn-1',
        displayName: 'Me',
        imap: { host: 'imap.example.com', port: 993, security: 'tls', username: 'me@example.com' },
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          security: 'starttls',
          username: 'me@example.com',
        },
        authMethod: 'password',
        secret: await cipher.encrypt('pw', 'conn-1'),
        serverSavesSent: false,
      },
    },
    deps,
  );
  return { imap, smtp, driver, blobs };
};

const syncAll = async (driver: ImapMailManager) => {
  for (let i = 0; i < 10; i++) if ((await driver.syncMailbox()).complete) break;
  const ids = driver.pendingThreadChanges(100);
  driver.acknowledgeThreadChanges(ids);
  return ids;
};

describe('ImapMailManager', () => {
  it('syncs, threads and parses messages with folder/flag labels', async () => {
    const { imap, driver, blobs } = await setup();
    imap.deliver('INBOX', sampleMessage({ messageId: 'a@x', subject: 'Lunch?', body: 'Pizza' }));
    imap.deliver(
      'Sent',
      sampleMessage({
        messageId: 'b@x',
        subject: 'Re: Lunch?',
        from: 'me@example.com',
        inReplyTo: 'a@x',
        references: ['a@x'],
      }),
      ['\\Seen'],
    );
    const ids = await syncAll(driver);
    expect(ids).toHaveLength(1);

    const thread = await driver.get(ids[0]!);
    expect(thread.messages.map((m) => m.subject)).toEqual(['Lunch?', 'Re: Lunch?']);
    expect(thread.messages[0]!.tags.map((t) => t.id).sort()).toEqual([
      'CATEGORY_PERSONAL',
      'INBOX',
      'UNREAD',
    ]);
    expect(thread.messages[1]!.tags.map((t) => t.id)).toEqual(['SENT']);
    expect(thread.messages[0]!.decodedBody).toContain('Pizza');
    expect(thread.hasUnread).toBe(true);
    expect(blobs.size).toBe(2);
    await driver.dispose();
  });

  it('maps label mutations onto flags and folder moves', async () => {
    const { imap, driver } = await setup();
    imap.deliver('INBOX', sampleMessage({ messageId: 'm@x' }));
    const [threadId] = await syncAll(driver);

    await driver.markAsRead([threadId!]);
    expect(imap.folders.get('INBOX')!.messages[0]!.flags).toContain('\\Seen');

    await driver.modifyLabels([threadId!], { addLabels: ['STARRED'], removeLabels: [] });
    expect(imap.folders.get('INBOX')!.messages[0]!.flags).toContain('\\Flagged');

    // Archive: no Archive folder exists, so one is created.
    await driver.modifyLabels([threadId!], { addLabels: [], removeLabels: ['INBOX'] });
    expect(imap.folders.get('INBOX')!.messages).toHaveLength(0);
    expect(imap.folders.get('Archive')!.messages).toHaveLength(1);
    let thread = await driver.get(threadId!);
    expect(thread.messages[0]!.tags.map((t) => t.id).sort()).toEqual([
      'ARCHIVE',
      'CATEGORY_PERSONAL',
      'STARRED',
    ]);

    // Trash, then restore to the inbox.
    await driver.modifyLabels([threadId!], { addLabels: ['TRASH'], removeLabels: ['INBOX'] });
    expect(imap.folders.get('Archive')!.messages).toHaveLength(1);
    await driver.modifyLabels([threadId!], { addLabels: ['TRASH'], removeLabels: [] });
    expect(imap.folders.get('Trash')!.messages).toHaveLength(1);
    await driver.modifyLabels([threadId!], { addLabels: [], removeLabels: ['TRASH'] });
    expect(imap.folders.get('INBOX')!.messages).toHaveLength(1);
    thread = await driver.get(threadId!);
    expect(thread.messages[0]!.tags.map((t) => t.id)).toContain('INBOX');
    await driver.dispose();
  });

  it('sends via SMTP without Bcc, files a Sent copy and threads the reply', async () => {
    const { imap, smtp, driver } = await setup();
    imap.deliver('INBOX', sampleMessage({ messageId: 'q@x', subject: 'Question' }));
    const [threadId] = await syncAll(driver);

    const result = await driver.create({
      to: [{ email: 'alice@example.com', name: 'Alice' }],
      bcc: [{ email: 'secret@example.com' }],
      subject: 'Re: Question',
      message: '<p>Answer</p>',
      attachments: [],
      headers: {},
      threadId,
    });
    expect(smtp.messages).toHaveLength(1);
    expect(smtp.messages[0]!.to.sort()).toEqual(['alice@example.com', 'secret@example.com']);
    expect(smtp.messages[0]!.data).not.toMatch(/^Bcc:/im);
    expect(smtp.messages[0]!.data).toMatch(/^In-Reply-To: <q@x>/im);
    expect(imap.folders.get('Sent')!.messages).toHaveLength(1);
    expect(result.threadId).toBe(threadId);
    const thread = await driver.get(threadId!);
    expect(thread.messages.map((m) => m.subject)).toEqual(['Question', 'Re: Question']);
    await driver.dispose();
  });

  it('creates, updates, reads and deletes drafts with a stable id', async () => {
    const { imap, driver } = await setup();
    await syncAll(driver);
    const base = {
      to: 'bob@example.com',
      subject: 'Draft',
      message: '<p>v1</p>',
      id: null,
      threadId: null,
      fromEmail: null,
    };
    const created = await driver.createDraft(base);
    expect(imap.folders.get('Drafts')!.messages).toHaveLength(1);
    const updated = await driver.createDraft({ ...base, id: created.id!, message: '<p>v2</p>' });
    expect(updated.id).toBe(created.id);
    expect(imap.folders.get('Drafts')!.messages).toHaveLength(1);

    const draft = await driver.getDraft(created.id!);
    expect(draft).toMatchObject({ id: created.id, to: ['bob@example.com'], subject: 'Draft' });
    expect(draft.content).toContain('v2');
    const listed = await driver.listDrafts({});
    expect(listed.threads.map((t) => t.id)).toEqual([created.id]);

    await driver.deleteDraft(created.id!);
    expect(imap.folders.get('Drafts')!.messages).toHaveLength(0);
    await driver.dispose();
  });

  it('searches with Gmail-style queries', async () => {
    const { imap, driver } = await setup();
    imap.deliver(
      'INBOX',
      sampleMessage({ messageId: 's1@x', subject: 'Invoice 42', from: 'billing@shop.com' }),
    );
    imap.deliver('INBOX', sampleMessage({ messageId: 's2@x', subject: 'Hello' }));
    await syncAll(driver);
    const result = await driver.list({ folder: 'inbox', query: 'from:billing subject:invoice' });
    expect(result.threads).toHaveLength(1);
    const thread = await driver.get(result.threads[0]!.id);
    expect(thread.messages[0]!.subject).toBe('Invoice 42');
    await driver.dispose();
  });

  it('answers label-only queries like All Mail from the local index', async () => {
    const { imap, driver } = await setup();
    imap.deliver(
      'INBOX',
      sampleMessage({ messageId: 'in@x', subject: 'Inbox mail', date: new Date('2026-01-02') }),
    );
    imap.deliver(
      'Sent',
      sampleMessage({ messageId: 'out@x', subject: 'Sent mail', date: new Date('2026-01-03') }),
      ['\\Seen'],
    );
    imap.deliver('Drafts', sampleMessage({ messageId: 'd@x', subject: 'Draft' }), ['\\Draft']);
    imap.deliver('Junk', sampleMessage({ messageId: 'j@x', subject: 'Spam' }));
    await syncAll(driver);
    const subjects = async (query: string) => {
      const { threads } = await driver.list({ folder: 'inbox', query });
      return Promise.all(threads.map(async (t) => (await driver.get(t.id)).messages[0]!.subject));
    };
    expect(await subjects('NOT is:draft (is:inbox OR (is:sent AND to:me))')).toEqual([
      'Inbox mail',
    ]);
    expect(await subjects('is:unread')).toEqual(expect.arrayContaining(['Inbox mail', 'Spam']));
    expect(await subjects('in:sent')).toEqual(['Sent mail']);
    expect(await subjects('is:important NOT is:sent NOT is:draft')).toEqual([]);
    await driver.dispose();
  });

  it('stores tag labels as keywords without moving mail or creating folders', async () => {
    const { imap, driver } = await setup();
    imap.deliver('INBOX', sampleMessage({ messageId: 't@x', subject: 'Invoice' }));
    const [threadId] = await syncAll(driver);
    const foldersBefore = [...imap.folders.keys()].sort();

    await driver.createLabel({ name: 'Billing' }, { kind: 'tag' });
    // Idempotent by name.
    await driver.createLabel({ name: 'billing' }, { kind: 'tag' });
    expect([...imap.folders.keys()].sort()).toEqual(foldersBefore);
    const labels = await driver.getUserLabels();
    const billing = labels.find((label) => label.name === 'Billing')!;
    expect(billing.id).toMatch(/^K_/);
    expect(labels.filter((label) => label.name.toLowerCase() === 'billing')).toHaveLength(1);

    const result = await driver.applyTagLabels([threadId!], [billing.id], []);
    expect(result.unsupported).toEqual([]);
    const message = imap.folders.get('INBOX')!.messages[0]!;
    expect(message.flags).toContain('Zero_Billing');
    let thread = await driver.get(threadId!);
    expect(thread.messages[0]!.tags).toContainEqual({
      id: billing.id,
      name: 'Billing',
      type: 'user',
    });
    expect(imap.folders.get('INBOX')!.messages).toHaveLength(1);

    // Survives a re-sync and is listable as a label.
    await syncAll(driver);
    expect((await driver.list({ folder: 'inbox', labelIds: [billing.id] })).threads).toHaveLength(
      1,
    );

    // Rename keeps the keyword; delete untags the messages.
    await driver.updateLabel(billing.id, { name: 'Invoices' });
    thread = await driver.get(threadId!);
    expect(thread.messages[0]!.tags).toContainEqual({
      id: billing.id,
      name: 'Invoices',
      type: 'user',
    });
    await driver.applyTagLabels([threadId!], [], [billing.id]);
    expect(message.flags).not.toContain('Zero_Billing');
    await driver.applyTagLabels([threadId!], [billing.id], []);
    await driver.deleteLabel(billing.id);
    expect(message.flags).not.toContain('Zero_Billing');
    expect((await driver.getUserLabels()).some((label) => label.id === billing.id)).toBe(false);
    await driver.dispose();
  });

  it('reports tag labels the server cannot store, and never moves for folder labels', async () => {
    const { imap, driver } = await setup();
    imap.permanentFlags = ['\\Seen', '\\Flagged', '\\Deleted', '\\Draft'];
    imap.addFolder('Projects');
    imap.deliver('INBOX', sampleMessage({ messageId: 'n@x' }));
    const [threadId] = await syncAll(driver);
    await driver.createLabel({ name: 'Later' }, { kind: 'tag' });
    const labels = await driver.getUserLabels();
    const later = labels.find((label) => label.name === 'Later')!;
    const projects = labels.find((label) => label.name === 'Projects')!;

    const result = await driver.applyTagLabels([threadId!], [later.id, projects.id], []);
    expect(result.unsupported.sort()).toEqual([later.id, projects.id].sort());
    expect(imap.folders.get('INBOX')!.messages[0]!.flags).not.toContain('Zero_Later');
    expect(imap.folders.get('Projects')!.messages).toHaveLength(0);
    await driver.dispose();
  });

  it('surfaces keywords set by other clients as labels', async () => {
    const { imap, driver } = await setup();
    imap.deliver('INBOX', sampleMessage({ messageId: 'k@x' }), ['work', '$NotJunk']);
    const [threadId] = await syncAll(driver);
    const labels = await driver.getUserLabels();
    expect(labels.map((label) => label.name)).toContain('work');
    expect(labels.map((label) => label.name)).not.toContain('NotJunk');
    const thread = await driver.get(threadId!);
    expect(thread.messages[0]!.tags.map((tag) => tag.name)).toContain('work');
    await driver.dispose();
  });

  it('serves Gmail-style category tabs from header rules and AI overrides', async () => {
    const { imap, driver } = await setup();
    imap.deliver(
      'Sent',
      sampleMessage({ messageId: 'out@x', from: 'me@example.com', to: 'support@vendor.com' }),
      ['\\Seen'],
    );
    imap.deliver('INBOX', sampleMessage({ messageId: 'p@x', subject: 'Lunch' }));
    imap.deliver(
      'INBOX',
      sampleMessage({
        messageId: 'promo@x',
        subject: 'Sale',
        from: 'Shop <news@shop.com>',
        headers: ['List-Unsubscribe: <https://shop.com/u>'],
      }),
    );
    imap.deliver(
      'INBOX',
      sampleMessage({ messageId: 'u@x', subject: 'Receipt', from: 'no-reply@store.com' }),
    );
    imap.deliver(
      'INBOX',
      sampleMessage({ messageId: 'c@x', subject: 'Ticket', from: 'support@vendor.com' }),
    );
    await syncAll(driver);
    const tab = async (query: string) => {
      const { threads } = await driver.list({ folder: 'inbox', query });
      return (
        await Promise.all(threads.map(async (t) => (await driver.get(t.id)).messages[0]!.subject))
      ).sort();
    };
    // The default category queries (lib/schemas.ts) are answered locally.
    expect(await tab('is:personal NOT is:sent NOT is:draft')).toEqual(['Lunch', 'Ticket']);
    expect(await tab('is:promotions NOT is:sent NOT is:draft')).toEqual(['Sale']);
    expect(await tab('is:updates NOT is:sent NOT is:draft')).toEqual(['Receipt']);

    // An AI override moves the thread between tabs.
    const [receipt] = (await driver.list({ folder: 'inbox', query: 'is:updates' })).threads;
    expect(await driver.setThreadCategory(receipt!.id, 'promotions', 'ai')).toBe(true);
    expect(await tab('is:promotions')).toEqual(['Receipt', 'Sale']);
    // The user's choice wins over later AI runs.
    await driver.setThreadCategory(receipt!.id, 'personal', 'user');
    expect(await driver.setThreadCategory(receipt!.id, 'updates', 'ai')).toBe(false);
    expect(await tab('is:personal')).toEqual(['Lunch', 'Receipt', 'Ticket']);
    await driver.dispose();
  });

  it('pushes inbox changes over IDLE on a dedicated connection', async () => {
    const { imap, driver } = await setup();
    imap.capabilities.push('IDLE');
    imap.deliver('INBOX', sampleMessage({ messageId: 'a@x' }));
    const [threadId] = await syncAll(driver);

    const waiting = driver.waitForInboxChange({ maxMs: 5000 });
    await vi.waitFor(() => expect(imap.idleCount).toBe(1));
    // The command connection keeps working while the push connection idles.
    await driver.markAsRead([threadId!]);
    expect(imap.folders.get('INBOX')!.messages[0]!.flags).toContain('\\Seen');
    imap.deliver('INBOX', sampleMessage({ messageId: 'b@x' }));
    expect(await waiting).toBe('changed');
    expect(imap.idleCount).toBe(0);
    // The new mail is picked up by the next sync (alongside the read-flag change).
    const changed = await syncAll(driver);
    const subjects = await Promise.all(changed.map(async (id) => (await driver.get(id)).messages));
    expect(subjects.flat().map((m) => m.messageId)).toEqual(expect.arrayContaining(['<b@x>']));

    expect(await driver.waitForInboxChange({ maxMs: 50 })).toBe('timeout');
    const abort = new AbortController();
    const aborted = driver.waitForInboxChange({ maxMs: 5000, signal: abort.signal });
    await vi.waitFor(() => expect(imap.idleCount).toBe(1));
    abort.abort();
    expect(await aborted).toBe('aborted');
    expect(imap.idleCount).toBe(0);
    await driver.dispose();
  });

  it('reports IDLE as unsupported when the server lacks it', async () => {
    const { driver } = await setup();
    await syncAll(driver);
    expect(await driver.waitForInboxChange({ maxMs: 1000 })).toBe('unsupported');
    await driver.dispose();
  });

  it('maps auth failures to a reconnect error', async () => {
    const { imap, driver } = await setup();
    imap.password = 'changed';
    await expect(driver.syncMailbox()).rejects.toThrow(/invalid_grant/);
  });

  it('testImapSmtpSettings reports both sides', async () => {
    const { imap, smtp } = await setup();
    const factory: SocketFactory = (options) =>
      options.port === 587 ? smtp.server.factory(options) : imap.factory(options);
    const result = await testImapSmtpSettings(
      {
        imap: { host: 'imap.example.com', port: 993, security: 'tls', username: 'me@example.com' },
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          security: 'starttls',
          username: 'me@example.com',
        },
        auth: { method: 'password', password: 'wrong' },
      },
      factory,
    );
    expect(result.imap).toMatchObject({ ok: false, kind: 'auth' });
    expect(result.smtp.ok).toBe(true);
  });

  it('refreshes XOAUTH2 tokens and persists rotated refresh tokens', async () => {
    const imap = new MemoryImapServer();
    imap.capabilities.push('AUTH=XOAUTH2');
    imap.accessToken = 'fresh-token';
    const cipher = new CredentialCipher(KEY);
    const rotated: string[] = [];
    const requests: URLSearchParams[] = [];
    const fetcher = (async (_url: string, init?: RequestInit) => {
      requests.push(new URLSearchParams(String(init?.body)));
      return new Response(
        JSON.stringify({ access_token: 'fresh-token', expires_in: 3600, refresh_token: 'rt-2' }),
        { status: 200 },
      );
    }) as typeof fetch;
    const driver = new ImapMailManager(
      {
        auth: {
          userId: 'u1',
          email: 'me@outlook.com',
          accessToken: 'stale',
          refreshToken: 'imap:managed',
        },
        storage: storage(),
        imap: {
          connectionId: 'conn-2',
          imap: {
            host: 'outlook.office365.com',
            port: 993,
            security: 'tls',
            username: 'me@outlook.com',
          },
          smtp: {
            host: 'smtp.office365.com',
            port: 587,
            security: 'starttls',
            username: 'me@outlook.com',
          },
          authMethod: 'xoauth2',
          oauthProvider: 'microsoft',
          secret: await cipher.encrypt('rt-1', 'conn-2'),
          accessToken: 'stale',
          serverSavesSent: true,
          onSecretRotated: async (secret) => {
            rotated.push(await cipher.decrypt(secret, 'conn-2'));
          },
        },
      },
      {
        socketFactory: imap.factory,
        cipher,
        blobs: { get: async () => null, put: async () => {} },
        oauthClients: { microsoft: { clientId: 'cid', clientSecret: 'cs' } },
        fetcher,
      },
    );
    expect((await driver.syncMailbox()).complete).toBe(true);
    expect(requests[0]?.get('refresh_token')).toBe('rt-1');
    expect(rotated).toEqual(['rt-2']);
    await driver.dispose();
  });
});
