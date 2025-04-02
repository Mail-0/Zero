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
  
  // Track recent mail actions for undo functionality
  const [lastAction, setLastAction] = React.useState<{
    action: string;
    threadId?: string | string[];
    currentFolder?: string;
    previousFolder?: string;
  } | null>(null);
  
  // Add event listeners to detect when reply composer opens/closes
  React.useEffect(() => {
    const handleReplyOpen = () => setIsReplyComposerOpen(true);
    const handleReplyClose = () => setIsReplyComposerOpen(false);
    
    // Listen for custom events that track mail actions
    const handleMailAction = (event: CustomEvent) => {
      const { action, threadId, currentFolder, previousFolder } = event.detail;
      setLastAction({ action, threadId, currentFolder, previousFolder });
    };
    
    window.addEventListener('replyComposer:open', handleReplyOpen);
    window.addEventListener('replyComposer:close', handleReplyClose);
    window.addEventListener('mail:action', handleMailAction as EventListener);
    
    return () => {
      window.removeEventListener('replyComposer:open', handleReplyOpen);
      window.removeEventListener('replyComposer:close', handleReplyClose);
      window.removeEventListener('mail:action', handleMailAction as EventListener);
    };
  }, []);

  // Define action handlers as a mapping from action to handler function
  const actionHandlers = React.useMemo(() => {
    // Helper function to find a button by various selectors
    const findButton = (selectors: string[]): HTMLElement | null => {
      for (const selector of selectors) {
        const button = document.querySelector(selector);
        if (button instanceof HTMLElement) return button;
      }
      return null;
    };
    
    return {
      'ai-compose': () => {
        const inThreadView = isViewingThread;
        
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
      },
      
      'search': () => {
        // Focus search input or open search dialog
        document.querySelector('[aria-label="Search"]')?.focus();
      },
      
      'archive': () => {
        const inThreadView = isViewingThread;
        if (inThreadView && threadId) {
          // Store current state for undo
          const currentAction = 'archive';
          const previousFolder = 'inbox'; // Assume archiving from inbox
          const currentFolder = 'archive';
          
          // Update last action for undo functionality
          setLastAction({
            action: currentAction,
            threadId,
            previousFolder,
            currentFolder
          });
          
          // Try to find the archive button in thread display
          const archiveSelectors = [
            'button[aria-label*="Archive" i]',
            '.fa-archive',
            '.feather-archive',
            'svg[class*="archive" i]'
          ];
          
          const archiveButton = findButton(archiveSelectors) || 
            document.querySelector(archiveSelectors[3])?.closest('button') as HTMLElement;

          if (archiveButton) {
            archiveButton.click();
          } else {
            // Dispatch a custom event as fallback
            const event = new CustomEvent('mail:archive', {
              detail: { threadId, previousFolder, currentFolder },
            });
            window.dispatchEvent(event);
            
            // Also dispatch the general mail:action event for tracking
            const actionEvent = new CustomEvent('mail:action', {
              detail: { action: currentAction, threadId, previousFolder, currentFolder },
            });
            window.dispatchEvent(actionEvent);
            
            // Show toast with undo instructions
            toast.success(`Email archived`, {
              description: 'Press ⌘⇧T to undo'
            });
          }
        }
      },
      
      'delete': () => {
        const inThreadView = isViewingThread;
        if (inThreadView && threadId) {
          // Store current state for undo
          const currentAction = 'delete';
          // Determine the current folder based on the URL path
          const currentPath = window.location.pathname;
          const previousFolder = currentPath.includes('/archive') ? 'archive' : 'inbox';
          const currentFolder = 'bin'; // Destination folder
          
          // Update last action for undo functionality
          setLastAction({
            action: currentAction,
            threadId,
            previousFolder,
            currentFolder
          });
          
          // Try to find a delete/trash button
          const deleteSelectors = [
            'button[aria-label*="Delete" i]', 
            'button[aria-label*="Trash" i]',
            '.fa-trash', 
            '.feather-trash', 
            'svg[class*="trash" i]'
          ];
          
          const deleteButton = findButton(deleteSelectors) || 
            document.querySelector(deleteSelectors[4])?.closest('button') as HTMLElement;

          if (deleteButton) {
            deleteButton.click();
          } else {
            // Dispatch a custom event as fallback
            const event = new CustomEvent('mail:delete', {
              detail: { threadId, previousFolder, currentFolder },
            });
            window.dispatchEvent(event);
            
            // Also dispatch the general mail:action event for tracking
            const actionEvent = new CustomEvent('mail:action', {
              detail: { action: currentAction, threadId, previousFolder, currentFolder },
            });
            window.dispatchEvent(actionEvent);
            
            // Show toast with undo instructions
            toast.success(`Email moved to trash`, {
              description: 'Press ⌘⇧T to undo'
            });
          }
        }
      },
      
      'print': () => {
        if (isViewingThread) {
          window.print();
        }
      },
      
      'expand': () => {
        if (isViewingThread) {
          // Try finding the expand button
          const expandSelectors = [
            'button[aria-label*="fullscreen" i]', 
            'button[aria-label*="Expand" i]',
            '.fa-expand', 
            '.feather-expand', 
            'svg[class*="expand" i]'
          ];
          
          const expandButton = findButton(expandSelectors) || 
            document.querySelector(expandSelectors[4])?.closest('button') as HTMLElement;

          if (expandButton) {
            expandButton.click();
          } else {
            // Dispatch a custom event as fallback
            const event = new CustomEvent('mail:expand', {
              detail: { threadId },
            });
            window.dispatchEvent(event);
          }
        }
      },
      
      'undo': () => {
        if (lastAction) {
          if (lastAction.action === 'archive' || lastAction.action === 'delete' || lastAction.action === 'spam') {
            // For actions that moved messages between folders, reverse the action
            const threadIds = Array.isArray(lastAction.threadId) ? lastAction.threadId : [lastAction.threadId];
            if (threadIds && lastAction.previousFolder) {
              // Dispatch a custom event to reverse the action
              const event = new CustomEvent('mail:undo', {
                detail: { 
                  threadIds, 
                  currentFolder: lastAction.currentFolder,
                  destination: lastAction.previousFolder as 'inbox' | 'archive' | 'spam'
                },
              });
              window.dispatchEvent(event);
              toast.success(`Undoing last action: ${lastAction.action}`);
              // Clear last action after undoing
              setLastAction(null);
            }
          } else {
            toast.info(`Cannot undo action: ${lastAction.action}`);
          }
        } else {
          toast.info('Nothing to undo');
        }
      },
      
      'reply': () => {
        if (isViewingThread) {
          // Look for the ThreadActionButton with the reply icon/label
          const replySelectors = [
            'button[aria-label*="Reply" i]',
            '.fa-reply', 
            '.feather-reply', 
            'svg[class*="reply" i]',
            '.ReplyCompose button', 
            'button:has(span:contains("Reply to"))'
          ];
          
          // Try finding any button with Reply text content
          let replyButton = findButton(replySelectors) || 
            document.querySelector(replySelectors[3])?.closest('button') as HTMLElement;
            
          if (!replyButton) {
            const buttons = Array.from(document.querySelectorAll('button'));
            const textMatchButton = buttons.find(
              (btn) =>
                btn.textContent?.toLowerCase().includes('reply') ||
                btn.innerHTML.toLowerCase().includes('reply'),
            );
            if (textMatchButton) replyButton = textMatchButton as HTMLElement;
          }

          // Click the button if found
          if (replyButton) {
            replyButton.click();
          } else {
            // Use custom event as fallback
            const event = new CustomEvent('mail:reply', {
              detail: { threadId },
            });
            window.dispatchEvent(event);
          }
        }
      },
      
      'forward': () => {
        if (isViewingThread) {
          // Forward is typically in the dropdown menu, so using a custom event is more reliable
          const event = new CustomEvent('mail:forward', {
            detail: { threadId },
          });
          window.dispatchEvent(event);
        }
      },
    };
  }, [pathname, router, isComposing, isViewingThread, threadId, lastAction]);
  
  // Helper function to handle mail actions using the action handlers map
  const handleMailAction = React.useCallback(
    (action: string) => {
      const handler = actionHandlers[action as keyof typeof actionHandlers];
      if (handler) {
        handler();
      } else {
        console.log(`Action not implemented: ${action}`);
      }
    },
    [actionHandlers]
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
      
      // Handle undo shortcut (Cmd+Shift+T)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        // Only trigger if there's an action that can be undone
        if (lastAction) {
          handleMailAction('undo');
        } else {
          toast.info('Nothing to undo');
        }
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [isAppRoute, lastAction, handleMailAction]);

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

    // Add compose message as first mail command
    mailCommands.push({
      group: 'mail',
      item: {
        title: 'common.commandPalette.commands.composeMessage',
        url: '/mail/create',
        icon: Pencil
      }
    });

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

            {/* Only show undo when there's an action to undo */}
            {lastAction && (
              <CommandItem onSelect={() => runCommand(() => handleMailAction('undo'))}>
                <Undo size={16} strokeWidth={2} className="opacity-70" aria-hidden="true" />
                <span>Undo {lastAction.action}</span>
                <CommandShortcut>
                  {memoizedShortcuts
                    .find((s: { action: string; keys: string[] }) => s.action === 'undoLastAction')
                    ?.keys.join(' ')}
                </CommandShortcut>
              </CommandItem>
            )}
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
