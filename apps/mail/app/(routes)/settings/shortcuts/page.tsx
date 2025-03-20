'use client';

import { SettingsCard } from '@/components/settings/settings-card';
import { keyboardShortcuts } from '@/config/shortcuts'; //import the shortcuts
import type { MessageKey } from '@/config/navigation';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

export default function ShortcutsPage() {
  const shortcuts = keyboardShortcuts; //now gets shortcuts from the config file
  const t = useTranslations();

  return (
    <div className="grid gap-6">
      <SettingsCard
        title={t('pages.settings.shortcuts.title')}
        description={t('pages.settings.shortcuts.description')}
        footer={
          <div className="flex gap-4">
            <Button variant="outline">{t('common.actions.resetToDefaults')}</Button>
            <Button>{t('common.actions.saveChanges')}</Button>
          </div>
        }
      >
        <div className="grid gap-2 md:grid-cols-2">
          {shortcuts.map((shortcut, index) => (
            <Shortcut key={index} keys={shortcut.keys}>
              {t(`pages.settings.shortcuts.actions.${shortcut.action}` as MessageKey)}
            </Shortcut>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}

function Shortcut({ children, keys }: { children: ReactNode; keys: string[] }) {
  return (
    <div className="bg-popover text-muted-foreground flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
      <span className="font-medium">{children}</span>
      <div className="flex select-none gap-1">
        {keys.map((key) => (
          <kbd
            key={key}
            className="border-muted-foreground/10 bg-accent h-6 rounded-[6px] border px-1.5 font-mono text-xs leading-6"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}
