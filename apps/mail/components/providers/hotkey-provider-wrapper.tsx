'use client';

import { HotkeysProvider } from 'react-hotkeys-hook';
import { GlobalHotkeys } from '@/lib/hotkeys/global-hotkeys';
import { MailListHotkeys } from '@/lib/hotkeys/mail-list-hotkeys';
import { ThreadDisplayHotkeys } from '@/lib/hotkeys/thread-display-hotkeys';
import { ComposeHotkeys } from '@/lib/hotkeys/compose-hotkeys';
import React from 'react';

interface HotkeyProviderWrapperProps {
  children: React.ReactNode;
}

export function HotkeyProviderWrapper({ children }: HotkeyProviderWrapperProps) {
  return (
    <HotkeysProvider initiallyActiveScopes={['global']}>
      <GlobalHotkeys />
      <MailListHotkeys />
      <ThreadDisplayHotkeys />
      <ComposeHotkeys />
      {children}
    </HotkeysProvider>
  );
} 