import { NextIntlClientProvider } from 'next-intl';
import { QueryProvider } from './query-provider';
import { AutumnProvider } from 'autumn-js/next';
import { getMessages } from 'next-intl/server';
import type { PropsWithChildren } from 'react';
import { authProxy } from '@/lib/auth-proxy';

export async function ServerProviders({ children }: PropsWithChildren) {
  const messages = await getMessages();
  return (
    // <AutumnProvider authPlugin={{ provider: 'better-auth', instance: authProxy }}>
    <NextIntlClientProvider messages={messages}>
      <QueryProvider>{children}</QueryProvider>
    </NextIntlClientProvider>
    // </AutumnProvider>
  );
}
