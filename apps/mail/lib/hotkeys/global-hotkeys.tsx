import { useCommandPalette } from '@/components/context/command-palette-context';
import { keyboardShortcuts } from '@/config/shortcuts';
import { useShortcuts } from './use-hotkey-utils';
import { useQueryState } from 'nuqs';

export function GlobalHotkeys() {
  const [composeOpen, setComposeOpen] = useQueryState('isComposeOpen');
  const { openModal, clearAllFilters } = useCommandPalette();
  const scope = 'global';

  const handlers = {
    newEmail: () => setComposeOpen('true'),
    commandPalette: () => openModal(),
    clearAllFilters: () => clearAllFilters(),
  };

  const globalShortcuts = keyboardShortcuts.filter((shortcut) => shortcut.scope === scope);

  useShortcuts(globalShortcuts, handlers, { scope });

  return null;
}
