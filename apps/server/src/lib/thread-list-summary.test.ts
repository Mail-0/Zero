import {
  parseStoredThreadSummary,
  repairStoredThreadSummary,
  resolveStoredThreadSummary,
  toStoredThreadSummary,
  toThreadListSummary,
  type ThreadLabelOverlay,
} from './thread-list-summary';
import type { ParsedMessage } from '../types';
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

const message = (overrides: Partial<ParsedMessage>): ParsedMessage => ({
  id: 'm',
  threadId: 't',
  title: 'snippet',
  subject: 'Subject',
  tags: [],
  sender: { name: 'Ann', email: 'ann@example.com' },
  to: [{ email: 'me@example.com' }],
  cc: null,
  bcc: null,
  tls: true,
  receivedOn: '2026-01-01T00:00:00.000Z',
  unread: false,
  body: 'body',
  processedHtml: '<p>processed</p>',
  blobUrl: 'blob:x',
  decodedBody: '<p>decoded</p>',
  attachments: [
    { attachmentId: 'a', filename: 'f', mimeType: 'text/plain', size: 1, body: '', headers: [] },
  ],
  ...overrides,
});

describe('summary repair', () => {
  it.each([null, 'invalid legacy JSON', '{"v":0}', '{"v":1,"latest":{"id":"deleted"}}'])(
    'replaces an unchanged legacy/invalidated snapshot (%s)',
    (previousJson) => {
      const db = new DatabaseSync(':memory:');
      try {
        db.exec('CREATE TABLE threads (thread_id TEXT PRIMARY KEY, summary_json TEXT)');
        db.prepare('INSERT INTO threads VALUES (?, ?)').run('t', previousJson);
        const latest = message({});
        repairStoredThreadSummary(
          { exec: (query, ...args) => (db.prepare(query).run(...args), []) },
          't',
          { latest, messages: [latest], labels: [], hasUnread: false, totalReplies: 1 },
          previousJson,
        );
        const json = String(db.prepare('SELECT summary_json FROM threads').get()?.summary_json);
        expect(parseStoredThreadSummary(json)?.latest.id).toBe('m');
        expect(json).not.toContain('<p>decoded</p>');
      } finally {
        db.close();
      }
    },
  );

  it('does not overwrite a newer snapshot written while the R2 read was in flight', () => {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec('CREATE TABLE threads (thread_id TEXT PRIMARY KEY, summary_json TEXT)');
      db.prepare('INSERT INTO threads VALUES (?, ?)').run('t', 'newer snapshot');
      const latest = message({});
      repairStoredThreadSummary(
        { exec: (query, ...args) => (db.prepare(query).run(...args), []) },
        't',
        { latest, messages: [latest], labels: [], hasUnread: false, totalReplies: 1 },
        null,
      );
      expect(db.prepare('SELECT summary_json FROM threads').get()?.summary_json).toBe(
        'newer snapshot',
      );
    } finally {
      db.close();
    }
  });
});

describe('toThreadListSummary', () => {
  it('keeps row fields and strips every body', () => {
    const latest = message({ id: 'm2' });
    const summary = toThreadListSummary({
      messages: [message({ id: 'm1' }), latest, message({ id: 'd', isDraft: true })],
      latest,
      hasUnread: true,
      totalReplies: 2,
      labels: [{ id: 'INBOX', name: 'INBOX' }],
    });

    expect(summary).toMatchObject({
      latest: { id: 'm2', subject: 'Subject', sender: { email: 'ann@example.com' } },
      hasUnread: true,
      totalReplies: 2,
      hasDraft: true,
      isGroupThread: false,
      labels: [{ id: 'INBOX', name: 'INBOX' }],
    });
    expect(summary?.latest.decodedBody).toBeUndefined();
    expect(summary?.latest.attachments).toBeUndefined();
    expect(summary?.latest.body).toBe('');
    expect(summary?.latest.processedHtml).toBe('');
  });

  it('flags group threads by latest recipient count', () => {
    const latest = message({ cc: [{ email: 'b@example.com' }] });
    expect(
      toThreadListSummary({
        messages: [latest],
        latest,
        hasUnread: false,
        totalReplies: 1,
        labels: [],
      })?.isGroupThread,
    ).toBe(true);
  });

  it('returns null for threads that are not imported yet', () => {
    expect(
      toThreadListSummary({ messages: [], hasUnread: false, totalReplies: 0, labels: [] }),
    ).toBeNull();
  });
});

const overlay = (options: {
  labels?: Record<string, string[]>;
  deleted?: string[];
  threadDeleted?: boolean;
}): ThreadLabelOverlay => ({
  isThreadDeleted: () => options.threadDeleted ?? false,
  isDeleted: (id) => options.deleted?.includes(id) ?? false,
  messageLabels: (id) => options.labels?.[id],
  threadLabels: () => [...new Set(Object.values(options.labels ?? {}).flat())],
});

describe('stored thread summary', () => {
  const thread = () => {
    const first = message({ id: 'm1', tags: [{ id: 'Label_1', name: 'Work', type: 'user' }] });
    const latest = message({ id: 'm2', tags: [{ id: 'Label_1', name: 'Work', type: 'user' }] });
    const draft = message({ id: 'd1', isDraft: true });
    return {
      messages: [first, latest, draft],
      latest,
      hasUnread: false,
      totalReplies: 2,
      labels: [],
    };
  };

  it('stores no bodies and round-trips through JSON', () => {
    const json = JSON.stringify(toStoredThreadSummary(thread()));
    expect(json).not.toContain('<p>decoded</p>');
    expect(json).not.toContain('<p>processed</p>');
    expect(parseStoredThreadSummary(json)?.latest.id).toBe('m2');
    expect(parseStoredThreadSummary('{"v":2}')).toBeNull();
    expect(parseStoredThreadSummary('not json')).toBeNull();
  });

  it('applies current labels, unread state and counts from the label store', () => {
    const stored = toStoredThreadSummary(thread())!;
    const resolved = resolveStoredThreadSummary(
      't',
      stored,
      overlay({ labels: { m1: ['INBOX'], m2: ['INBOX', 'UNREAD', 'Label_1'], d1: ['DRAFT'] } }),
    );
    expect(resolved.kind).toBe('summary');
    if (resolved.kind !== 'summary') return;
    expect(resolved.summary.hasUnread).toBe(true);
    expect(resolved.summary.latest.unread).toBe(true);
    expect(resolved.summary.latest.tags).toContainEqual({
      id: 'Label_1',
      name: 'Work',
      type: 'user',
    });
    expect(resolved.summary.latest.tags).toContainEqual({
      id: 'UNREAD',
      name: 'UNREAD',
      type: 'system',
    });
    expect(resolved.summary.totalReplies).toBe(2);
    expect(resolved.summary.hasDraft).toBe(true);
  });

  it('never serves deleted threads and drops deleted messages from counts', () => {
    const stored = toStoredThreadSummary(thread())!;
    const labels = { m1: ['INBOX'], m2: ['INBOX'], d1: ['DRAFT'] };
    expect(
      resolveStoredThreadSummary('t', stored, overlay({ labels, threadDeleted: true })),
    ).toEqual({
      kind: 'empty',
    });
    const withoutDraft = resolveStoredThreadSummary(
      't',
      stored,
      overlay({ labels, deleted: ['m1', 'd1'] }),
    );
    expect(withoutDraft.kind === 'summary' && withoutDraft.summary.totalReplies).toBe(1);
    expect(withoutDraft.kind === 'summary' && withoutDraft.summary.hasDraft).toBe(false);
    expect(
      resolveStoredThreadSummary('t', stored, overlay({ labels, deleted: ['m1', 'm2'] })),
    ).toEqual({ kind: 'empty' });
  });

  it('falls back to the full read when the snapshot cannot answer exactly', () => {
    const stored = toStoredThreadSummary(thread())!;
    // Latest deleted: the new latest's metadata isn't in the snapshot.
    expect(
      resolveStoredThreadSummary(
        't',
        stored,
        overlay({ labels: { m1: ['INBOX'] }, deleted: ['m2'] }),
      ),
    ).toEqual({ kind: 'fallback' });
    // Labels not hydrated yet.
    expect(resolveStoredThreadSummary('t', stored, overlay({}))).toEqual({ kind: 'fallback' });
  });
});
