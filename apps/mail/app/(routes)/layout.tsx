'use client';

import { CommandPaletteProvider } from '@/components/context/command-palette-context';
import { HotkeyProviderWrapper } from '@/components/providers/hotkey-provider-wrapper';
import { dexieStorageProvider } from '@/lib/idb';
import { SWRConfig } from 'swr';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <HotkeyProviderWrapper>
      <CommandPaletteProvider>
        <div className="flex h-screen w-screen overflow-hidden">
          <SWRConfig
            value={{
              provider: typeof window !== 'undefined' ? dexieStorageProvider : undefined,
              revalidateOnFocus: false,
              revalidateIfStale: false,
              shouldRetryOnError: false,
            }}
          >
            {children}
          </SWRConfig>
        </div>
      </CommandPaletteProvider>
    </HotkeyProviderWrapper>
  );
}
