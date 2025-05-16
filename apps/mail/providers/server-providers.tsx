import { NextIntlClientProvider } from 'next-intl';
import { QueryProvider } from './query-provider';
import { AutumnProvider } from 'autumn-js/next';
import { authClient } from '@/lib/auth-client';
import { getMessages } from 'next-intl/server';
import type { PropsWithChildren } from 'react';
import { headers } from 'next/headers';

export async function ServerProviders({ children }: PropsWithChildren) {
  const messages = await getMessages();
  const session = await authClient.getSession({
    fetchOptions: { headers: await headers() },
  });

  return (
    <AutumnProvider
      customerData={
        session.data ? { name: session.data.user.name, email: session.data.user.email } : undefined
      }
      customerId={session.data ? session.data.user.id : undefined}
    >
      <NextIntlClientProvider messages={messages}>
        <QueryProvider>{children}</QueryProvider>
      </NextIntlClientProvider>
    </AutumnProvider>
  );
}
