import { QueryProvider } from './query-provider';
import { AutumnProvider } from 'autumn-js/react';
import type { PropsWithChildren } from 'react';

export function ServerProviders({ children }: PropsWithChildren) {
  return (
    <AutumnProvider backendUrl={import.meta.env.VITE_PUBLIC_BACKEND_URL}>
      <QueryProvider>{children}</QueryProvider>
    </AutumnProvider>
  );
}
