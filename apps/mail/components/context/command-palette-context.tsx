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
  Sparkles,
  BrainCircuit,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
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
  // Simple check for app route, no need to memoize
  const isAppRoute = pathname?.startsWith('/mail') || pathname?.startsWith('/settings') || pathname?.startsWith('/create');
  
  // Check if user is composing a new email
  const isComposing = pathname?.includes('/mail/create') || pathname?.includes('/create');

  // Check if viewing a thread - using a single searchParams initialization outside useMemo
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const threadId = searchParams.get('threadId');
  const isViewingThread = pathname?.includes('/mail/') && !pathname?.includes('/mail/create') && threadId !== null;
  
  // Check if the reply composer is open
  const [isReplyComposerOpen, setIsReplyComposerOpen] = React.useState(false);
  
  // Add event listeners to detect when reply composer opens/closes
  React.useEffect(() => {
    const handleReplyOpen = () => setIsReplyComposerOpen(true);
    const handleReplyClose = () => setIsReplyComposerOpen(false);
    
    window.addEventListener('replyComposer:open', handleReplyOpen);
    window.addEventListener('replyComposer:close', handleReplyClose);
    
    return () => {
      window.removeEventListener('replyComposer:open', handleReplyOpen);
      window.removeEventListener('replyComposer:close', handleReplyClose);
    };
  }, []);

  // Helper function to handle mail actions - moved up to fix declaration order
  const handleMailAction = React.useCallback(
    (action: string) => {
      // Using the thread ID already retrieved above, no need to parse URL again
      const inThreadView = isViewingThread;

      switch (action) {
        // AI Actions
        case 'ai-compose':
          // If in compose view, click the AI Assistant button
          if (isComposing) {
            const aiAssistantButton = document.querySelector('button[title*="Ask AI Assistant" i]');
            if (aiAssistantButton instanceof HTMLElement) {
              aiAssistantButton.click();
            } else {
              // If AI button not found, navigate to compose
              router.push('/mail/create');
            }
          } 
          // If in thread view, click Generate Email button
          else if (inThreadView) {
            // First open reply composer if not already open
            const replyButton = document.querySelector('[aria-label="Reply"]');
            if (replyButton instanceof HTMLElement) {
              replyButton.click();
            }
            
            // Give time for reply composer to render
            setTimeout(() => {
              // Find Generate Email button (it has a Sparkles icon within a group button)
              const allButtons = Array.from(document.querySelectorAll('button'));
              const generateButton = allButtons.find(button => {
                const hasSparklesIcon = button.querySelector('.lucide-sparkles') !== null;
                const buttonText = button.textContent || '';
                return hasSparklesIcon && buttonText.includes('Generate Email');
              });
              
              if (generateButton instanceof HTMLElement) {
                generateButton.click();
              }
            }, 500);
          }
          break;
        
        // Regular mail actions
        case 'search':
          // Focus search input or open search dialog
          document.querySelector('[aria-label="Search"]')?.focus();
          break;
        case 'archive':
          if (inThreadView && threadId) {
            // Try to find the archive button in thread display
            let archiveButton = document.querySelector('button[aria-label*="Archive" i]');

            if (!archiveButton) {
              // Try finding by icon class
              archiveButton = document
                .querySelector('.fa-archive, .feather-archive, svg[class*="archive" i]')
                ?.closest('button');
            }

            if (archiveButton instanceof HTMLElement) {
              archiveButton.click();
            } else {
              // Dispatch a custom event as fallback
              const event = new CustomEvent('mail:archive', {
                detail: { threadId },
              });
              window.dispatchEvent(event);
              console.log('Triggered archive via custom event');
            }
          }
          break;
        case 'delete':
          if (inThreadView && threadId) {
            // Try to find a delete/trash button
            let deleteButton = document.querySelector(
              'button[aria-label*="Delete" i], button[aria-label*="Trash" i]',
            );

            if (!deleteButton) {
              // Try finding by icon
              deleteButton = document
                .querySelector('.fa-trash, .feather-trash, svg[class*="trash" i]')
                ?.closest('button');
            }

            if (deleteButton instanceof HTMLElement) {
              deleteButton.click();
            } else {
              // Dispatch a custom event as fallback
              const event = new CustomEvent('mail:delete', {
                detail: { threadId },
              });
              window.dispatchEvent(event);
              console.log('Triggered delete via custom event');
            }
          }
          break;
        case 'print':
          if (inThreadView) {
            window.print();
          }
          break;
        case 'expand':
          if (inThreadView) {
            // Try finding the expand button
            let expandButton = document.querySelector(
              'button[aria-label*="fullscreen" i], button[aria-label*="Expand" i]',
            );

            if (!expandButton) {
              // Try finding by icon
              expandButton = document
                .querySelector('.fa-expand, .feather-expand, svg[class*="expand" i]')
                ?.closest('button');
            }

            if (expandButton instanceof HTMLElement) {
              expandButton.click();
            } else {
              // Dispatch a custom event as fallback
              const event = new CustomEvent('mail:expand', {
                detail: { threadId },
              });
              window.dispatchEvent(event);
              console.log('Triggered expand via custom event');
            }
          }
          break;
        case 'undo':
          // Call undo function when implemented
          console.log('Undo action triggered');
          break;
        case 'reply':
          if (inThreadView) {
            // Look for the ThreadActionButton with the reply icon/label
            // First try with aria-label
            let replyButton = document.querySelector('button[aria-label*="Reply" i]');

            // If not found, try other selectors
            if (!replyButton) {
              // Try finding by icon class
              replyButton = document
                .querySelector('.fa-reply, .feather-reply, svg[class*="reply" i]')
                ?.closest('button');
            }

            if (!replyButton) {
              // Try finding any button with Reply text content
              const buttons = Array.from(document.querySelectorAll('button'));
              replyButton = buttons.find(
                (btn) =>
                  btn.textContent?.toLowerCase().includes('reply') ||
                  btn.innerHTML.toLowerCase().includes('reply'),
              );
            }

            // If all else fails, look for the reply composer's reply button at the bottom of thread
            if (!replyButton) {
              replyButton = document.querySelector(
                '.ReplyCompose button, button:has(span:contains("Reply to"))',
              );
            }

            // Click the button if found
            if (replyButton instanceof HTMLElement) {
              replyButton.click();
            } else {
              // Direct state manipulation as fallback - this might not work but we can try
              // We're looking for a component that might have setIsReplyOpen function
              const event = new CustomEvent('mail:reply', {
                detail: { threadId },
              });
              window.dispatchEvent(event);
              console.log('Triggered reply via custom event');
            }
          }
          break;
        case 'forward':
          if (inThreadView) {
            // Forward is typically in the dropdown menu, so using a custom event is more reliable
            const event = new CustomEvent('mail:forward', {
              detail: { threadId },
            });
            window.dispatchEvent(event);
            console.log('Triggered forward via custom event');
          }
          break;
        default:
          console.log(`Action not implemented: ${action}`);
      }
    },
    [pathname, router, isComposing, isViewingThread, threadId],
  );

  // Add keyboard shortcut handlers
  React.useEffect(() => {
    if (!isAppRoute) return;

    const down = (e: KeyboardEvent) => {
      // Open command palette
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

  // Shortcuts are a static import, no need to memoize
  const memoizedShortcuts = keyboardShortcuts;

  // Define static action paths, no need to memoize
  const actionPaths = [
    '/mail/inbox', // Inbox
    '/mail/archive', // Archive
    '/mail/create', // Compose
    '/mail/draft', // Drafts
    '/mail/sent', // Sent
    '/mail/spam', // Spam
    '/mail/bin', // Bin/Trash
  ];

  // Use the original implementation to avoid breaking changes
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

      // For navigation items, show all mail folders except current one
      if (group.group === t('common.commandPalette.groups.mail')) {
        if (Array.isArray(group.items)) {
          return {
            ...group,
            items: group.items.filter((item: NavItem) => {
              // Hide current folder from command palette
              return item.url !== pathname;
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
  }, [pathname, t]);

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

          {/* AI Actions - Context-aware */}
          <CommandGroup heading="AI Assistant">
            {/* Show context-aware AI action based on view */}
            {isComposing && (
              <CommandItem onSelect={() => runCommand(() => handleMailAction('ai-compose'))}>
                <Sparkles size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
                <span>Use AI to write this email</span>
              </CommandItem>
            )}
            {isViewingThread && isReplyComposerOpen && (
              <CommandItem onSelect={() => runCommand(() => handleMailAction('ai-compose'))}>
                <Sparkles size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
                <span>Generate AI reply</span>
              </CommandItem>
            )}
          </CommandGroup>

          <CommandSeparator />

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

            {/* Check if in thread view to show email-specific actions */}
            {isViewingThread && (
              <>
                <CommandItem onSelect={() => runCommand(() => handleMailAction('reply'))}>
                  <Reply size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
                  <span>Reply</span>
                  <CommandShortcut>
                    {memoizedShortcuts
                      .find((s: { action: string; keys: string[] }) => s.action === 'reply')
                      ?.keys.join(' ')}
                  </CommandShortcut>
                </CommandItem>

                <CommandItem onSelect={() => runCommand(() => handleMailAction('forward'))}>
                  <Forward size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
                  <span>Forward</span>
                  <CommandShortcut>
                    {memoizedShortcuts
                      .find((s: { action: string; keys: string[] }) => s.action === 'forward')
                      ?.keys.join(' ')}
                  </CommandShortcut>
                </CommandItem>

                <CommandItem onSelect={() => runCommand(() => handleMailAction('archive'))}>
                  <Archive size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
                  <span>Archive</span>
                  <CommandShortcut>
                    {memoizedShortcuts
                      .find(
                        (s: { action: string; keys: string[] }) => s.action === 'archiveEmail',
                      )
                      ?.keys.join(' ')}
                  </CommandShortcut>
                </CommandItem>

                <CommandItem onSelect={() => runCommand(() => handleMailAction('delete'))}>
                  <Trash size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
                  <span>Delete</span>
                  <CommandShortcut>
                    {memoizedShortcuts
                      .find((s: { action: string; keys: string[] }) => s.action === 'delete')
                      ?.keys.join(' ')}
                  </CommandShortcut>
                </CommandItem>

                <CommandItem onSelect={() => runCommand(() => handleMailAction('print'))}>
                  <Printer size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
                  <span>Print</span>
                  <CommandShortcut>
                    {memoizedShortcuts
                      .find((s: { action: string; keys: string[] }) => s.action === 'printEmail')
                      ?.keys.join(' ')}
                  </CommandShortcut>
                </CommandItem>

                <CommandItem onSelect={() => runCommand(() => handleMailAction('expand'))}>
                  <Expand size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
                  <span>Expand view</span>
                  <CommandShortcut>
                    {memoizedShortcuts
                      .find(
                        (s: { action: string; keys: string[] }) => s.action === 'expandEmailView',
                      )
                      ?.keys.join(' ')}
                  </CommandShortcut>
                </CommandItem>
              </>
            )}

            <CommandItem onSelect={() => runCommand(() => handleMailAction('search'))}>
              <Search size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
              <span>Search</span>
              <CommandShortcut>
                {memoizedShortcuts
                  .find((s: { action: string; keys: string[] }) => s.action === 'search')
                  ?.keys.join(' ')}
              </CommandShortcut>
            </CommandItem>

            <CommandItem onSelect={() => runCommand(() => handleMailAction('undo'))}>
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
