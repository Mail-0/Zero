import { ClientProviders } from '@/providers/client-providers';
import { ServerProviders } from '@/providers/server-providers';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Geist, Geist_Mono } from 'next/font/google';
import { siteConfig } from '@/lib/site-config';
import type { PropsWithChildren } from 'react';
import type { Viewport } from 'next';
import { cn } from '@/lib/utils';
import Script from 'next/script';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export { siteConfig as metadata };

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default async function RootLayout({ children }: PropsWithChildren) {
  return (
    <html suppressHydrationWarning>
      <head>
        <Script src="https://unpkg.com/web-streams-polyfill/dist/polyfill.js" />
      </head>
      <body className={cn(geistSans.variable, geistMono.variable, 'antialiased')}>
        <ServerProviders>
          <ClientProviders>{children}</ClientProviders>
        </ServerProviders>
        <SpeedInsights />
      </body>
    </html>
  );
}
