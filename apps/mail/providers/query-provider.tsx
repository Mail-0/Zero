import {
  PersistQueryClientProvider,
  type PersistedClient,
  type Persister,
} from '@tanstack/react-query-persist-client';
import {
  QueryCache,
  QueryClient,
  defaultShouldDehydrateQuery,
  hashKey,
} from '@tanstack/react-query';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { trimPersistedClient } from '@/lib/persist-trim';
import { useMemo, type PropsWithChildren } from 'react';
import type { AppRouter } from '@zero/server/trpc';
import { CACHE_BURST_KEY } from '@/lib/constants';
import { signOut } from '@/lib/auth-client';
import { get, set, del } from 'idb-keyval';
import superjson from 'superjson';

/**
 * The persist subscriber calls persistClient on *every* query/mutation cache event (each
 * fetch start/success, observer add, ...), and each IDB put structured-clones the whole
 * dehydrated cache on the main thread. Coalesce to at most one write per second, done when
 * the main thread is idle, and flush when the page is hidden so nothing is lost on close.
 */
const PERSIST_THROTTLE_MS = 1000;

function createIDBPersister(idbValidKey: IDBValidKey = 'zero-query-cache') {
  let pending: PersistedClient | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = async () => {
    timer = null;
    const client = pending;
    pending = null;
    if (client) await set(idbValidKey, trimPersistedClient(client));
  };
  const scheduleFlush = () => {
    if (timer) return;
    timer = setTimeout(() => {
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => void flush(), { timeout: PERSIST_THROTTLE_MS });
      } else void flush();
    }, PERSIST_THROTTLE_MS);
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && pending) {
        if (timer) clearTimeout(timer);
        void flush();
      }
    });
  }

  return {
    persistClient: async (client: PersistedClient) => {
      pending = client;
      scheduleFlush();
    },
    restoreClient: async () => {
      return await get<PersistedClient>(idbValidKey);
    },
    removeClient: async () => {
      pending = null;
      if (timer) clearTimeout(timer);
      timer = null;
      await del(idbValidKey);
    },
  } satisfies Persister;
}

/**
 * In-memory lifetime of unused queries. Long enough that revisiting a thread within a
 * session is instant (mail.get has a 1h staleTime and is kept fresh by socket/focus
 * invalidation in mail-cache-sync); bounded so memory doesn't grow without limit.
 */
const IN_MEMORY_GC_TIME = 1000 * 60 * 30;

/**
 * How long the IndexedDB snapshot is trusted on reload. Deliberately short (see #1686):
 * restored data keeps its original dataUpdatedAt, so a long maxAge combined with
 * mail.get's 1h staleTime would show threads that changed while the tab was closed.
 */
const PERSISTED_MAX_AGE = 1000 * 60 * 1;

const isTrpcPath = (queryKey: readonly unknown[], ...path: string[]) => {
  const head = queryKey[0];
  return Array.isArray(head) && path.every((segment, i) => head[i] === segment);
};

/**
 * The persister re-serializes the whole dehydrated cache to IndexedDB on every cache
 * change (throttled ~1s) on the main thread, so keep the snapshot small:
 * - never persist processed bodies / attachments (large, cheap to refetch)
 * - persist mail.get only for threads currently observed (open thread, rows without a list
 *   summary). Rows render from listThreads' summaries, which persist with the list. Without
 *   this, the longer in-memory gcTime would make the snapshot grow with every thread visited.
 */
const shouldPersistQuery: typeof defaultShouldDehydrateQuery = (query) => {
  if (!defaultShouldDehydrateQuery(query)) return false;
  if (query.queryKey[0] === 'email-content') return false;
  if (isTrpcPath(query.queryKey, 'mail', 'getMessageAttachments')) return false;
  if (isTrpcPath(query.queryKey, 'mail', 'get')) return query.getObserversCount() > 0;
  // Must match the server's current default; a restored copy can point at another account.
  if (isTrpcPath(query.queryKey, 'connections', 'getDefault')) return false;
  return true;
};

export const makeQueryClient = (connectionId: string | null) =>
  new QueryClient({
    queryCache: new QueryCache({
      onError: (err, { meta }) => {
        if (meta && meta.noGlobalError === true) return;
        if (meta && typeof meta.customError === 'string') console.error(meta.customError);
        else if (
          err.message === 'Required scopes missing' ||
          err.message.includes('Invalid connection')
        ) {
          signOut({
            fetchOptions: {
              onSuccess: () => {
                if (window.location.href.includes('/login')) return;
                window.location.href = '/login?error=required_scopes_missing';
              },
            },
          });
        } else console.error(err.message || 'Something went wrong');
      },
    }),
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        queryKeyHashFn: (queryKey) => hashKey([{ connectionId }, ...queryKey]),
        gcTime: IN_MEMORY_GC_TIME,
      },
      mutations: {
        onError: (err) => console.error(err.message),
      },
    },
  });

const browserQueryClient = {
  queryClient: null,
  activeConnectionId: null,
} as {
  queryClient: QueryClient | null;
  activeConnectionId: string | null;
};

const getQueryClient = (connectionId: string | null) => {
  if (typeof window === 'undefined') {
    return makeQueryClient(connectionId);
  } else {
    if (!browserQueryClient.queryClient || browserQueryClient.activeConnectionId !== connectionId) {
      browserQueryClient.queryClient = makeQueryClient(connectionId);
      browserQueryClient.activeConnectionId = connectionId;
    }
    return browserQueryClient.queryClient;
  }
};

const getUrl = () => import.meta.env.VITE_PUBLIC_BACKEND_URL + '/api/trpc';

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    // loggerLink({ enabled: () => true }),
    httpBatchLink({
      transformer: superjson,
      url: getUrl(),
      methodOverride: 'POST',
      maxItems: 1,
      fetch: (url, options) =>
        fetch(url, { ...options, credentials: 'include' }).then((res) => {
          const currentPath = new URL(window.location.href).pathname;
          const redirectPath = res.headers.get('X-Zero-Redirect');
          if (!!redirectPath && redirectPath !== currentPath) {
            window.location.href = redirectPath;
            res.headers.delete('X-Zero-Redirect');
          }
          return res;
        }),
    }),
  ],
});

export function QueryProvider({
  children,
  connectionId,
}: PropsWithChildren<{ connectionId: string | null }>) {
  const persister = useMemo(
    () => createIDBPersister(`zero-query-cache-${connectionId ?? 'default'}`),
    [connectionId],
  );
  const queryClient = useMemo(() => getQueryClient(connectionId), [connectionId]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        buster: CACHE_BURST_KEY,
        maxAge: PERSISTED_MAX_AGE,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
      }}
    >
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </PersistQueryClientProvider>
  );
}
