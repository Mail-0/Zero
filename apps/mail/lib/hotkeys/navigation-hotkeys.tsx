import { keyboardShortcuts } from '@/config/shortcuts';
import { useShortcuts } from './use-hotkey-utils';
import { useNavigate } from 'react-router';

export function NavigationHotkeys() {
  const navigate = useNavigate();
  const scope = 'navigation';

  const handlers = {
    goToDrafts: () => navigate('/mail/draft'),
    inbox: () => navigate('/mail/inbox'),
    sentMail: () => navigate('/mail/sent'),
    goToArchive: () => navigate('/mail/archive'),
    goToBin: () => navigate('/mail/bin'),
    goToSettings: () => navigate('/settings'),
    helpWithShortcuts: () => navigate('/settings/shortcuts'),
  };

  const globalShortcuts = keyboardShortcuts.filter((shortcut) => shortcut.scope === scope);

  useShortcuts(globalShortcuts, handlers, { scope });

  return null;
}
