import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useNavigate,
  type LoaderFunctionArgs,
  type MetaFunction,
} from 'react-router';
import { ServerProviders } from '@/providers/server-providers';
import { ClientProviders } from '@/providers/client-providers';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { useEffect, type PropsWithChildren } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { AppRouter } from '@zero/server/trpc';
import { Button } from '@/components/ui/button';
import { getLocale } from '@/paraglide/runtime';
import { siteConfig } from '@/lib/site-config';
import { signOut } from '@/lib/auth-client';
import type { Route } from './+types/root';
import { m } from '@/paraglide/messages';
import { ArrowLeft } from 'lucide-react';
import superjson from 'superjson';
import './globals.css';

const getUrl = () => import.meta.env.VITE_PUBLIC_BACKEND_URL + '/api/trpc';

export const getServerTrpc = (req: Request) =>
  createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        maxItems: 8,
        url: getUrl(),
        transformer: superjson,
        headers: req.headers,
      }),
    ],
  });

export const meta: MetaFunction = () => {
  return [
    { title: siteConfig.title },
    { name: 'description', content: siteConfig.description },
    { property: 'og:title', content: siteConfig.title },
    { property: 'og:description', content: siteConfig.description },
    { property: 'og:image', content: siteConfig.openGraph.images[0].url },
    { property: 'og:url', content: siteConfig.alternates.canonical },
    { property: 'og:type', content: 'website' },
    { rel: 'manifest', href: '/manifest.webmanifest' },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const trpc = getServerTrpc(request);
  const defaultConnection = await trpc.connections.getDefault
    .query()
    .then((res) => (res?.id as string) ?? null)
    .catch(() => null);
  return { connectionId: defaultConnection };
}

export function Layout({ children }: PropsWithChildren) {
  const { connectionId } = useLoaderData<typeof loader>();

  return (
    <html lang={getLocale()} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#141414" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <link rel="manifest" href="/manifest.json" />
        <Meta />
        {import.meta.env.REACT_SCAN && (
          <script crossOrigin="anonymous" src="//unpkg.com/react-scan/dist/auto.global.js" />
        )}
        <Links />
      </head>
      <body className="antialiased">
        <ServerProviders connectionId={connectionId}>
          <ClientProviders>{children}</ClientProviders>
        </ServerProviders>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function HydrateFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin" />
    </div>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Oops!';
  let details = 'An unexpected error occurred.';
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error';
    details =
      error.status === 404 ? 'The requested page could not be found.' : error.statusText || details;
    if (error.status === 404) {
      return <NotFound />;
    }
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  useEffect(() => {
    console.error(error);
    console.error({ message, details, stack });
  }, [error, message, details, stack]);

  return (
    <div className="dark:bg-background flex w-full items-center justify-center bg-white text-center">
      <div className="flex-col items-center justify-center md:flex dark:text-gray-100">
        {/* Message */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Something went wrong!</h2>
          <p className="text-muted-foreground">See the console for more information.</p>
          <pre className="text-muted-foreground">{JSON.stringify(error, null, 2)}</pre>
        </div>

        <div className="mt-2 flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="text-muted-foreground gap-2"
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await signOut();
              window.location.href = '/login';
            }}
            className="text-muted-foreground gap-2"
          >
            Log Out and Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="dark:bg-background flex w-full items-center justify-center bg-white text-center">
      <div className="flex-col items-center justify-center md:flex dark:text-gray-100">
        <div className="relative">
          <h1 className="text-muted-foreground/20 select-none text-[150px] font-bold">404</h1>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <AlertCircle className="text-muted-foreground h-20 w-20" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            {m['pages.error.notFound.title']()}
          </h2>
          <p className="text-muted-foreground">{m['pages.error.notFound.description']()}</p>
        </div>

        {/* Buttons */}
        <div className="mt-2 flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="text-muted-foreground gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {m['pages.error.notFound.goBack']()}
          </Button>
        </div>
      </div>
    </div>
  );
}
