import { SettingsGroup, kbd } from '@/components/settings/settings-ui';
import { SettingsCard } from '@/components/settings/settings-card';
import { formatDisplayKeys } from '@/lib/hotkeys/use-hotkey-utils';
import { useShortcutCache } from '@/lib/hotkeys/use-hotkey-utils';
import { useCategorySettings } from '@/hooks/use-categories';
import { type Shortcut } from '@/config/shortcuts';
import { m } from '@/paraglide/messages';
import { type ReactNode } from 'react';

export default function ShortcutsPage() {
  const {
    shortcuts,
    // TODO: Implement shortcuts syncing and caching
    // updateShortcut,
  } = useShortcutCache();
  const categorySettings = useCategorySettings();

  return (
    <SettingsCard
      title={m['pages.settings.shortcuts.title']()}
      description={m['pages.settings.shortcuts.description']()}
      // footer={
      //   <div className="flex gap-4">
      //     <Button
      //       variant="outline"
      //       onClick={async () => {
      //         try {
      //           await Promise.all(keyboardShortcuts.map((shortcut) => updateShortcut(shortcut)));
      //           toast.success('Shortcuts reset to defaults');
      //         } catch (error) {
      //           console.error('Failed to reset shortcuts:', error);
      //           toast.error('Failed to reset shortcuts');
      //         }
      //       }}
      //     >
      //       {t('common.actions.resetToDefaults')}
      //     </Button>
      //   </div>
      // }
    >
      <div className="space-y-6">
        {Object.entries(
          shortcuts.reduce<Record<string, Shortcut[]>>((acc, shortcut) => {
            const scope = shortcut.scope;
            if (!acc[scope]) acc[scope] = [];
            acc[scope].push(shortcut);
            return acc;
          }, {}),
        ).map(([scope, scopedShortcuts]) => (
          <div key={scope} className="space-y-2">
            <h3 className="text-muted-foreground px-1 text-[11px] font-medium tracking-wide uppercase">
              {scope.split('-').join(' ')}
            </h3>
            <SettingsGroup>
              {scopedShortcuts.map((shortcut) => {
                const categoryActionIndex: Record<string, number> = {
                  showImportant: 0,
                  showAllMail: 1,
                  showPersonal: 2,
                  showUpdates: 3,
                  showPromotions: 4,
                  showUnread: 5,
                };

                let label: string;
                const translation: unknown = Reflect.get(
                  m,
                  `pages.settings.shortcuts.actions.${shortcut.action}`,
                );
                const actionLabel =
                  typeof translation === 'function' ? String(translation()) : shortcut.action;

                if (shortcut.action in categoryActionIndex && categorySettings.length) {
                  const idx = categoryActionIndex[shortcut.action];
                  const cat = categorySettings[idx];
                  label = cat ? `Show ${cat.name}` : actionLabel;
                } else {
                  label = actionLabel;
                }

                return (
                  <ShortcutItem
                    key={`${scope}-${shortcut.action}-${shortcut.keys.join('+')}`}
                    keys={shortcut.keys}
                    //   action={shortcut.action}
                  >
                    {label}
                  </ShortcutItem>
                );
              })}
            </SettingsGroup>
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}

function ShortcutItem({ children, keys }: { children: ReactNode; keys: string[] }) {
  // const [isRecording, setIsRecording] = useState(false);
  const displayKeys = formatDisplayKeys(keys);

  // const { updateShortcut } = useShortcutCache(session?.user?.id);

  // const handleHotkeyRecorded = async (newKeys: string[]) => {
  //   try {
  //     // Find the original shortcut to preserve its type and description
  //     const originalShortcut = keyboardShortcuts.find((s) => s.action === action);
  //     if (!originalShortcut) {
  //       throw new Error('Original shortcut not found');
  //     }

  //     const updatedShortcut: Shortcut = {
  //       ...originalShortcut,
  //       keys: newKeys,
  //     };

  //     await updateShortcut(updatedShortcut);
  //     toast.success('Shortcut saved successfully');
  //   } catch (error) {
  //     console.error('Failed to save shortcut:', error);
  //     toast.error('Failed to save shortcut');
  //   }
  // };

  return (
    <>
      <div
        className="flex items-center justify-between gap-3 px-4 py-2"
        // onClick={() => setIsRecording(true)}
      >
        <span className="min-w-0 truncate text-[13px]">{children}</span>
        <div className="flex shrink-0 gap-1">
          {displayKeys.map((key) => (
            <kbd key={key} className={kbd}>
              {key}
            </kbd>
          ))}
        </div>
      </div>
      {/* <HotkeyRecorder
        isOpen={isRecording}
        onClose={() => setIsRecording(false)}
        onHotkeyRecorded={handleHotkeyRecorded}
        currentKeys={keys}
      /> */}
    </>
  );
}
