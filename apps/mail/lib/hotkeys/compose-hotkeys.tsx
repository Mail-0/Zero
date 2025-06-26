import { keyboardShortcuts } from '@/config/shortcuts';
import { useShortcuts } from './use-hotkey-utils';
import { useQueryState } from 'nuqs';

export function ComposeHotkeys() {
  const scope = 'compose';
  const [isComposeOpen, setIsComposeOpen] = useQueryState('isComposeOpen');

  const handlers = {
    closeCompose: () => {
      if (isComposeOpen === 'true') {
        setIsComposeOpen('false');
      }
    },
  };

  const composeShortcuts = keyboardShortcuts.filter((shortcut) => shortcut.scope === scope);

  useShortcuts(composeShortcuts, handlers, { scope });

  return null;
}
