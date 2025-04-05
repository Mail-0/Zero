'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { AISidebarProvider } from '@/components/ui/ai-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Provider as JotaiProvider } from 'jotai';
import { AIInlineProvider } from '@/components/ui/ai-inline';

export function Providers({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <AISidebarProvider>
      <AIInlineProvider>
        <JotaiProvider>
          <NuqsAdapter>
            <NextThemesProvider {...props}>
              <SidebarProvider>{children}</SidebarProvider>
            </NextThemesProvider>
          </NuqsAdapter>
        </JotaiProvider>
      </AIInlineProvider>
    </AISidebarProvider>
  );
}
