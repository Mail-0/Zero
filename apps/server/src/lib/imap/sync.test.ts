import { MemoryImapServer, sampleMessage } from './testing/memory-server';
import { ImapSyncEngine, defaultSyncOptions } from './sync';
import type { LabelStorage } from '../mail-label-store';
import { ImapIndexStore } from './imap-store';
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { ImapClient } from './client';

const storeFixture = () => {
  const db = new DatabaseSync(':memory:');
  const storage: LabelStorage = {
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
  const store = new ImapIndexStore(storage);
  store.initialize();
  return store;
};

const connect = (server: MemoryImapServer) =>
  ImapClient.connect({
    host: 'imap.example.com',
    port: 993,
    security: 'tls',
    socketFactory: server.factory,
    auth: { method: 'password', username: 'me@example.com', password: 'pw' },
  });

const setup = (options = {}) => {
  const server = new MemoryImapServer();
  server.addFolder('Sent', '\\Sent');
  server.addFolder('Trash', '\\Trash');
  const store = storeFixture();
  const engine = new ImapSyncEngine(store, { ...defaultSyncOptions, ...options });
  return { server, store, engine };
};

describe('ImapSyncEngine', () => {
  it('backfills folders, threads across folders and reports completion', async () => {
    const { server, store, engine } = setup();
    server.deliver(
      'INBOX',
      sampleMessage({ messageId: 'a@x', subject: 'Plan', date: new Date('2026-01-01') }),
    );
    server.deliver(
      'Sent',
      sampleMessage({
        messageId: 'b@x',
        subject: 'Re: Plan',
        inReplyTo: 'a@x',
        references: ['a@x'],
        date: new Date('2026-01-02'),
      }),
      ['\\Seen'],
    );
    server.deliver('INBOX', sampleMessage({ messageId: 'c@x', subject: 'Other' }));
    const client = await connect(server);

    const result = await engine.run(client);
    expect(result.complete).toBe(true);
    expect(result.fetched).toBe(3);
    const inbox = store.folder('INBOX')!;
    expect(inbox).toMatchObject({ labelId: 'INBOX', uidNext: 3, backfillDone: true });
    expect(store.folder('Sent')!.labelId).toBe('SENT');

    const threads = new Set(store.dirtyThreads(10));
    expect(threads.size).toBe(2);
    const planThread = [...threads].find((id) => store.threadMessages(id).length === 2)!;
    expect(store.threadMessages(planThread).map((m) => m.locations[0]!.folder)).toEqual([
      'INBOX',
      'Sent',
    ]);
  });

  it('respects the per-run budget and resumes', async () => {
    const { server, store, engine } = setup({ budget: 2, batchSize: 1 });
    for (let i = 0; i < 5; i++) server.deliver('INBOX', sampleMessage({ messageId: `m${i}@x` }));
    const client = await connect(server);
    const first = await engine.run(client);
    expect(first).toMatchObject({ complete: false, fetched: 2 });
    // Newest first.
    expect(store.knownUids('INBOX')).toEqual([4, 5]);
    await engine.run(client);
    await engine.run(client);
    expect(store.knownUids('INBOX')).toEqual([1, 2, 3, 4, 5]);
    expect((await engine.run(client)).complete).toBe(true);
  });

  it('picks up new mail, flag changes, expunges and UIDVALIDITY resets', async () => {
    const { server, store, engine } = setup();
    const first = server.deliver('INBOX', sampleMessage({ messageId: 'one@x' }));
    const client = await connect(server);
    await engine.run(client);
    store.clearDirty(store.dirtyThreads(10));

    server.deliver('INBOX', sampleMessage({ messageId: 'two@x' }));
    first.flags.push('\\Seen');
    await engine.run(client);
    expect(store.knownUids('INBOX')).toEqual([1, 2]);
    const one = store
      .dirtyThreads(10)
      .flatMap((id) => store.threadMessages(id))
      .find((message) => message.messageId === 'one@x')!;
    expect(one.locations[0]!.flags).toContain('\\Seen');
    store.clearDirty(store.dirtyThreads(10));

    // Expunge uid 1.
    const inbox = server.folders.get('INBOX')!;
    inbox.messages = inbox.messages.filter((m) => m.uid !== 1);
    await engine.run(client);
    expect(store.knownUids('INBOX')).toEqual([2]);
    store.clearDirty(store.dirtyThreads(10));

    // Server renumbers the folder.
    inbox.uidValidity = 2;
    inbox.messages = [{ ...inbox.messages[0]!, uid: 100 }];
    inbox.uidNext = 101;
    await engine.run(client);
    expect(store.folder('INBOX')!.uidValidity).toBe(2);
    expect(store.knownUids('INBOX')).toEqual([100]);
  });

  it('queues only live incoming mail for the AI workflow', async () => {
    const { server, store, engine } = setup();
    server.addFolder('Drafts', '\\Drafts');
    server.addFolder('Projects');
    server.deliver('INBOX', sampleMessage({ messageId: 'old@x', subject: 'Old' }));
    const client = await connect(server);
    await engine.run(client);
    // Initial backfill is never "new mail".
    expect(store.takeNewMail()).toEqual([]);

    server.deliver(
      'INBOX',
      sampleMessage({ messageId: 'reply@x', subject: 'Re: Old', inReplyTo: 'old@x' }),
    );
    server.deliver('Projects', sampleMessage({ messageId: 'p@x', subject: 'Filed' }));
    server.deliver('Sent', sampleMessage({ messageId: 'mine@x', subject: 'Mine' }), ['\\Seen']);
    server.deliver('Drafts', sampleMessage({ messageId: 'd@x', subject: 'Draft' }), ['\\Draft']);
    await engine.run(client);

    const queued = store.takeNewMail();
    const ids = (threadId: string) => store.threadMessages(threadId).map((m) => m.messageId);
    expect(queued.map(ids).sort()).toEqual([['old@x', 'reply@x'], ['p@x']]);
    // Drained.
    expect(store.takeNewMail()).toEqual([]);

    // A known message showing up in another folder (a move/copy) is not new mail.
    const reply = server.folders.get('INBOX')!.messages.find((m) => m.uid === 2)!;
    server.deliver('Projects', reply.raw);
    await engine.run(client);
    expect(store.takeNewMail()).toEqual([]);
  });

  it('skips promotions for the AI workflow and categorizes older mail in the background', async () => {
    const { server, store, engine } = setup();
    server.deliver('INBOX', sampleMessage({ messageId: 'old@x' }));
    const client = await connect(server);
    await engine.run(client);
    // Simulate mail indexed before categorization existed.
    store['storage'].exec('UPDATE imap_messages SET category = NULL');
    expect(store.uncategorizedUids('INBOX', 10)).toEqual([1]);

    server.deliver(
      'INBOX',
      sampleMessage({
        messageId: 'promo@x',
        from: 'news@shop.com',
        headers: ['List-Unsubscribe: <https://shop.com/u>'],
      }),
    );
    server.deliver('INBOX', sampleMessage({ messageId: 'hi@x' }));
    await engine.run(client);
    expect(store.uncategorizedUids('INBOX', 10)).toEqual([]);
    const queued = store.takeNewMail().flatMap((id) => store.threadMessages(id));
    expect(queued.map((m) => m.messageId)).toEqual(['hi@x']);
    const byId = (id: string) =>
      store
        .threadsByDate(10, 0)
        .flatMap((thread) => store.threadMessages(thread))
        .find((m) => m.messageId === id)!;
    expect(byId('old@x').category).toBe('personal');
    expect(byId('promo@x').category).toBe('promotions');
  });

  it('forgets folders that disappear from LIST', async () => {
    const { server, store, engine } = setup();
    server.addFolder('Projects');
    server.deliver('Projects', sampleMessage({ messageId: 'p@x' }));
    const client = await connect(server);
    await engine.run(client);
    expect(store.knownUids('Projects')).toEqual([1]);
    server.folders.delete('Projects');
    await engine.run(client, { refreshFolders: true });
    expect(store.folder('Projects')).toBeUndefined();
    expect(store.knownUids('Projects')).toEqual([]);
  });
});
