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
import {
  ArrowUpRight,
  Undo,
  Expand,
  Reply,
  Forward,
  MessageSquare,
  Search,
  Archive,
  Trash,
  Printer,
  Sun,
  Moon,
} from 'lucide-react';
import { DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useOpenComposeModal } from '@/hooks/use-open-compose-modal';
import { navigationConfig, type NavItem } from '@/config/navigation';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useRouter, usePathname } from 'next/navigation';
import { keyboardShortcuts } from '@/config/shortcuts';
import { useTranslations } from 'next-intl';
import { CircleHelp } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Pencil } from 'lucide-react';
import * as React from 'react';

type CommandPaletteContext = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openModal: () => void;
};

type Props = {
  children?: React.ReactNode | React.ReactNode[];
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
  const { open: openComposeModal } = useOpenComposeModal();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  // Only enable command palette in app routes
  const isAppRoute = React.useMemo(() => {
    return (
      pathname?.startsWith('/mail') ||
      pathname?.startsWith('/settings') ||
      pathname?.startsWith('/create')
    );
  }, [pathname]);

  React.useEffect(() => {
    if (!isAppRoute) return;

    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prevOpen) => !prevOpen);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [isAppRoute]);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  const t = useTranslations();

  // Use memoized shortcuts to ensure updates are reflected
  const memoizedShortcuts = React.useMemo(() => keyboardShortcuts, []);

  // Define actions that should be excluded from navigation items to prevent duplication
  const actionPaths = React.useMemo(
    () => [
      '/mail/inbox', // Inbox
      '/mail/archive', // Archive
      '/mail/create', // Compose
      '/mail/draft', // Drafts
      '/mail/sent', // Sent
      '/mail/spam', // Spam
      '/mail/bin', // Bin/Trash
    ],
    [],
  );

  const allCommands = React.useMemo(() => {
    const mailCommands: { group: string; item: NavItem }[] = [];
    const settingsCommands: { group: string; item: NavItem }[] = [];
    const otherCommands: { group: string; item: NavItem }[] = [];

    for (const sectionKey in navigationConfig) {
      const section = navigationConfig[sectionKey];
      section?.sections.forEach((group) => {
        group.items.forEach((item) => {
          if (!(sectionKey === 'settings' && item.isBackButton)) {
            if (sectionKey === 'mail') {
              mailCommands.push({ group: sectionKey, item });
            } else if (sectionKey === 'settings') {
              settingsCommands.push({ group: sectionKey, item });
            } else {
              otherCommands.push({ group: sectionKey, item });
            }
          } else if (sectionKey === 'settings') {
            settingsCommands.push({ group: sectionKey, item });
          }
        });
      });
    }

    const combinedCommands = [
      { group: t('common.commandPalette.groups.mail'), items: mailCommands.map((c) => c.item) },
      {
        group: t('common.commandPalette.groups.settings'),
        items: settingsCommands.map((c) => c.item),
      },
      ...otherCommands.map((section) => ({ group: section.group, items: section.item })),
    ];

    const filteredCommands = combinedCommands.map((group) => {
      if (group.group === t('common.commandPalette.groups.settings')) {
        if (Array.isArray(group.items)) {
          return {
            ...group,
            items: group.items.filter((item: NavItem) => {
              return pathname.startsWith('/settings') || !item.isBackButton;
            }),
          };
        }
      }

      // For navigation items, exclude any that are already in the actions menu
      if (group.group === t('common.commandPalette.groups.mail')) {
        if (Array.isArray(group.items)) {
          return {
            ...group,
            items: group.items.filter((item: NavItem) => {
              return !actionPaths.includes(item.url);
            }),
          };
        }
      }

      return {
        ...group,
        items: Array.isArray(group.items) ? group.items : [group.items],
      };
    });

    return filteredCommands;
  }, [pathname, t, actionPaths]);

  // Only render command palette in app routes
  if (!isAppRoute) {
    return (
      <CommandPaletteContext.Provider
        value={{
          open: false,
          setOpen: () => {},
          openModal: () => {},
        }}
      >
        {children}
      </CommandPaletteContext.Provider>
    );
  }

  return (
    <CommandPaletteContext.Provider
      value={{
        open,
        setOpen,
        openModal: () => {
          setOpen(false);
          openComposeModal();
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

          {/* Quick Actions */}
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => runCommand(() => router.push('/mail/create'))}>
              <Pencil size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
              <span>Compose message</span>
              <CommandShortcut>
                {memoizedShortcuts
                  .find((s: { action: string; keys: string[] }) => s.action === 'newEmail')
                  ?.keys.join(' ')}
              </CommandShortcut>
            </CommandItem>

            <CommandItem onSelect={() => runCommand(() => console.log('Reply'))}>
              <Reply size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
              <span>Reply</span>
              <CommandShortcut>
                {memoizedShortcuts
                  .find((s: { action: string; keys: string[] }) => s.action === 'reply')
                  ?.keys.join(' ')}
              </CommandShortcut>
            </CommandItem>

            <CommandItem onSelect={() => runCommand(() => console.log('Forward'))}>
              <Forward size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
              <span>Forward</span>
              <CommandShortcut>
                {memoizedShortcuts
                  .find((s: { action: string; keys: string[] }) => s.action === 'forward')
                  ?.keys.join(' ')}
              </CommandShortcut>
            </CommandItem>

            <CommandItem onSelect={() => runCommand(() => console.log('Search'))}>
              <Search size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
              <span>Search</span>
              <CommandShortcut>
                {memoizedShortcuts
                  .find((s: { action: string; keys: string[] }) => s.action === 'search')
                  ?.keys.join(' ')}
              </CommandShortcut>
            </CommandItem>

            <CommandItem onSelect={() => runCommand(() => console.log('Archive'))}>
              <Archive size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
              <span>Archive</span>
              <CommandShortcut>
                {memoizedShortcuts
                  .find((s: { action: string; keys: string[] }) => s.action === 'archiveEmail')
                  ?.keys.join(' ')}
              </CommandShortcut>
            </CommandItem>

            <CommandItem onSelect={() => runCommand(() => console.log('Delete'))}>
              <Trash size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
              <span>Delete</span>
              <CommandShortcut>
                {memoizedShortcuts
                  .find((s: { action: string; keys: string[] }) => s.action === 'delete')
                  ?.keys.join(' ')}
              </CommandShortcut>
            </CommandItem>

            <CommandItem onSelect={() => runCommand(() => console.log('Print'))}>
              <Printer size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
              <span>Print</span>
              <CommandShortcut>
                {memoizedShortcuts
                  .find((s: { action: string; keys: string[] }) => s.action === 'printEmail')
                  ?.keys.join(' ')}
              </CommandShortcut>
            </CommandItem>

            <CommandItem onSelect={() => runCommand(() => console.log('Expand view'))}>
              <Expand size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
              <span>Expand view</span>
              <CommandShortcut>
                {memoizedShortcuts
                  .find((s: { action: string; keys: string[] }) => s.action === 'expandEmailView')
                  ?.keys.join(' ')}
              </CommandShortcut>
            </CommandItem>

            <CommandItem onSelect={() => runCommand(() => console.log('Undo'))}>
              <Undo size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
              <span>Undo</span>
              <CommandShortcut>
                {memoizedShortcuts
                  .find((s: { action: string; keys: string[] }) => s.action === 'undoLastAction')
                  ?.keys.join(' ')}
              </CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* Navigation */}
          {allCommands.map((group, groupIndex) => (
            <React.Fragment key={groupIndex}>
              {group.items.length > 0 && (
                <CommandGroup heading={group.group}>
                  {group.items.map((item: any) => (
                    <CommandItem
                      key={item.url}
                      onSelect={() =>
                        runCommand(() => {
                          router.push(item.url);
                        })
                      }
                    >
                      {item.icon && (
                        <item.icon
                          size={16}
                          strokeWidth={2}
                          className="opacity-70"
                          aria-hidden="true"
                        />
                      )}
                      <span>{t(item.title)}</span>
                      {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {groupIndex < allCommands.length - 1 && group.items.length > 0 && (
                <CommandSeparator />
              )}
            </React.Fragment>
          ))}

          <CommandSeparator />

          {/* Appearance */}
          <CommandGroup heading="Appearance">
            <CommandItem
              onSelect={() => runCommand(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}
            >
              {theme === 'dark' ? (
                <Sun size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
              ) : (
                <Moon size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
              )}
              <span>{theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* Help */}
          <CommandGroup heading="Help">
            <CommandItem onSelect={() => runCommand(() => router.push('/settings/shortcuts'))}>
              <CircleHelp size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
              <span>Help with shortcuts</span>
              <CommandShortcut>
                {memoizedShortcuts
                  .find((s: { action: string; keys: string[] }) => s.action === 'helpWithShortcuts')
                  ?.keys.join(' ')}
              </CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => window.open('https://github.com/Mail-0/Zero', '_blank'))
              }
            >
              <ArrowUpRight size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
              <span>Go to docs</span>
            </CommandItem>

            <CommandItem onSelect={() => runCommand(() => router.push('/settings/general'))}>
              <MessageSquare size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
              <span>Send feedback</span>
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
