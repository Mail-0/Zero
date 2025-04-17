'use client';

import { keyboardShortcuts } from '@/config/shortcuts';
import { useShortcuts } from './use-hotkey-utils';

export function ComposeHotkeys() {
  const scope = 'compose';

  const handlers = {};

  const composeShortcuts = keyboardShortcuts.filter((shortcut) => shortcut.scope === scope);

  useShortcuts(composeShortcuts, handlers, { scope });

  return null;
}
