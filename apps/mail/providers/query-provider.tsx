'use client';
import { QueryCache, QueryClient, QueryClientProvider, hashKey } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink, loggerLink } from '@trpc/client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import { useSession, type Session } from '@/lib/auth-client';
import type { PropsWithChildren } from 'react';
import type { AppRouter } from '@/trpc';
import superjson from 'superjson';
import { toast } from 'sonner';

export const makeQueryClient = (session: Session | null) =>
  new QueryClient({
    queryCache: new QueryCache({
      onError: (err, { meta }) => {
        if (meta && meta.noGlobalError === true) return;
        if (meta && typeof meta.customError === 'string') toast.error(meta.customError);
        else toast.error(err.message || 'Something went wrong');
      },
    }),
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        queryKeyHashFn: (queryKey) =>
          hashKey([
            session ? { userId: session.user.id, connectionId: session.connectionId } : undefined,
            ...queryKey,
          ]),
      },
      mutations: {
        onError: (err) => toast.error(err.message),
      },
    },
  });

let browserQueryClient: QueryClient | undefined = undefined;

const getQueryClient = (session: Session | null) => {
  if (typeof window === 'undefined') {
    return makeQueryClient(session);
  } else {
    if (!browserQueryClient) browserQueryClient = makeQueryClient(session);
    return browserQueryClient;
  }
};

const getUrl = () => {
  if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_APP_URL + '/api/trpc';
  return window.location.origin + '/api/trpc';
};

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    loggerLink({ enabled: () => true }),
    httpBatchLink({
      transformer: superjson,
      url: getUrl(),
      methodOverride: 'POST',
    }),
  ],
});

export function QueryProvider({ children }: PropsWithChildren) {
  const { data } = useSession();
  const queryClient = getQueryClient(data ?? null);

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
