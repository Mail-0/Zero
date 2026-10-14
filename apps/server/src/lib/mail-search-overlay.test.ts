import { MailLabelStore, type LabelStorage } from './mail-label-store';
import { compileLabelMatcher } from './mail-search-overlay';
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

const UNREAD_IMPORTANT =
  '(is:important NOT is:sent NOT is:draft) (is:unread NOT is:sent NOT is:draft)';

function matches(query: string, messages: string[][]) {
  const matcher = compileLabelMatcher(query);
  if (!matcher) throw new Error(`Could not compile ${query}`);
  return matcher(messages);
}

describe('label-aware search overlay', () => {
  it('excludes a thread from the Unread + Important category once it is read locally', () => {
    expect(matches(UNREAD_IMPORTANT, [['INBOX', 'IMPORTANT', 'UNREAD']])).toBe(true);
    expect(matches(UNREAD_IMPORTANT, [['INBOX', 'IMPORTANT']])).toBe(false);
    expect(
      matches(UNREAD_IMPORTANT, [
        ['INBOX', 'IMPORTANT'],
        ['SENT', 'IMPORTANT'],
      ]),
    ).toBe(false);
  });

  it('matches a thread when any message still satisfies the query', () => {
    expect(matches('is:unread', [['INBOX'], ['INBOX', 'UNREAD']])).toBe(true);
  });

  it('defers to the provider for terms that labels cannot decide', () => {
    expect(matches('from:alice is:unread', [['INBOX', 'UNREAD']])).toBe(true);
    expect(matches('from:alice is:unread', [['INBOX']])).toBe(false);
    expect(matches('-from:alice', [['INBOX']])).toBe(true);
    expect(matches('is:unread OR subject:"hi there"', [['INBOX']])).toBe(true);
    expect(matches('subject:(a b) -is:starred', [['STARRED']])).toBe(false);
  });

  it('binds OR tighter than implicit AND and supports brace groups', () => {
    expect(matches('is:starred is:unread OR is:important', [['STARRED', 'IMPORTANT']])).toBe(true);
    expect(matches('is:starred is:unread OR is:important', [['IMPORTANT']])).toBe(false);
    expect(matches('{is:unread is:starred}', [['STARRED']])).toBe(true);
    expect(matches('{is:unread is:starred}', [['INBOX']])).toBe(false);
  });

  it('keeps provider results for unparsable queries and threads without stored messages', () => {
    expect(compileLabelMatcher('(is:unread')).toBeUndefined();
    expect(compileLabelMatcher('subject:"open')).toBeUndefined();
    expect(matches('is:unread', [])).toBe(true);
  });
});

describe('pending thread message labels', () => {
  function store() {
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
    const labels = new MailLabelStore(storage);
    labels.initialize();
    return labels;
  }

  it('returns overlaid labels only for threads with queued intents', () => {
    const labels = store();
    labels.importMessages('read', [{ id: 'r', labels: ['INBOX', 'UNREAD', 'IMPORTANT'] }]);
    labels.importMessages('idle', [{ id: 'i', labels: ['INBOX', 'UNREAD'] }]);
    labels.setThreadLabels(['read'], [], ['UNREAD'], 0);
    const pending = labels.pendingThreadMessageLabels(['read', 'idle', 'missing']);
    expect([...pending.keys()]).toEqual(['read']);
    expect(pending.get('read')?.[0]?.sort()).toEqual(['IMPORTANT', 'INBOX']);
    expect(matches(UNREAD_IMPORTANT, pending.get('read')!)).toBe(false);
  });
});
