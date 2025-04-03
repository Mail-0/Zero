'use client';

import {
  ArchiveX,
  BellOff,
  X,
  Inbox,
  Tag,
  AlertTriangle,
  User,
  Bell,
  ListMinusIcon,
  ArrowRightIcon,
  Loader2,
  Archive,
  RotateCw,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { moveThreadsTo, ThreadDestination, getAvailableActions } from '@/lib/thread-actions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useState, useCallback, useMemo, useEffect, useRef, memo } from 'react';
import { ThreadDisplay, ThreadDemo } from '@/components/mail/thread-display';
import { handleUnsubscribe } from '@/lib/email-utils.client';
import { useParams, useSearchParams } from 'next/navigation';
import { MailListDemo } from '@/components/mail/mail-list';
import { useSearchValue } from '@/hooks/use-search-value';
import { useMediaQuery } from '../../hooks/use-media-query';
import { useMail } from '@/components/mail/use-mail';
import { SidebarToggle } from '../ui/sidebar-toggle';
import { Skeleton } from '@/components/ui/skeleton';
import { clearBulkSelectionAtom } from './use-mail';
import { useThreads } from '@/hooks/use-threads';
import { Button } from '@/components/ui/button';
import { useHotKey } from '@/hooks/use-hot-key';
import { useSession } from '@/lib/auth-client';
import { useStats } from '@/hooks/use-stats';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getMail } from '@/actions/mail';
import { SearchBar } from './search-bar';
import { cn } from '@/lib/utils';
import items from './demo.json';
import { useAtom } from 'jotai';
import { toast } from 'sonner';

export function DemoMailLayout() {
  const [mail, setMail] = useState({
    selected: 'demo',
    bulkSelected: [],
  });
  const [selectedMail, setSelectedMail] = useState<any>(null);
  const isMobile = false;
  const isValidating = false;
  const isLoading = false;
  const isDesktop = true;
  const searchParams = useSearchParams();
  const threadIdParam = searchParams?.get('threadId');
  const [activeCategory, setActiveCategory] = useState('Primary');
  const [filteredItems, setFilteredItems] = useState(items);

  const handleSelectMail = useCallback((message: any) => {
    setSelectedMail(message);
    setMail((prev) => ({ ...prev, selected: message.id }));
  }, []);

  useEffect(() => {
    if (activeCategory === 'Primary') {
      setFilteredItems(items);
    } else {
      const categoryMap = {
        Important: 'important',
        Personal: 'personal',
        Updates: 'updates',
        Promotions: 'promotions',
      };

      const filterTag = categoryMap[activeCategory as keyof typeof categoryMap];
      const filtered = items.filter((item) => item.tags && item.tags.includes(filterTag));
      setFilteredItems(filtered);
    }
  }, [activeCategory]);

  useEffect(() => {
    if (filteredItems.length > 0 && !selectedMail) {
      handleSelectMail(filteredItems[0]);
    }
  }, [filteredItems, selectedMail, handleSelectMail]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="rounded-inherit flex">
        <ResizablePanelGroup
          direction="horizontal"
          autoSaveId="mail-panel-layout"
          className="rounded-inherit gap-1.5 overflow-hidden"
        >
          <ResizablePanel
            className={cn(
              'border-none !bg-transparent',
              mail?.selected ? 'md:hidden lg:block' : '', // Hide on md, but show again on lg and up
            )}
            defaultSize={isMobile ? 100 : 25}
            minSize={isMobile ? 100 : 25}
          >
            <div className="bg-offsetLight dark:bg-offsetDark flex-1 flex-col overflow-y-auto shadow-inner md:flex md:rounded-2xl md:border md:shadow-sm">
              <div
                className={cn(
                  'compose-gradient h-0.5 w-full transition-opacity',
                  isValidating ? 'opacity-50' : 'opacity-0',
                )}
              />
              <div
                className={cn(
                  'sticky top-0 z-10 flex items-center justify-between gap-1.5 p-2 transition-colors',
                )}
              >
                <SidebarToggle className="h-fit px-2" />
                <div>
                  <MailCategoryTabs
                    iconsOnly={true}
                    onCategoryChange={(category) => {
                      setActiveCategory(category);
                    }}
                    initialCategory={activeCategory}
                  />
                </div>
              </div>

              <div className="h-[calc(100dvh-56px)] max-h-[800px] overflow-hidden pt-0 md:h-[calc(100dvh-(8px+8px+14px+44px))]">
                {isLoading ? (
                  <div className="flex flex-col">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="flex flex-col px-4 py-3">
                        <div className="flex w-full items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-24" />
                          </div>
                          <Skeleton className="h-3 w-12" />
                        </div>
                        <Skeleton className="mt-2 h-3 w-32" />
                        <Skeleton className="mt-2 h-3 w-full" />
                        <div className="mt-2 flex gap-2">
                          <Skeleton className="h-4 w-16 rounded-md" />
                          <Skeleton className="h-4 w-16 rounded-md" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <MailListDemo items={filteredItems} onSelectMail={handleSelectMail} />
                )}
              </div>
            </div>
          </ResizablePanel>

          {isDesktop && mail.selected && (
            <>
              <ResizableHandle className="opacity-0" />
              <ResizablePanel
                className="bg-offsetLight dark:bg-offsetDark shadow-sm md:flex md:rounded-2xl md:border md:shadow-sm"
                defaultSize={75}
                minSize={25}
              >
                <div className="relative hidden h-[calc(100vh-(12px+14px))] max-h-[800px] flex-1 md:block">
                  <ThreadDemo mail={selectedMail ? [selectedMail] : [filteredItems[0]]} />
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>

        {/* Mobile Drawer */}
        {isMobile && (
          <Drawer open={!!threadIdParam}>
            <DrawerContent className="bg-offsetLight dark:bg-offsetDark h-[calc(100vh-3rem)] overflow-hidden p-0">
              <DrawerHeader className="sr-only">
                <DrawerTitle>Email Details</DrawerTitle>
              </DrawerHeader>
              <div className="flex h-full flex-col overflow-hidden">
                <div className="flex-1 overflow-hidden">
                  <ThreadDisplay isMobile={true} mail={filteredItems[0]} />
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        )}
      </div>
    </TooltipProvider>
  );
}

export function MailLayout({ children }: { children: React.ReactNode }) {
  const { folder, threadId } = useParams<{ folder: string; threadId: string }>();
  const [mail, setMail] = useMail();
  const [, clearBulkSelection] = useAtom(clearBulkSelectionAtom);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const t = useTranslations();
  const prevFolderRef = useRef(folder);
  const { isLoading, isValidating, mutate: mutateThreads } = useThreads();
  const { mutate: mutateStats } = useStats();

  useEffect(() => {
    if (prevFolderRef.current !== folder && mail.bulkSelected.length > 0) {
      clearBulkSelection();
    }
    prevFolderRef.current = folder;
  }, [folder, mail.bulkSelected.length, clearBulkSelection]);

  useEffect(() => {
    if (!session?.user && !isPending) {
      router.push('/login');
    }
  }, [session?.user, isPending]);
  
  // Add event listener for undo operations
  useEffect(() => {
    const handleUndo = async (event: CustomEvent) => {
      const { threadIds, currentFolder, destination } = event.detail;
      
      if (threadIds && destination) {
        try {
          await moveThreadsTo({
            threadIds,
            currentFolder: currentFolder || folder,
            destination,
          });
          
          // Refresh data after the undo operation
          await Promise.all([mutateThreads(), mutateStats()]);
          toast.success(t('common.mail.undoSuccess'));
        } catch (error) {
          console.error('Error undoing action', error);
          toast.error(t('common.mail.undoError'));
        }
      }
    };
    
    window.addEventListener('mail:undo', handleUndo as EventListener);
    
    return () => {
      window.removeEventListener('mail:undo', handleUndo as EventListener);
    };
  }, [folder, mutateThreads, mutateStats, t]);

  const isDesktop = useMediaQuery('(min-width: 768px)');

  // Check if we're on mobile on mount and when window resizes
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768); // 768px is the 'md' breakpoint
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  const searchParams = useSearchParams();
  const threadIdParam = searchParams.get('threadId');

  // No need to track threadIdParam with a separate state

  const handleClose = useCallback(() => {
    // Update URL to remove threadId parameter
    const currentParams = new URLSearchParams(searchParams.toString());
    currentParams.delete('threadId');
    router.push(`/mail/${folder}?${currentParams.toString()}`);
  }, [router, folder, searchParams]);

  // Search bar is always visible now, no need for keyboard shortcuts to toggle it
  useHotKey('Esc', (event) => {
    event?.preventDefault();
    // Handle other Esc key functionality if needed
  });

  const searchIconRef = useRef<any>(null);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="rounded-inherit flex">
        <div className="rounded-inherit w-full gap-1.5 overflow-hidden">
          <div className={cn('border-none !bg-transparent', threadId ? 'md:hidden lg:block' : '')}>
            <div className="bg-offsetLight dark:bg-offsetDark flex-1 flex-col overflow-y-auto shadow-inner md:flex md:rounded-2xl md:border md:shadow-sm">
              <div
                className={cn('compose-gradient h-0.5 w-full transition-opacity', 'opacity-0')}
              />
              <div
                className={cn(
                  'sticky top-0 z-10 flex items-center justify-between gap-1.5 border-b p-2 transition-colors',
                )}
              >
                <div className="flex items-center gap-2">
                  <SidebarToggle className="h-fit px-2" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => router.refresh()}
                      >
                        <RotateCw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('common.actions.refresh')}</TooltipContent>
                  </Tooltip>
                </div>

                {mail.bulkSelected.length > 0 ? (
                  <>
                    <div className="flex flex-1 items-center justify-center">
                      <span className="text-sm font-medium tabular-nums">
                        {t('common.mail.selected', { count: mail.bulkSelected.length })}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground ml-1.5 h-8 w-fit px-2"
                            onClick={() => setMail({ ...mail, bulkSelected: [] })}
                          >
                            <X />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('common.mail.clearSelection')}</TooltipContent>
                      </Tooltip>
                    </div>
                    <BulkSelectActions />
                  </>
                ) : (
                  <>
                    <div className="flex flex-1 justify-center">
                      <SearchBar />
                    </div>
                    {!threadId && (
                      <div className="flex items-center">
                        <CategorySelect />
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="h-[calc(100dvh-56px)] overflow-hidden pt-0 md:h-[calc(100dvh-(8px+8px+14px+44px))]">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function BulkSelectActions() {
  const t = useTranslations();
  const [errorQty, setErrorQty] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isUnsub, setIsUnsub] = useState(false);

  const handleMassUnsubscribe = async () => {
    setIsLoading(true);
    toast.promise(
      Promise.all(
        mail.bulkSelected.map(async (bulkSelected) => {
          await new Promise((resolve) => setTimeout(resolve, 499));
          const emailData = await getMail({ id: bulkSelected });
          if (emailData) {
            const [firstEmail] = emailData;
            if (firstEmail)
              return handleUnsubscribe({ emailData: firstEmail }).catch((e) => {
                toast.error(e.message ?? 'Unknown error while unsubscribing');
                setErrorQty((eq) => eq++);
              });
          }
        }),
      ).then(() => {
        setIsUnsub(false);
        setIsLoading(false);
      }),
      {
        loading: 'Unsubscribing...',
        success: 'All done! you will no longer receive emails from these mailing lists.',
        error: 'Something went wrong!',
      },
    );
  };
  const [mail, setMail] = useMail();
  const { folder } = useParams<{ folder: string }>();
  const { mutate: mutateThreads } = useThreads();
  const { mutate: mutateStats } = useStats();

  const onMoveSuccess = useCallback(async () => {
    await mutateThreads();
    await mutateStats();
    setMail({ ...mail, bulkSelected: [] });
  }, [mail, setMail, mutateThreads, mutateStats]);

  const availableActions = getAvailableActions(folder).filter(
    (action): action is Exclude<ThreadDestination, null> => action !== null,
  );

  const actionButtons = {
    spam: {
      icon: <ArchiveX />,
      tooltip: t('common.mail.moveToSpam'),
    },
    archive: {
      icon: <Archive />,
      tooltip: t('common.mail.archive'),
    },
    inbox: {
      icon: <Inbox />,
      tooltip: t('common.mail.moveToInbox'),
    },
  };

  return (
    <div className="flex items-center gap-1.5">
      <Dialog onOpenChange={setIsUnsub} open={isUnsub}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="ghost" className="md:h-fit md:px-2">
                <ListMinusIcon />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>{t('common.mailDisplay.unsubscribe')}</TooltipContent>
        </Tooltip>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mass Unsubscribe</DialogTitle>
            <DialogDescription>
              We will remove you from all of the mailing lists in the selected threads. If your
              action is required to unsubscribe from certain threads, you will be notified.
            </DialogDescription>
          </DialogHeader>
          <p className={'text-muted-foreground text-sm text-red-500'}>Errors: {errorQty}</p>
          <DialogFooter>
            <Button disabled={isLoading} onClick={handleMassUnsubscribe}>
              {!isLoading && <span>Begin</span>}{' '}
              {isLoading ? (
                <Loader2 className={'animate-spin'} />
              ) : (
                <ArrowRightIcon className="h-4 w-4" />
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" className="md:h-fit md:px-2">
            <BellOff />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('common.mail.mute')}</TooltipContent>
      </Tooltip>

      {availableActions.map((action) => (
        <Tooltip key={action}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className="md:h-fit md:px-2"
              onClick={() => {
                if (mail.bulkSelected.length === 0) return;
                
                // Record action for undo capability
                const actionEvent = new CustomEvent('mail:action', {
                  detail: { 
                    action: action, 
                    threadId: mail.bulkSelected,
                    previousFolder: folder,
                    currentFolder: action
                  },
                });
                window.dispatchEvent(actionEvent);
                
                moveThreadsTo({
                  threadIds: mail.bulkSelected,
                  currentFolder: folder,
                  destination: action,
                }).then(() => {
                  // Show toast with undo instructions
                  toast.success(`${mail.bulkSelected.length} emails moved to ${action}`, {
                    description: 'Press ⌘⇧T to undo'
                  });
                  onMoveSuccess();
                });
              }}
            >
              {actionButtons[action].icon}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{actionButtons[action].tooltip}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

const Categories = () => {
  const t = useTranslations();

  return [
    {
      id: 'Primary',
      name: t('common.mailCategories.primary'),
      searchValue: '',
      icon: <Inbox className="h-4 w-4" />,
      colors:
        'border-0 bg-gray-200 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400 dark:hover:bg-gray-800/70',
    },
    {
      id: 'Important',
      name: t('common.mailCategories.important'),
      searchValue: 'is:important',
      icon: <AlertTriangle className="h-4 w-4" />,
      colors:
        'border-0 text-amber-800 bg-amber-100 dark:bg-amber-900/20 dark:text-amber-500 dark:hover:bg-amber-900/30',
    },
    {
      id: 'Personal',
      name: t('common.mailCategories.personal'),
      searchValue: 'is:personal',
      icon: <User className="h-4 w-4" />,
      colors:
        'border-0 text-green-800 bg-green-100 dark:bg-green-900/20 dark:text-green-500 dark:hover:bg-green-900/30',
    },
    {
      id: 'Updates',
      name: t('common.mailCategories.updates'),
      searchValue: 'is:updates',
      icon: <Bell className="h-4 w-4" />,
      colors:
        'border-0 text-purple-800 bg-purple-100 dark:bg-purple-900/20 dark:text-purple-500 dark:hover:bg-purple-900/30',
    },
    {
      id: 'Promotions',
      name: t('common.mailCategories.promotions'),
      searchValue: 'is:promotions',
      icon: <Tag className="h-4 w-4 rotate-90" />,
      colors:
        'border-0 text-red-800 bg-red-100 dark:bg-red-900/20 dark:text-red-500 dark:hover:bg-red-900/30',
    },
  ];
};

function CategorySelect() {
  const [, setSearchValue] = useSearchValue();
  const categories = Categories();
  const [defaultCategory, setDefaultCategory] = useState('Primary');
  const searchParams = useSearchParams();
  const router = useRouter();

  // Safely access localStorage on the client side only
  useEffect(() => {
    // Check if we're in the browser environment
    if (typeof window !== 'undefined') {
      const savedCategory = localStorage.getItem('mailActiveCategory');
      if (savedCategory) {
        setDefaultCategory(savedCategory);
      }
    }
  }, []);

  return (
    <Select
      onValueChange={(value: string) => {
        // Find the category and trigger its selection
        const category = categories.find((cat) => cat.id === value);

        // Always update the state to match the selected value
        setDefaultCategory(value);

        if (category) {
          // Update search value based on category
          const searchValueState = {
            value: category.searchValue || '',
            highlight: '',
            folder: '',
          };
          setSearchValue(searchValueState);
          router.push(`?q=${category.searchValue}`);

          // Save to localStorage (safely on client-side)
          if (typeof window !== 'undefined') {
            localStorage.setItem('mailActiveCategory', value);
          }
        }
      }}
      defaultValue={defaultCategory}
    >
      <SelectTrigger className="bg-popover h-9 w-36">
        <SelectValue placeholder="Select category" />
      </SelectTrigger>
      <SelectContent>
        {categories.map((category) => (
          <SelectItem key={category.id} value={category.id} className="cursor-pointer">
            <div className="flex items-center gap-2">
              {category.icon}
              <span>{category.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MailCategoryTabs({
  iconsOnly = false,
  isLoading = false,
  onCategoryChange,
  initialCategory,
}: {
  iconsOnly?: boolean;
  isLoading?: boolean;
  onCategoryChange?: (category: string) => void;
  initialCategory?: string;
}) {
  const [, setSearchValue] = useSearchValue();
  const categories = Categories();

  // Initialize with just the initialCategory or "Primary"
  const [activeCategory, setActiveCategory] = useState(initialCategory || 'Primary');

  // Move localStorage logic to a useEffect
  useEffect(() => {
    // Check localStorage only after initial render
    const savedCategory = localStorage.getItem('mailActiveCategory');
    if (savedCategory) {
      setActiveCategory(savedCategory);
    }
  }, [initialCategory]);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeTabElementRef = useRef<HTMLButtonElement>(null);

  const activeTab = useMemo(
    () => categories.find((cat) => cat.id === activeCategory),
    [activeCategory],
  );

  // Save to localStorage when activeCategory changes
  useEffect(() => {
    if (onCategoryChange) {
      onCategoryChange(activeCategory);
    }
  }, [activeCategory, onCategoryChange]);

  useEffect(() => {
    if (activeTab && !isLoading) {
      setSearchValue({
        value: activeTab.searchValue,
        highlight: '',
        folder: '',
      });
    }
  }, [activeCategory, setSearchValue, isLoading]);

  // Function to update clip path
  const updateClipPath = useCallback(() => {
    const container = containerRef.current;
    const activeTabElement = activeTabElementRef.current;

    if (activeCategory && container && activeTabElement) {
      const { offsetLeft, offsetWidth } = activeTabElement;
      const clipLeft = Math.max(0, offsetLeft - 2);
      const clipRight = Math.min(container.offsetWidth, offsetLeft + offsetWidth + 2);
      const containerWidth = container.offsetWidth;

      if (containerWidth) {
        container.style.clipPath = `inset(0 ${Number(100 - (clipRight / containerWidth) * 100).toFixed(2)}% 0 ${Number((clipLeft / containerWidth) * 100).toFixed(2)}%)`;
      }
    }
  }, [activeCategory]);

  // Update clip path when active category changes
  useEffect(() => {
    updateClipPath();
  }, [activeCategory, updateClipPath]);

  // Update clip path when iconsOnly changes
  useEffect(() => {
    // Small delay to ensure DOM has updated with new sizes
    const timer = setTimeout(() => {
      updateClipPath();
    }, 10);

    return () => clearTimeout(timer);
  }, [iconsOnly, updateClipPath]);

  // Update clip path on window resize
  useEffect(() => {
    const handleResize = () => {
      updateClipPath();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateClipPath]);

  return (
    <div className="relative mx-auto w-fit">
      <ul className="flex justify-center gap-1.5">
        {categories.map((category) => (
          <li key={category.name}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  ref={activeCategory === category.id ? activeTabElementRef : null}
                  data-tab={category.id}
                  onClick={() => {
                    setActiveCategory(category.id);
                    localStorage.setItem('mailActiveCategory', category.id);
                  }}
                  className={cn(
                    'flex h-7 items-center gap-1.5 rounded-full px-2 text-xs font-medium transition-all duration-200',
                    activeCategory === category.id
                      ? category.colors
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  {category.icon}
                  <span className={cn('hidden', !iconsOnly && 'md:inline')}>{category.name}</span>
                </button>
              </TooltipTrigger>
              {iconsOnly && (
                <TooltipContent>
                  <span>{category.name}</span>
                </TooltipContent>
              )}
            </Tooltip>
          </li>
        ))}
      </ul>

      <div
        aria-hidden
        className="absolute inset-0 z-10 overflow-hidden transition-[clip-path] duration-300 ease-in-out"
        ref={containerRef}
      >
        <ul className="flex justify-center gap-1.5">
          {categories.map((category) => (
            <li key={category.id}>
              <button
                data-tab={category.id}
                onClick={() => {
                  setActiveCategory(category.id);
                }}
                className={cn(
                  'flex h-7 items-center gap-1.5 rounded-full px-2 text-xs font-medium',
                  category.colors,
                )}
                tabIndex={-1}
              >
                {category.icon}
                <span className={cn('hidden', !iconsOnly && 'md:inline')}>{category.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}