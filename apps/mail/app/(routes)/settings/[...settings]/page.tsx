"use client";

import NotificationsPage from "../notifications/page";
import ConnectionsPage from "../connections/page";
import AppearancePage from "../appearance/page";
import ShortcutsPage from "../shortcuts/page";
import SecurityPage from "../security/page";
import { useParams } from "next/navigation";
import GeneralPage from "../general/page";

const settingsPages: Record<string, React.ComponentType> = {
  general: GeneralPage,
  connections: ConnectionsPage,
  security: SecurityPage,
  appearance: AppearancePage,
  shortcuts: ShortcutsPage,
  notifications: NotificationsPage,
};

export default function SettingsPage() {
  const params = useParams();
  const section = params.settings?.[0] || "general";

  const SettingsComponent = settingsPages[section];

  if (!SettingsComponent) {
    return <div>404 - Settings page not found</div>;
  }

  return <SettingsComponent />;
}
