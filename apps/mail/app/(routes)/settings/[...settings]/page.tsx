import NotificationsPage from '../notifications/page';
import ConnectionsPage from '../connections/page';
import AppearancePage from '../appearance/page';
import ShortcutsPage from '../shortcuts/page';
import SecurityPage from '../security/page';
import { m } from '@/paraglide/messages';
import GeneralPage from '../general/page';
import { useParams } from 'react-router';
import LabelsPage from '../labels/page';

const settingsPages: Record<string, React.ComponentType> = {
  general: GeneralPage,
  connections: ConnectionsPage,
  security: SecurityPage,
  appearance: AppearancePage,
  shortcuts: ShortcutsPage,
  notifications: NotificationsPage,
  labels: LabelsPage,
};

export default function SettingsPage() {
  const params = useParams();
  const section = params.settings?.[0] || 'general';


  const SettingsComponent = settingsPages[section];

  if (!SettingsComponent) {
    return <div>{m['pages.error.settingsNotFound']()}</div>;
  }

  return <SettingsComponent />;
}
