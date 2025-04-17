'use client';

import { keyboardShortcuts } from '@/config/shortcuts';
import { useShortcuts } from './use-hotkey-utils';
import { useRouter } from 'next/navigation';

export function GlobalHotkeys() {
  const router = useRouter();
  const scope = 'global';

  const handlers = {
    goToDrafts: () => router.push('/mail/draft'),
    inbox: () => router.push('/mail/inbox'),
    sentMail: () => router.push('/mail/sent'),
    search: () => {
      console.log('search');
    },
    newEmail: () => router.push('/mail/compose'),
  };

  const globalShortcuts = keyboardShortcuts.filter((shortcut) => shortcut.scope === scope);

  useShortcuts(globalShortcuts, handlers, { scope });

  return null;
}
