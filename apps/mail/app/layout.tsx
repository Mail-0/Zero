import { CookieProvider } from '@/providers/cookie-provider';
import { getLocale, getMessages } from 'next-intl/server';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { NextIntlClientProvider } from 'next-intl';
import { siteConfig } from '@/lib/site-config';
import { Toast } from '@/components/ui/toast';
import { Providers } from '@/lib/providers';
import { headers } from 'next/headers';
import type { Viewport } from 'next';
import { cn } from '@/lib/utils';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata = siteConfig;

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default async function RootLayout({
  children,
  cookies,
}: Readonly<{
  children: React.ReactNode;
  cookies: React.ReactNode;
}>) {
  // const isEuRegion = (await headers()).get('x-user-eu-region') === 'true';
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* <script src="https://unpkg.com/react-scan/dist/auto.global.js" /> */}
        <meta name="x-user-country" content={(await headers()).get('x-user-country') || ''} />
        <meta
          name="x-user-eu-region"
          content={(await headers()).get('x-user-eu-region') || 'false'}
        />
      </head>
      <body className={cn(geistSans.variable, geistMono.variable, 'antialiased')}>
        <Providers attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NextIntlClientProvider messages={messages}>
            <CookieProvider>
              {children}
              {cookies}
              <Toast />
              <Analytics />
              {/* {isEuRegion && <CookieConsent />} */}
            </CookieProvider>
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}
