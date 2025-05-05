'use client';

import { HotkeyProviderWrapper } from '@/components/providers/hotkey-provider-wrapper';
import { CommandPaletteProvider } from '@/components/context/command-palette-context';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <HotkeyProviderWrapper>
      <CommandPaletteProvider>
        <div className="relative flex max-h-screen w-full overflow-hidden">{children}</div>
      </CommandPaletteProvider>
    </HotkeyProviderWrapper>
  );
}
