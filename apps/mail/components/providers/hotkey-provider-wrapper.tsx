import { ThreadDisplayHotkeys } from '@/lib/hotkeys/thread-display-hotkeys';
import { NavigationHotkeys } from '@/lib/hotkeys/navigation-hotkeys';
import { MailListHotkeys } from '@/lib/hotkeys/mail-list-hotkeys';
import { ComposeHotkeys } from '@/lib/hotkeys/compose-hotkeys';
import { GlobalHotkeys } from '@/lib/hotkeys/global-hotkeys';
import { HotkeysProvider } from 'react-hotkeys-hook';
import React from 'react';

interface HotkeyProviderWrapperProps {
  children: React.ReactNode;
}

export function HotkeyProviderWrapper({ children }: HotkeyProviderWrapperProps) {
  return (
    <HotkeysProvider initiallyActiveScopes={['global', 'navigation']}>
      <NavigationHotkeys />
      <GlobalHotkeys />
      <MailListHotkeys />
      <ThreadDisplayHotkeys />
      <ComposeHotkeys />
      {children}
    </HotkeysProvider>
  );
}
