import NotificationsPage from '../notifications/page';
import ConnectionsPage from '../connections/page';
import AppearancePage from '../appearance/page';
import ShortcutsPage from '../shortcuts/page';
import SecurityPage from '../security/page';
import PluginsPage from '../plugins/page';
import { m } from '@/paraglide/messages';
import GeneralPage from '../general/page';
import { useParams } from 'react-router';
import { useEffect } from 'react';
import LabelsPage from '../labels/page';

const settingsPages: Record<string, React.ComponentType> = {
  general: GeneralPage,
  connections: ConnectionsPage,
  security: SecurityPage,
  appearance: AppearancePage,
  shortcuts: ShortcutsPage,
  notifications: NotificationsPage,
  labels: LabelsPage,
  plugins: PluginsPage,
};

export default function SettingsPage() {
  const params = useParams();
  // File-based route `[...settings]` provides a named catch-all param `settings`
  const settingsParam = (params as Record<string, string | undefined>).settings;
  const section = settingsParam?.split('/')?.[0] || 'general';

  // Log when the settings page is opened and whenever the section changes
  // useEffect(() => {
  //   try {
  //     // Group the logs for easier scanning in the console
  //     console.groupCollapsed('[Settings] Page opened');
  //     console.info('Displaying section:', section);
  //     console.debug('Route params:', params);
  //     console.groupEnd();
  //   } catch {
  //     // no-op if console is unavailable
  //   }
  // }, [section]);

  const SettingsComponent = settingsPages[section];

  // Warn if an unknown section is requested
  // useEffect(() => {
  //   if (!SettingsComponent) {
  //     console.warn('[Settings] Unknown settings section requested:', section);
  //   }
  // }, [SettingsComponent, section]);

  if (!SettingsComponent) {
    return <div>{m['pages.error.settingsNotFound']()}</div>;
  }

  return <SettingsComponent />;
}
