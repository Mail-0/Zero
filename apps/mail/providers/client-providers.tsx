'use client';

import { AISidebarProvider } from '@/components/ui/ai-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { PostHogProvider } from '@/lib/posthog-provider';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Analytics } from '@vercel/analytics/react';
import { useSettings } from '@/hooks/use-settings';
import CustomToaster from '@/components/ui/toast';
import { Provider as JotaiProvider } from 'jotai';
import type { PropsWithChildren } from 'react';

import { ThemeCustomizer } from '@/components/theme-customizer';
import { ThemeProvider } from './theme-providers';

export function ClientProviders({ children }: PropsWithChildren) {
  const { data } = useSettings();

  const theme = data?.settings.colorTheme || 'system';

  return (
    <NuqsAdapter>
      <AISidebarProvider>
        <JotaiProvider>
          <ThemeProvider
            // attribute="class"
            // enableSystem
            // disableTransitionOnChange
            // @ts-ignore
            defaultTheme={'dark'}
          >
            <SidebarProvider>
              <PostHogProvider>
                {children}
                <ThemeCustomizer />
                <CustomToaster />
                <Analytics />
              </PostHogProvider>
            </SidebarProvider>
          </ThemeProvider>
        </JotaiProvider>
      </AISidebarProvider>
    </NuqsAdapter>
  );
}
