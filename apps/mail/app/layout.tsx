import { CookieConsent } from '@/components/cookies/cookie-dialog';
import { CookieProvider } from '@/providers/cookie-provider';
import { getLocale, getMessages } from 'next-intl/server';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { NextIntlClientProvider } from 'next-intl';
import { siteConfig } from '@/lib/site-config';
import { Toast } from '@/components/ui/toast';
import { Providers } from '@/lib/providers';
import { headers } from 'next/headers';
import { cn } from '@/lib/utils';
import Head from 'next/head';
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

export default async function RootLayout({
	children,
	cookies,
}: Readonly<{
	children: React.ReactNode;
	cookies: React.ReactNode;
}>) {
	const isEuRegion = (await headers()).get('x-user-eu-region') === 'true';
	const locale = await getLocale();
	const messages = await getMessages();

	return (
		<html lang={locale} suppressHydrationWarning>
			<head>
				<meta name="x-user-country" content={(await headers()).get('x-user-country') || ''} />
				<meta
					name="x-user-eu-region"
					content={(await headers()).get('x-user-eu-region') || 'false'}
				/>
			</head>
			<body className={cn(geistSans.variable, geistMono.variable, 'antialiased')}>
				<Providers attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
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
