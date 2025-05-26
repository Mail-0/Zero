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
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  Suspense,
  useEffect,
  type ComponentType,
  type ReactNode,
  Fragment,
} from 'react';
import { getMainSearchTerm, parseNaturalLanguageSearch } from '@/lib/utils';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Archive2, Pencil2, Star2, Tag, Trash } from '../icons/icons';
import { Calendar, Filter, Mail, Search } from 'lucide-react';
import { useSearchValue } from '@/hooks/use-search-value';
import { useLocation, useNavigate } from 'react-router';
import { navigationConfig } from '@/config/navigation';
import { useThreads } from '@/hooks/use-threads';
import { useTranslations } from 'use-intl';
import { VisuallyHidden } from 'radix-ui';
import { useQueryState } from 'nuqs';

type CommandPaletteContext = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openModal: () => void;
};

type Props = {
  children?: ReactNode | ReactNode[];
};

interface CommandItem {
  title: string;
  icon?: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  url?: string;
  onClick?: () => unknown;
  shortcut?: string;
  isBackButton?: boolean;
  disabled?: boolean;
  keywords?: string[];
  description?: string;
}

interface FilterOption {
  id: string;
  name: string;
  keywords: string[];
  action: (currentSearch: string) => string;
}

type CommandView = 'main' | 'search' | 'filter';

interface CommandItem {
  title: string;
  icon?: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  url?: string;
  onClick?: () => unknown;
  shortcut?: string;
  isBackButton?: boolean;
  disabled?: boolean;
  description?: string;
}

interface FilterOption {
  id: string;
  name: string;
  keywords: string[];
  action: (currentSearch: string) => string;
}

const CommandPaletteContext = createContext<CommandPaletteContext | null>(null);

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error('useCommandPalette must be used within a CommandPaletteProvider.');
  }
  return context;
}

export function CommandPalette({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [, setIsComposeOpen] = useQueryState('isComposeOpen');
  const [currentView, setCurrentView] = useState<CommandView>('main');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchValue, setSearchValue] = useSearchValue();
  const [, threads] = useThreads();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const t = useTranslations();

  useEffect(() => {
    if (!open) {
      setCurrentView('main');
      setSearchQuery('');
    }
  }, [open]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prevOpen) => !prevOpen);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  const filterOptions = useMemo<FilterOption[]>(
    () => [
      {
        id: 'from',
        name: 'From',
        keywords: ['sender', 'from', 'author'],
        action: (currentSearch: string) => `from:${currentSearch}`,
      },
      {
        id: 'to',
        name: 'To',
        keywords: ['recipient', 'to', 'receiver'],
        action: (currentSearch: string) => `to:${currentSearch}`,
      },
      {
        id: 'subject',
        name: 'Subject',
        keywords: ['title', 'subject', 'about'],
        action: (currentSearch: string) => `subject:${currentSearch}`,
      },
      {
        id: 'has:attachment',
        name: 'Has Attachment',
        keywords: ['attachment', 'file', 'document'],
        action: () => 'has:attachment',
      },
      {
        id: 'is:starred',
        name: 'Is Starred',
        keywords: ['starred', 'favorite', 'important'],
        action: () => 'is:starred',
      },
      {
        id: 'is:unread',
        name: 'Is Unread',
        keywords: ['unread', 'new', 'unopened'],
        action: () => 'is:unread',
      },
      {
        id: 'after',
        name: 'After Date',
        keywords: ['date', 'after', 'since'],
        action: (currentSearch: string) => `after:${currentSearch}`,
      },
      {
        id: 'before',
        name: 'Before Date',
        keywords: ['date', 'before', 'until'],
        action: (currentSearch: string) => `before:${currentSearch}`,
      },
      {
        id: 'has:label',
        name: 'Has Label',
        keywords: ['label', 'tag', 'category'],
        action: (currentSearch: string) => `has:${currentSearch}`,
      },
    ],
    [],
  );

  const executeSearch = useCallback(
    (query: string) => {
      setOpen(false);
      const semanticQuery = parseNaturalLanguageSearch(query);
      const finalQuery = semanticQuery || query;

      setSearchValue({
        value: finalQuery,
        highlight: getMainSearchTerm(finalQuery),
        folder: searchValue.folder,
        isAISearching: Boolean(semanticQuery && semanticQuery !== query),
      });

      navigate(`/mail/inbox?search=${encodeURIComponent(finalQuery)}`);
    },
    [navigate, setSearchValue, searchValue],
  );

  const allCommands = useMemo(() => {
    type CommandGroup = {
      group: string;
      items: CommandItem[];
    };

    const searchCommands: CommandItem[] = [];
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

    searchCommands.push({
      title: 'Search Emails',
      icon: Search,
      shortcut: 's',
      onClick: () => {
        setCurrentView('search');
      },
      description: 'Search across your emails',
    });

    searchCommands.push({
      title: 'Filter Emails',
      icon: Filter,
      shortcut: 'f',
      onClick: () => {
        setCurrentView('filter');
      },
      description: 'Filter emails by criteria',
    });

    searchCommands.push({
      title: 'Starred Emails',
      icon: Star2,
      onClick: () => {
        executeSearch('is:starred');
      },
    });

    searchCommands.push({
      title: 'Emails with Attachments',
      icon: Tag,
      onClick: () => {
        executeSearch('has:attachment');
      },
    });

    searchCommands.push({
      title: 'Archived Emails',
      icon: Archive2,
      onClick: () => {
        executeSearch('in:archive');
      },
    });

    searchCommands.push({
      title: 'Trash',
      icon: Trash,
      onClick: () => {
        executeSearch('in:trash');
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
        group: 'Search & Filter',
        items: searchCommands,
      },
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
        } catch {}

        result.push({
          group: groupTitle,
          items,
        });
      }
    });

    return result;
  }, [pathname, t, executeSearch, setCurrentView, setIsComposeOpen]);

  const renderMainView = () => (
    <>
      <CommandInput autoFocus placeholder={t('common.commandPalette.placeholder')} />
      <CommandList>
        <CommandEmpty>{t('common.commandPalette.noResults')}</CommandEmpty>
        {allCommands.map((group, groupIndex) => (
          <Fragment key={groupIndex}>
            {group.items.length > 0 && (
              <CommandGroup heading={group.group}>
                {group.items.map((item: any) => (
                  <CommandItem
                    key={item.url || item.title}
                    onSelect={() => {
                      if (item.title === 'Search Emails' || item.title === 'Filter Emails') {
                        if (item.onClick) {
                          item.onClick();
                          return false;
                        }
                      } else {
                        runCommand(() => {
                          if (item.onClick) {
                            item.onClick();
                          } else if (item.url) {
                            navigate(item.url);
                          }
                        });
                      }
                    }}
                  >
                    {item.icon && (
                      <item.icon
                        size={16}
                        strokeWidth={2}
                        className="h-4 w-4 opacity-60"
                        aria-hidden="true"
                      />
                    )}
                    <div className="ml-2 flex flex-1 flex-col">
                      <span>{t(item.title)}</span>
                      {item.description && (
                        <span className="text-muted-foreground text-xs">{t(item.description)}</span>
                      )}
                    </div>
                    {item.shortcut && (
                      <CommandShortcut>
                        {item.shortcut === 'arrowUp'
                          ? '↑'
                          : item.shortcut === 'arrowDown'
                            ? '↓'
                            : item.shortcut}
                      </CommandShortcut>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {groupIndex < allCommands.length - 1 && group.items.length > 0 && <CommandSeparator />}
          </Fragment>
        ))}
      </CommandList>
    </>
  );

  const renderSearchView = () => {
    const quickResults = useMemo(() => {
      if (!searchQuery || searchQuery.length < 2 || !threads || threads.length === 0) return [];

      return (
        threads
          .filter((thread) => {
            if (!thread) return false;
            return (
              (thread.snippet?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
              (thread.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
              (thread.from?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
              (thread.from?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
            );
          })
          .slice(0, 5) || []
      );
    }, [searchQuery, threads]);

    return (
      <>
        <div className="flex items-center border-b px-3">
          <button
            className="text-muted-foreground hover:text-foreground mr-2"
            onClick={() => setCurrentView('main')}
          >
            ←
          </button>
          <CommandInput
            autoFocus
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder={t('common.commandPalette.searchPlaceholder')}
            className="border-0"
          />
        </div>
        <CommandList>
          <CommandEmpty>{t('common.commandPalette.noSearchResults')}</CommandEmpty>

          {quickResults.length > 0 && (
            <CommandGroup heading={t('common.commandPalette.quickResults')}>
              {quickResults.map((thread) => (
                <CommandItem
                  key={thread.id}
                  onSelect={() => {
                    runCommand(() => {
                      navigate(`/inbox?threadId=${thread.id}`);
                    });
                  }}
                >
                  <Mail className="h-4 w-4 opacity-60" />
                  <div className="ml-2 flex flex-1 flex-col overflow-hidden">
                    <span className="truncate font-medium">{thread.subject || 'No Subject'}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {thread.from?.name || thread.from?.email} - {thread.snippet}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading={t('common.commandPalette.actions')}>
            <CommandItem
              onSelect={() => {
                if (searchQuery) {
                  executeSearch(searchQuery);
                }
              }}
            >
              <Search className="h-4 w-4 opacity-60" />
              <span className="ml-2">
                {t('common.commandPalette.searchForEmails', { query: searchQuery || '...' })}
              </span>
            </CommandItem>

            <CommandItem
              onSelect={() => {
                setCurrentView('filter');
              }}
            >
              <Filter className="h-4 w-4 opacity-60" />
              <span className="ml-2">{t('common.commandPalette.addFilters')}</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </>
    );
  };

  const renderFilterView = () => (
    <>
      <div className="flex items-center border-b px-3">
        <button
          className="text-muted-foreground hover:text-foreground mr-2"
          onClick={() => setCurrentView('main')}
        >
          ←
        </button>
        <CommandInput
          autoFocus
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder={t('common.commandPalette.filterPlaceholder')}
          className="border-0"
        />
      </div>
      <CommandList>
        <CommandEmpty>{t('common.commandPalette.noFilterResults')}</CommandEmpty>

        <CommandGroup heading={t('common.commandPalette.availableFilters')}>
          {filterOptions
            .filter(
              (option) =>
                !searchQuery ||
                option.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                option.keywords.some((kw) => kw.toLowerCase().includes(searchQuery.toLowerCase())),
            )
            .map((filter) => (
              <CommandItem
                key={filter.id}
                onSelect={() => {
                  const newQuery = filter.action(searchQuery);
                  executeSearch(newQuery);
                }}
              >
                <Filter className="h-4 w-4 opacity-60" />
                <span className="ml-2">{filter.name}</span>
              </CommandItem>
            ))}
        </CommandGroup>

        <CommandGroup heading={t('common.commandPalette.examples')}>
          <CommandItem disabled>
            <Calendar className="h-4 w-4 opacity-60" />
            <span className="ml-2">{t('common.commandPalette.exampleDate')}</span>
          </CommandItem>
          <CommandItem disabled>
            <Mail className="h-4 w-4 opacity-60" />
            <span className="ml-2">{t('common.commandPalette.exampleSender')}</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </>
  );

  const renderView = () => {
    switch (currentView) {
      case 'search':
        return renderSearchView();
      case 'filter':
        return renderFilterView();
      default:
        return renderMainView();
    }
  };

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
      <CommandDialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen && currentView !== 'main') {
            setCurrentView('main');
            return;
          }
          setOpen(isOpen);
        }}
      >
        <VisuallyHidden.VisuallyHidden>
          <DialogTitle>{t('common.commandPalette.title')}</DialogTitle>
          <DialogDescription>{t('common.commandPalette.description')}</DialogDescription>
        </VisuallyHidden.VisuallyHidden>
        {renderView()}
      </CommandDialog>
      {children}
    </CommandPaletteContext.Provider>
  );
}

export const CommandPaletteProvider = ({ children }: Props) => {
  return (
    <Suspense>
      <CommandPalette>{children}</CommandPalette>
    </Suspense>
  );
};
