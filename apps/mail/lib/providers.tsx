'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { SidebarProvider } from '@/components/ui/sidebar';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { PluginProvider } from '@/hooks/use-plugins';
import { PostHogProvider } from './posthog-provider';
import { useSettings } from '@/hooks/use-settings';
import { Provider as JotaiProvider } from 'jotai';

export function Providers({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  const { data } = useSettings();

  const theme = data?.settings?.colorTheme || 'system';

  return (
    <PluginProvider>
      <NuqsAdapter>
        <JotaiProvider>
            <NextThemesProvider {...props} defaultTheme={theme}>
              <SidebarProvider>
                <PostHogProvider>{children}</PostHogProvider>
              </SidebarProvider>
            </NextThemesProvider>
        </JotaiProvider>
      </NuqsAdapter>
    </PluginProvider>
  );
}
