'use client';
import { SettingsLayoutContent } from '@/components/ui/settings-content';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <SettingsLayoutContent>{children}</SettingsLayoutContent>;
}
