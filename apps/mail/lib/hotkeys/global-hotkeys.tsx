'use client';

import { keyboardShortcuts } from '@/config/shortcuts';
import { useShortcuts } from './use-hotkey-utils';
import { useQueryState } from 'nuqs';

export function GlobalHotkeys() {
  const [composeOpen, setComposeOpen] = useQueryState('isComposeOpen');
  const scope = 'global';

  const handlers = {
    search: () => {
      console.log('well well well');
      document.getElementsByName('q')[0]?.focus();
    },
    newEmail: () => setComposeOpen('true'),
  };

  const globalShortcuts = keyboardShortcuts.filter((shortcut) => shortcut.scope === scope);

  useShortcuts(globalShortcuts, handlers, { scope });

  return null;
}
