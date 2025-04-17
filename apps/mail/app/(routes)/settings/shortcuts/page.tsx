'use client';

import { SettingsCard } from '@/components/settings/settings-card';
import { keyboardShortcuts, type Shortcut } from '@/config/shortcuts';
import type { MessageKey } from '@/config/navigation';
import { HotkeyRecorder } from './hotkey-recorder';
import { useState, type ReactNode, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { formatDisplayKeys } from '@/lib/hotkeys/use-hotkey-utils';
import { hotkeysDB } from '@/lib/hotkeys/hotkeys-db';
import { toast } from 'sonner';

export default function ShortcutsPage() {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(keyboardShortcuts);
  const t = useTranslations();

  useEffect(() => {
    // Load any custom shortcuts from IndexedDB
    hotkeysDB.getAllHotkeys()
      .then(savedShortcuts => {
        if (savedShortcuts.length > 0) {
          const updatedShortcuts = keyboardShortcuts.map(defaultShortcut => {
            const savedShortcut = savedShortcuts.find(s => s.action === defaultShortcut.action);
            return savedShortcut || defaultShortcut;
          });
          setShortcuts(updatedShortcuts);
        }
      })
      .catch(console.error);
  }, []);

  return (
    <div className="grid gap-6">
      <SettingsCard
        title={t('pages.settings.shortcuts.title')}
        description={t('pages.settings.shortcuts.description')}
        footer={
          <div className="flex gap-4">
            <Button 
              variant="outline" 
              onClick={async () => {
                try {
                  // Save all default shortcuts to IndexedDB
                  await Promise.all(keyboardShortcuts.map(shortcut => hotkeysDB.saveHotkey(shortcut)));
                  setShortcuts(keyboardShortcuts);
                  toast.success('Shortcuts reset to defaults');
                } catch (error) {
                  console.error('Failed to reset shortcuts:', error);
                  toast.error('Failed to reset shortcuts');
                }
              }}
            >
              {t('common.actions.resetToDefaults')}
            </Button>
          </div>
        }
      >
        <div className="grid gap-2 md:grid-cols-2">
          {shortcuts.map((shortcut, index) => (
            <Shortcut 
              key={index} 
              keys={shortcut.keys} 
              action={shortcut.action}
            >
              {t(`pages.settings.shortcuts.actions.${shortcut.action}` as MessageKey)}
            </Shortcut>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}

function Shortcut({ children, keys, action }: { children: ReactNode; keys: string[]; action: string }) {
  const [isRecording, setIsRecording] = useState(false);
  const displayKeys = formatDisplayKeys(keys);

  const handleHotkeyRecorded = async (newKeys: string[]) => {
    try {
      // Find the original shortcut to preserve its type and description
      const originalShortcut = keyboardShortcuts.find(s => s.action === action);
      if (!originalShortcut) {
        throw new Error('Original shortcut not found');
      }

      const updatedShortcut: Shortcut = {
        ...originalShortcut,
        keys: newKeys,
      };
      
      await hotkeysDB.saveHotkey(updatedShortcut);
      toast.success('Shortcut saved successfully');
    } catch (error) {
      console.error('Failed to save shortcut:', error);
      toast.error('Failed to save shortcut');
    }
  };

  return (
    <>
      <div
        className="bg-popover text-muted-foreground hover:bg-accent/50 flex cursor-pointer items-center justify-between gap-2 rounded-lg border p-2 text-sm"
        onClick={() => setIsRecording(true)}
        role="button"
        tabIndex={0}
      >
        <span className="font-medium">{children}</span>
        <div className="flex select-none gap-1">
          {displayKeys.map((key) => (
            <kbd
              key={key}
              className="border-muted-foreground/10 bg-accent h-6 rounded-[6px] border px-1.5 font-mono text-xs leading-6"
            >
              {key}
            </kbd>
          ))}
        </div>
      </div>
      <HotkeyRecorder
        isOpen={isRecording}
        onClose={() => setIsRecording(false)}
        onHotkeyRecorded={handleHotkeyRecorded}
        currentKeys={keys}
      />
    </>
  );
}
