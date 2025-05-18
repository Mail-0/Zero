'use client';
import { SettingsLayoutContent } from '@/components/ui/settings-content';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <SettingsLayoutContent>{children}</SettingsLayoutContent>;
}
