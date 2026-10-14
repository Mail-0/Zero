import {
  OptimisticActionsManager,
  optimisticActionsManager,
  type PendingAction,
} from './optimistic-actions-manager';
import { QueryClient, QueryObserver, InfiniteQueryObserver, hashKey } from '@tanstack/react-query';
import { optimisticActionsAtom, pruneSettledReadActionsAtom } from '../store/optimistic-updates';
import { refreshMailboxQueries } from './mail-cache-sync';
import { beforeEach, describe, expect, it } from 'vitest';
import { createStore } from 'jotai/vanilla';

function readAction(id: string, optimisticId = id): PendingAction {
  return {
    id,
    optimisticId,
    type: 'READ',
    threadIds: ['thread'],
    params: { read: true },
    execute: async () => {},
    undo: () => {},
  };
}

beforeEach(() => {
  optimisticActionsManager.pendingActions.clear();
  optimisticActionsManager.pendingActionsByType.clear();
});

describe('UI unread synchronization', () => {
  it.each(['push', 'catch-up'])(
    'refreshes hour-fresh draft details and lists on %s, including inactive details',
    async (event) => {
      const client = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 3600000,
            retry: false,
            queryKeyHashFn: (key) => hashKey([{ connectionId: 'mailbox' }, ...key]),
          },
        },
      });
      const detailKey = [['drafts', 'get'], { input: { id: 'draft' }, type: 'query' }] as const;
      const inactiveKey = [['drafts', 'get'], { input: { id: 'other' }, type: 'query' }] as const;
      const listKey = [['drafts', 'list'], { input: {}, type: 'query' }] as const;
      client.setQueryData(detailKey, { messageId: 'old-message', subject: 'Old subject' });
      client.setQueryData(inactiveKey, { subject: 'Inactive' });
      client.setQueryData(listKey, { drafts: ['old-draft'] });
      let detailFetches = 0;
      let listFetches = 0;
      const detail = new QueryObserver(client, {
        queryKey: detailKey,
        queryFn: async () => {
          detailFetches++;
          return { messageId: 'new-message', subject: 'External edit' };
        },
      });
      const list = new QueryObserver(client, {
        queryKey: listKey,
        queryFn: async () => {
          listFetches++;
          return { drafts: ['new-draft'] };
        },
      });
      const unsubscribeDetail = detail.subscribe(() => {});
      const unsubscribeList = list.subscribe(() => {});
      expect([detailFetches, listFetches]).toEqual([0, 0]);
      await refreshMailboxQueries(client, {
        threads:
          event === 'push'
            ? [['mail', 'get'], { input: { id: 'thread' }, type: 'query' }]
            : [['mail', 'get']],
        lists: [['mail', 'listThreads']],
        counts: [['mail', 'count']],
        draftDetails: [['drafts', 'get']],
        draftLists: [['drafts', 'list']],
      });
      expect(client.getQueryData(detailKey)).toEqual({
        messageId: 'new-message',
        subject: 'External edit',
      });
      expect(client.getQueryData(listKey)).toEqual({ drafts: ['new-draft'] });
      expect([detailFetches, listFetches]).toEqual([1, 1]);
      expect(client.getQueryState(inactiveKey)?.isInvalidated).toBe(true);
      unsubscribeDetail();
      unsubscribeList();
      client.clear();
    },
  );

  it('recognizes the last completed read action after removing it from the group', () => {
    const manager = new OptimisticActionsManager();
    manager.pendingActions.set('p', readAction('p', 'opt'));
    manager.pendingActionsByType.set('READ', new Set(['p']));
    expect(manager.settleAction('p')).toEqual({ optimisticId: 'opt', typeDrained: true });
    expect(manager.pendingActions.size).toBe(0);
    expect(manager.pendingActionsByType.has('READ')).toBe(false);
    expect(manager.settleAction('p')).toBeUndefined();
  });

  it('does not treat an older completion as settling a newer pending action', () => {
    const manager = new OptimisticActionsManager();
    manager.pendingActions.set('old', readAction('old'));
    manager.pendingActions.set('new', readAction('new'));
    manager.pendingActionsByType.set('READ', new Set(['old', 'new']));
    expect(manager.settleAction('old')?.typeDrained).toBe(false);
    expect(manager.pendingActions.has('new')).toBe(true);
    expect(manager.settleAction('new')?.typeDrained).toBe(true);
  });

  it('clears retired read overrides on reconnect while preserving live user intent', () => {
    const store = createStore();
    optimisticActionsManager.pendingActions.set('p', readAction('p', 'live'));
    store.set(optimisticActionsAtom, {
      stale: { type: 'READ', threadIds: ['thread'], read: false },
      live: { type: 'READ', threadIds: ['thread'], read: true },
      star: { type: 'STAR', threadIds: ['thread'], starred: true },
    });
    store.set(pruneSettledReadActionsAtom);
    expect(Object.keys(store.get(optimisticActionsAtom))).toEqual(['live', 'star']);
    optimisticActionsManager.settleAction('p');
    store.set(pruneSettledReadActionsAtom);
    expect(Object.keys(store.get(optimisticActionsAtom))).toEqual(['star']);
  });

  it('refreshes an active hour-fresh thread cache after a missed websocket event', async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 3600000,
          retry: false,
          queryKeyHashFn: (key) => hashKey([{ connectionId: 'mailbox' }, ...key]),
        },
      },
    });
    const key = [['mail', 'get'], { input: { id: 'thread' }, type: 'query' }] as const;
    client.setQueryData(key, { hasUnread: true });
    let fetches = 0;
    const observer = new QueryObserver(client, {
      queryKey: key,
      queryFn: async () => {
        fetches++;
        return { hasUnread: false };
      },
    });
    const unsubscribe = observer.subscribe(() => {});
    expect(fetches).toBe(0);
    await refreshMailboxQueries(client, {
      threads: [['mail', 'get']],
      lists: [['mail', 'listThreads']],
      counts: [['mail', 'count']],
    });
    expect(client.getQueryData(key)).toEqual({ hasUnread: false });
    expect(fetches).toBe(1);
    unsubscribe();
    client.clear();
  });

  it('reconciles archive membership and star state against the committed local snapshot', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: 3600000, retry: false } },
    });
    const threadKey = [['mail', 'get'], { input: { id: 'thread' }, type: 'query' }] as const;
    const listKey = [
      ['mail', 'listThreads'],
      { input: { folder: 'inbox' }, type: 'infinite' },
    ] as const;
    client.setQueryData(threadKey, { labels: ['INBOX'] });
    client.setQueryData(listKey, { pages: [{ threads: [{ id: 'thread' }] }], pageParams: [null] });
    const thread = new QueryObserver(client, {
      queryKey: threadKey,
      queryFn: async () => ({ labels: ['STARRED'] }),
    });
    const inbox = new InfiniteQueryObserver(client, {
      queryKey: listKey,
      initialPageParam: null,
      getNextPageParam: () => undefined,
      queryFn: async () => ({ threads: [] as { id: string }[] }),
    });
    const unsubscribeThread = thread.subscribe(() => {});
    const unsubscribeInbox = inbox.subscribe(() => {});
    await refreshMailboxQueries(client, {
      threads: [['mail', 'get']],
      lists: [['mail', 'listThreads']],
      counts: [['mail', 'count']],
    });
    expect(client.getQueryData(threadKey)).toEqual({ labels: ['STARRED'] });
    expect(client.getQueryData(listKey)).toEqual({ pages: [{ threads: [] }], pageParams: [null] });
    unsubscribeThread();
    unsubscribeInbox();
    client.clear();
  });
});
