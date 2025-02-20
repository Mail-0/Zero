import MailComposeModal from "@/components/mail/mail-compose-modal";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { siteConfig } from "@/lib/site-config";
import { Toast } from "@/components/ui/toast";
import { Providers } from "@/lib/providers";
import { cn } from "@/lib/utils";
import Script from "next/script";
import { Suspense } from "react";
import { env } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = siteConfig;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {env.NODE_ENV === "development" && (
          <Script src="https://unpkg.com/react-scan/dist/auto.global.js"></Script>
        )}
      </head>
      <body className={cn(geistSans.variable, geistMono.variable, "antialiased")}>
        <Providers attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <Suspense>
            <MailComposeModal />
          </Suspense>
          {children}
          <Toast />
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}
