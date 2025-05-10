'use client';

import { keyboardShortcuts } from '@/config/shortcuts';
import { useShortcuts } from './use-hotkey-utils';
import { useRouter } from 'next/navigation';

export function NavigationHotkeys() {
  const router = useRouter();
  const scope = 'navigation';

  const handlers = {
    goToDrafts: () => router.push('/mail/draft'),
    inbox: () => router.push('/mail/inbox'),
    sentMail: () => router.push('/mail/sent'),
    goToArchive: () => router.push('/mail/archive'),
    goToBin: () => router.push('/mail/bin'),
    goToSpam: () => router.push('/mail/spam'),
  };

  const globalShortcuts = keyboardShortcuts.filter((shortcut) => shortcut.scope === scope);

  useShortcuts(globalShortcuts, handlers, { scope });

  return null;
}
