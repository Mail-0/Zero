import type { IntlMessages, Locale } from '@/i18n/config';
import { QueryProvider } from './query-provider';
import { AutumnProvider } from 'autumn-js/react';
import type { PropsWithChildren } from 'react';
import { IntlProvider } from 'use-intl';

export function ServerProviders({
  children,
  messages,
  locale,
  connectionId,
}: PropsWithChildren<{ messages: IntlMessages; locale: Locale; connectionId: string | null }>) {
  return (
    <AutumnProvider backendUrl={import.meta.env.VITE_PUBLIC_BACKEND_URL}>
      <IntlProvider messages={messages} locale={locale} timeZone={'UTC'}>
        <QueryProvider connectionId={connectionId}>{children}</QueryProvider>
      </IntlProvider>
    </AutumnProvider>
  );
}
