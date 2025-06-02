import { HotkeyProviderWrapper } from '@/components/providers/hotkey-provider-wrapper';
import { CommandPaletteProvider } from '@/components/context/command-palette-context';
import { VoiceProvider } from '@/providers/voice-provider';
import { VoiceButton } from '@/components/voice-button';
import { Outlet } from 'react-router';

export default function Layout() {
  return (
    <CommandPaletteProvider>
      <VoiceProvider>
        <HotkeyProviderWrapper>
          <div className="relative flex max-h-screen w-full overflow-hidden">
            <Outlet />
          </div>
          <VoiceButton />
        </HotkeyProviderWrapper>
      </VoiceProvider>
    </CommandPaletteProvider>
  );
}
