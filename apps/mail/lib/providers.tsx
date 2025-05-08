'use client';

import { EditorProvider } from '@/components/providers/editor-provider';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { AISidebarProvider } from '@/components/ui/ai-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { PostHogProvider } from './posthog-provider';
import { useSettings } from '@/hooks/use-settings';
import { Provider as JotaiProvider } from 'jotai';
import { CustomThemeProvider } from '@/providers/custom-theme-provider';

export function Providers({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  const { settings } = useSettings();

  const theme = settings?.colorTheme || 'system';

  return (
    <NuqsAdapter>
      <AISidebarProvider>
        <JotaiProvider>
          <NextThemesProvider {...props} defaultTheme={theme}>
            <CustomThemeProvider>
              <SidebarProvider>
                <PostHogProvider>{children}</PostHogProvider>
              </SidebarProvider>
            </CustomThemeProvider>
          </NextThemesProvider>
        </JotaiProvider>
      </AISidebarProvider>
    </NuqsAdapter>
  );
}
