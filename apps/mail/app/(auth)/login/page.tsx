import { LoginClient } from './login-client';
import { useLoaderData } from 'react-router';

export async function clientLoader() {
  const isProd = !import.meta.env.DEV;

  const base = import.meta.env.VITE_PUBLIC_BACKEND_URL?.replace(/\/$/, '') ?? '';
  if (!base) {
    throw new Error(
      'VITE_PUBLIC_BACKEND_URL is not set. The login page needs the API origin (e.g. http://localhost:8787).',
    );
  }

  const url = `${base}/api/public/providers`;
  const response = await fetch(url);
  const raw = await response.text();

  if (!response.ok) {
    throw new Error(
      `GET ${url} failed with ${response.status} ${response.statusText}. Body starts with: ${raw.slice(0, 120)}`,
    );
  }

  let data: { allProviders?: any[] };
  try {
    data = JSON.parse(raw) as { allProviders?: any[] };
  } catch {
    throw new Error(
      `GET ${url} returned non-JSON (usually HTML from the wrong host, SPA fallback, or an error page). ` +
        `Check VITE_PUBLIC_BACKEND_URL and that the API server is running. Body starts with: ${raw.slice(0, 80).replace(/\s+/g, ' ')}`,
    );
  }

  return {
    allProviders: data.allProviders ?? [],
    isProd,
  };
}

export default function LoginPage() {
  const { allProviders, isProd } = useLoaderData<typeof clientLoader>();

  return (
    <div className="flex min-h-screen w-full flex-col bg-white dark:bg-black">
      <LoginClient providers={allProviders} isProd={isProd} />
    </div>
  );
}
