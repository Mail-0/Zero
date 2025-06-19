import { LoginClient } from './login-client';
import { useLoaderData } from 'react-router';

export async function clientLoader() {
  const isProd = !import.meta.env.DEV;

  const response = await fetch(import.meta.env.VITE_PUBLIC_BACKEND_URL + '/api/public/providers');
  const data = (await response.json()) as { allProviders: any[] };

  return {
    allProviders: data.allProviders,
    isProd,
  };
}

export function HydrateFallback() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-white dark:bg-black">
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900 dark:border-white"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { allProviders, isProd } = useLoaderData<typeof clientLoader>();

  return (
    <div className="flex min-h-screen w-full flex-col bg-white dark:bg-black">
      <LoginClient providers={allProviders} isProd={isProd} />
    </div>
  );
}
