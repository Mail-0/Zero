'use client';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useRouter, usePathname } from 'next/navigation';
import { navigationConfig } from '@/config/navigation';
import { ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Pencil2 } from '../icons/icons';
import { useQueryState } from 'nuqs';
import * as React from 'react';

type CommandPaletteContext = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openModal: () => void;
};

type Props = {
  children?: React.ReactNode | React.ReactNode[];
};

type CommandItem = {
  title: string;
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  url?: string;
  onClick?: () => unknown;
  shortcut?: string;
  isBackButton?: boolean;
  disabled?: boolean;
};

const CommandPaletteContext = React.createContext<CommandPaletteContext | null>(null);

export function useCommandPalette() {
  const context = React.useContext(CommandPaletteContext);
  if (!context) {
    throw new Error('useCommandPalette must be used within a CommandPaletteProvider.');
  }
  return context;
}

export function CommandPalette({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [, setIsComposeOpen] = useQueryState('isComposeOpen');
  const router = useRouter();
  const pathname = usePathname();
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prevOpen) => !prevOpen);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  const t = useTranslations();

  const allCommands = React.useMemo(() => {
    type CommandGroup = {
      group: string;
      items: CommandItem[];
    };

    const mailCommands: CommandItem[] = [];
    const settingsCommands: CommandItem[] = [];
    const otherCommands: Record<string, CommandItem[]> = {};

    mailCommands.push({
      title: 'common.commandPalette.commands.composeMessage',
      icon: Pencil2,
      shortcut: 'c',
      onClick: () => {
        setIsComposeOpen('true');
      },
    });

    for (const sectionKey in navigationConfig) {
      const section = navigationConfig[sectionKey];

      section?.sections.forEach((group) => {
        group.items.forEach((navItem) => {
          if (navItem.disabled) return;
          const item: CommandItem = {
            title: navItem.title,
            icon: navItem.icon,
            url: navItem.url,
            shortcut: navItem.shortcut,
            isBackButton: navItem.isBackButton,
            disabled: navItem.disabled,
          };

          if (sectionKey === 'mail') {
            mailCommands.push(item);
          } else if (sectionKey === 'settings') {
            if (!item.isBackButton || pathname.startsWith('/settings')) {
              settingsCommands.push(item);
            }
          } else {
            // Handle other command groups
            if (!otherCommands[sectionKey]) {
              otherCommands[sectionKey] = [];
            }
            otherCommands[sectionKey].push(item);
          }
        });
      });
    }

    const result: CommandGroup[] = [
      {
        group: t('common.commandPalette.groups.mail'),
        items: mailCommands,
      },
      {
        group: t('common.commandPalette.groups.settings'),
        items: settingsCommands,
      },
    ];

    Object.entries(otherCommands).forEach(([groupKey, items]) => {
      if (items.length > 0) {
        let groupTitle = groupKey;
        try {
          const translationKey = `common.commandPalette.groups.${groupKey}` as any;
          groupTitle = t(translationKey) || groupKey;
        } catch {
          // Fallback to the original key if translation fails
        }

        result.push({
          group: groupTitle,
          items,
        });
      }
    });

    return result;
  }, [pathname, t]);

  return (
    <CommandPaletteContext.Provider
      value={{
        open,
        setOpen,
        openModal: () => {
          setOpen(false);
        },
      }}
    >
      <CommandDialog open={open} onOpenChange={setOpen}>
        <VisuallyHidden>
          <DialogTitle>{t('common.commandPalette.title')}</DialogTitle>
          <DialogDescription>{t('common.commandPalette.description')}</DialogDescription>
        </VisuallyHidden>
        <CommandInput autoFocus placeholder={t('common.commandPalette.placeholder')} />
        <CommandList>
          <CommandEmpty>{t('common.commandPalette.noResults')}</CommandEmpty>
          {allCommands.map((group, groupIndex) => (
            <React.Fragment key={groupIndex}>
              {group.items.length > 0 && (
                <CommandGroup heading={group.group}>
                  {group.items.map((item: any) => (
                    <CommandItem
                      key={item.url || item.title}
                      onSelect={() =>
                        runCommand(() => {
                          if (item.onClick) {
                            item.onClick();
                          } else if (item.url) {
                            router.push(item.url);
                          }
                        })
                      }
                    >
                      {item.icon && (
                        <item.icon
                          size={16}
                          strokeWidth={2}
                          className="h-4 w-4 opacity-60"
                          aria-hidden="true"
                        />
                      )}
                      <span>{t(item.title)}</span>
                      {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {groupIndex < allCommands.length - 1 && <CommandSeparator />}
            </React.Fragment>
          ))}
          <CommandSeparator />
          <CommandGroup heading={t('common.commandPalette.groups.help')}>
            {/* <CommandItem onSelect={() => runCommand(() => console.log('Help with shortcuts'))}>
              <CircleHelp size={16} strokeWidth={2} className="opacity-60" aria-hidden="true" />
              <span>{t('common.commandPalette.commands.helpWithShortcuts')}</span>
              <CommandShortcut>
                {keyboardShortcuts
                  .find((s: { action: string; keys: string[] }) => s.action === 'helpWithShortcuts')
                  ?.keys.join(' ')}
              </CommandShortcut>
            </CommandItem> */}
            <CommandItem
              onSelect={() =>
                runCommand(() => window.open('https://github.com/Mail-0/Zero', '_blank'))
              }
            >
              <ArrowUpRight size={16} strokeWidth={2} className="opacity-60" aria-hidden="true" />
              <span>{t('common.commandPalette.commands.goToDocs')}</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
      {children}
    </CommandPaletteContext.Provider>
  );
}

export const CommandPaletteProvider = ({ children }: Props) => {
  return (
    <React.Suspense>
      <CommandPalette>{children}</CommandPalette>
    </React.Suspense>
  );
};
