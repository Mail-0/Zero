'use client';

import { keyboardShortcuts } from '@/config/shortcuts';
import { useShortcuts } from './use-hotkey-utils';

const closeView = (event: KeyboardEvent) => {
  event.preventDefault();
};

export function ThreadDisplayHotkeys() {
  const scope = 'thread-display';

  const handlers = {
    closeView: () => closeView(new KeyboardEvent('keydown', { key: 'Escape' })),
  };

  const threadDisplayShortcuts = keyboardShortcuts.filter((shortcut) => shortcut.scope === scope);

  useShortcuts(threadDisplayShortcuts, handlers, { scope });

  return null;
}
