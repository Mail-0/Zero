import { NuqsAdapter } from 'nuqs/adapters/react-router/v7';
import { VoiceProvider } from '@/providers/voice-provider';
import { SidebarProvider } from '@/components/ui/sidebar';
import { PostHogProvider } from '@/lib/posthog-provider';
import { VoiceButton } from '@/components/voice-button';
import { useSettings } from '@/hooks/use-settings';
import CustomToaster from '@/components/ui/toast';
import { Provider as JotaiProvider } from 'jotai';
import type { PropsWithChildren } from 'react';
import { ThemeProvider } from 'next-themes';

export function ClientProviders({ children }: PropsWithChildren) {
  const { data } = useSettings();

  const theme = data?.settings.colorTheme || 'system';

  return (
    <NuqsAdapter>
      <JotaiProvider>
        <ThemeProvider
          attribute="class"
          enableSystem
          disableTransitionOnChange
          defaultTheme={theme}
        >
          <SidebarProvider>
            <PostHogProvider>
              {children}
              <CustomToaster />
            </PostHogProvider>
          </SidebarProvider>
        </ThemeProvider>
      </JotaiProvider>
    </NuqsAdapter>
  );
}
