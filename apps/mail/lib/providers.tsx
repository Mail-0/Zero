'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { EditorProvider } from '@/components/providers/editor-provider';
import { AISidebarProvider } from '@/components/ui/ai-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Provider as JotaiProvider } from 'jotai';
import { PostHogProvider } from './posthog-provider';


export function Providers({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    // <AISidebarProvider>
      <JotaiProvider>
        <NuqsAdapter>
          <NextThemesProvider {...props}>
            <SidebarProvider>
              <PostHogProvider>{children}</PostHogProvider>
            </SidebarProvider>
          </NextThemesProvider>
        </NuqsAdapter>
      </JotaiProvider>
    // </AISidebarProvider>
  );
}
