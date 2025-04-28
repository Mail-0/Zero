'use client';

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
  ArchiveX,
  BellOff,
  Inbox,
  ListMinusIcon,
  ArrowRightIcon,
  Loader2,
  Archive,
  MailOpen,
  Trash,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { moveThreadsTo, ThreadDestination, getAvailableActions } from '@/lib/thread-actions';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useState, useCallback, useMemo, useEffect, useRef, memo } from 'react';
import { ThreadDisplay, ThreadDemo } from '@/components/mail/thread-display';
import { MailList, MailListDemo } from '@/components/mail/mail-list';
import { handleUnsubscribe } from '@/lib/email-utils.client';
import { useMediaQuery } from '../../hooks/use-media-query';
import { Filter, Lightning, Mail, X } from '../icons/icons';
import { useSearchValue } from '@/hooks/use-search-value';
import { useHotkeysContext } from 'react-hotkeys-hook';
import { useMail } from '@/components/mail/use-mail';
import { SidebarToggle } from '../ui/sidebar-toggle';
import { getMail, markAsRead } from '@/actions/mail';
import { Skeleton } from '@/components/ui/skeleton';
import { clearBulkSelectionAtom } from './use-mail';
import { useThreads } from '@/hooks/use-threads';
import { Tag, User, Bell } from '../icons/icons';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';
import { useStats } from '@/hooks/use-stats';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SearchBar } from './search-bar';
import { useQueryState } from 'nuqs';
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
  const [threadIdParam] = useQueryState('threadId');
  const [activeCategory, setActiveCategory] = useState('Primary');
  const [filteredItems, setFilteredItems] = useState(items);

  const handleSelectMail = useCallback((message: any) => {
    setSelectedMail(message);
    setMail((prev) => ({ ...prev, selected: message.id }));
  }, []);

  useEffect(() => {
    if (activeCategory === 'All Mail') {
      setFilteredItems(items);
    } else {
      const categoryMap = {
        Primary: 'important',
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
            <div className="bg-offsetLight dark:bg-offsetDark flex-1 flex-col overflow-y-auto shadow-inner md:flex md:rounded-[5px] md:border md:shadow-sm">
              <div
                className={cn(
                  'compose-loading h-0.5 w-full transition-opacity',
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
              <div className="opacity-0" />
              <ResizablePanel
                className="bg-offsetLight dark:bg-offsetDark shadow-sm md:flex md:rounded-2xl md:border md:shadow-sm"
                defaultSize={75}
                minSize={25}
              >
                <div className="relative hidden h-[calc(100dvh-(12px+14px))] max-h-[800px] flex-1 md:block">
                  <ThreadDemo messages={selectedMail ? [selectedMail] : []} />
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>

        {/* Mobile Drawer */}
        {isMobile && (
          <Drawer open={!!threadIdParam}>
            <DrawerContent className="bg-offsetLight dark:bg-offsetDark h-[calc(100dvh-3rem)] overflow-hidden p-0">
              <DrawerHeader className="sr-only">
                <DrawerTitle>Email Details</DrawerTitle>
              </DrawerHeader>
              <div className="flex h-full flex-col overflow-hidden">
                <div className="flex-1 overflow-hidden">
                  <ThreadDisplay isMobile={true} messages={selectedMail ? [selectedMail] : []} />
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        )}
      </div>
    </TooltipProvider>
  );
}

export function MailLayout() {
  const { folder } = useParams<{ folder: string }>();
  const [mail, setMail] = useMail();
  const [, clearBulkSelection] = useAtom(clearBulkSelectionAtom);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const t = useTranslations();
  const prevFolderRef = useRef(folder);
  const { enableScope, disableScope } = useHotkeysContext();

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

  const { isLoading, isValidating } = useThreads();

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

  const [threadId, setThreadId] = useQueryState('threadId');

  useEffect(() => {
    if (threadId) {
      console.log('Enabling thread-display scope, disabling mail-list');
      enableScope('thread-display');
      disableScope('mail-list');
    } else {
      console.log('Enabling mail-list scope, disabling thread-display');
      enableScope('mail-list');
      disableScope('thread-display');
    }

    return () => {
      console.log('Cleaning up mail/thread scopes');
      disableScope('thread-display');
      disableScope('mail-list');
    };
  }, [threadId, enableScope, disableScope]);

  const handleClose = useCallback(() => {
    setThreadId(null);
  }, [setThreadId]);

  // Add mailto protocol handler registration
  useEffect(() => {
    // Register as a mailto protocol handler if browser supports it
    if (typeof window !== 'undefined' && 'registerProtocolHandler' in navigator) {
      try {
        // Register the mailto protocol handler
        // When a user clicks a mailto: link, it will be passed to our dedicated handler
        // which will:
        // 1. Parse the mailto URL to extract email, subject and body
        // 2. Create a draft with these values
        // 3. Redirect to the compose page with just the draft ID
        // This ensures we don't keep the email content in the URL
        navigator.registerProtocolHandler(
          'mailto',
          `${window.location.origin}/mail/compose/handle-mailto?mailto=%s`,
        );
      } catch (error) {
        console.error('Failed to register protocol handler:', error);
      }
    }
  }, []);

  const category = useQueryState('category');

  return (
    <TooltipProvider delayDuration={0}>
      <div className="rounded-inherit relative z-[5] mt-1 flex p-0">
        <ResizablePanelGroup
          direction="horizontal"
          autoSaveId="mail-panel-layout"
          className="rounded-inherit gap-1 overflow-hidden"
        >
          <div className={cn('border-none !bg-transparent', threadId ? 'md:hidden lg:block' : '')}>
            <div className="bg-panelLight dark:bg-panelDark h-[calc(100dvh-0.5rem)] w-screen flex-1 flex-col overflow-y-auto overflow-x-hidden border-[#E7E7E7] shadow-inner md:flex md:max-w-[415px] md:rounded-2xl md:border md:shadow-sm dark:border-[#252525]">
              <div
                className={cn(
                  'sticky top-0 z-10 flex items-center justify-between gap-1.5 border-b border-[#E7E7E7] p-2 px-[20px] transition-colors md:min-h-14 dark:border-[#252525]',
                )}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <div>
                    <SidebarToggle className="h-fit px-2" />
                  </div>
                  <div>
                    {/* <Button variant="ghost" className={cn('md:h-fit md:px-2')}>
                      <Filter className="dark:fill-iconDark fill-iconLight" />
                    </Button> */}
                  </div>
                  {/* <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      // Trigger a refresh of the mail list
                      const event = new CustomEvent('refreshMailList');
                      window.dispatchEvent(event);
                    }}
                  >
                    <ArrowCircle className="dark:fill-iconDark fill-iconLight" />
                  </Button> */}
                </div>

                {/* {mail.bulkSelected.length > 0 ? (
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
                    <div className="flex items-center">
                      <CategorySelect />
                    </div>
                  </>
                )} */}
              </div>
              <div className="p-2 px-[22px]">
                <SearchBar />
                <div className="mt-2">
                  {folder === 'inbox' && <CategorySelect />}
                </div>
              </div>
              <div
                className={cn(
                  `${category[0] === 'Important' ? 'bg-[#F59E0D]' : category[0] === 'All Mail' ? 'bg-[#006FFE]' : category[0] === 'Personal' ? 'bg-[#39ae4a]' : category[0] === 'Updates' ? 'bg-[#8B5CF6]' : category[0] === 'Promotions' ? 'bg-[#F43F5E]' : 'bg-[#F59E0D]'}`,
                  'relative bottom-0.5 z-20 h-0.5 w-full transition-opacity',
                  isValidating ? 'opacity-100' : 'opacity-0',
                )}
              />
              <div className="h-[calc(100vh-9.8rem)] overflow-hidden pt-0">
                <MailList isCompact={true} />
              </div>
            </div>
          </div>

          {isDesktop && (
            <ResizablePanel
              className="bg-panelLight dark:bg-panelDark mr-1 hidden w-fit border-[#E7E7E7] shadow-sm md:flex md:rounded-2xl md:border md:shadow-sm dark:border-[#252525]"
              defaultSize={30}
              minSize={30}
            >
              <div className="relative hidden h-[calc(100vh-(12px+14px))] flex-1 md:block">
                <ThreadDisplay onClose={handleClose} id={threadId ?? undefined} />
              </div>
            </ResizablePanel>
          )}

          {/* Mobile Drawer */}
          {isMobile && (
            <Drawer
              open={!!threadId}
              onOpenChange={(isOpen) => {
                if (!isOpen) handleClose();
              }}
            >
              <DrawerContent className="bg-panelLight dark:bg-panelDark h-[calc(100vh-4rem)] overflow-hidden p-0">
                <DrawerHeader className="sr-only">
                  <DrawerTitle>Email Details</DrawerTitle>
                </DrawerHeader>
                <div className="flex h-full flex-col overflow-hidden">
                  <div className="flex-1 overflow-hidden">
                    {threadId ? (
                      <ThreadDisplay onClose={handleClose} isMobile={true} id={threadId} />
                    ) : null}
                  </div>
                </div>
              </DrawerContent>
            </Drawer>
          )}
        </ResizablePanelGroup>
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
            const firstEmail = emailData.latest;
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

  const handleMarkAsRead = useCallback(async () => {
    try {
      const response = await markAsRead({ ids: mail.bulkSelected });
      if (response.success) {
        // TODO: fix this, it needs useThread mutation
        // TODO: fix this, it needs useThread mutation
        await mutateThreads();
        await mutateStats();
        setMail((prev) => ({
          ...prev,
          bulkSelected: [],
        }));
        toast.success(t('common.mail.markedAsRead'));
      }
    } catch (error) {
      console.error('Error marking as read', error);
      toast.error(t('common.mail.failedToMarkAsRead'));
    }
  }, [mail, setMail, mutateThreads, mutateStats, t]);

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
    bin: {
      icon: <Trash />,
      tooltip: t('common.mail.moveToBin'),
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
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" className="md:h-fit md:px-2" onClick={handleMarkAsRead}>
            <MailOpen />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('common.mail.markAsRead')}</TooltipContent>
      </Tooltip>

      {availableActions.map((action) => (
        <Tooltip key={action}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className="md:h-fit md:px-2"
              onClick={() => {
                if (mail.bulkSelected.length === 0) return;
                moveThreadsTo({
                  threadIds: mail.bulkSelected,
                  currentFolder: folder,
                  destination: action,
                }).then(onMoveSuccess);
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

export const Categories = () => {
  const t = useTranslations();
  const [category] = useQueryState('category', {
    defaultValue: 'Important',
  });
  return [
    {
      id: 'Important',
      name: t('common.mailCategories.important'),
      searchValue: 'is:important',
      icon: (
        <Lightning
          className={cn(
            'fill-[#6D6D6D] dark:fill-[#989898]',
            category === 'Important' && 'dark:fill-white fill-white',
          )}
        />
      ),
    },
    {
      id: 'All Mail',
      name: 'All Mail',
      searchValue: 'is:inbox',
      icon: (
        <Mail
          className={cn(
            'fill-[#6D6D6D] dark:fill-[#989898]',
            category === 'All Mail' && 'dark:fill-white fill-white',
          )}
        />
      ),
      colors:
        'border-0 bg-[#006FFE] text-white dark:bg-[#006FFE] dark:text-white dark:hover:bg-[#006FFE]/90',
    },
    {
      id: 'Personal',
      name: t('common.mailCategories.personal'),
      searchValue: 'is:personal',
      icon: (
        <User
          className={cn(
            'fill-[#6D6D6D] dark:fill-[#989898]',
            category === 'Personal' && 'dark:fill-white fill-white',
          )}
        />
      ),
    },
    {
      id: 'Updates',
      name: t('common.mailCategories.updates'),
      searchValue: 'is:updates',
      icon: (
        <Bell
          className={cn(
            'fill-[#6D6D6D] dark:fill-[#989898]',
            category === 'Updates' && 'dark:fill-white fill-white',
          )}
        />
      ),
    },
    {
      id: 'Promotions',
      name: 'Promotions',
      searchValue: 'is:promotions',
      icon: (
        <Tag
          className={cn(
            'fill-[#6D6D6D] dark:fill-[#989898]',
            category === 'Promotions' && 'dark:fill-white fill-white',
          )}
        />
      ),
    },
  ];
};

type CategoryType = ReturnType<typeof Categories>[0];

function getCategoryColor(categoryId: string): string {
  switch (categoryId.toLowerCase()) {
    case 'primary':
      return 'bg-[#006FFE]';
    case 'all mail':
      return 'bg-[#006FFE]';
    case 'important':
      return 'bg-[#F59E0D]';
    case 'promotions':
      return 'bg-[#F43F5E]';
    case 'personal':
      return 'bg-[#39ae4a]';
    case 'updates':
      return 'bg-[#8B5CF6]';
    default:
      return 'bg-base-primary-500';
  }
}

function CategorySelect() {
  const [, setSearchValue] = useSearchValue();
  const categories = Categories();
  const router = useRouter();
  const { folder } = useParams<{ folder: string }>();
  const [category, setCategory] = useQueryState('category', {
    defaultValue: 'Important',
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const activeTabElementRef = useRef<HTMLButtonElement>(null);

  // Only show category selection for inbox folder
  if (folder !== 'inbox') return <div className="h-8"></div>;

  // Primary category is always the first one
  const primaryCategory = categories[0];
  if (!primaryCategory) return null;

  const renderCategoryButton = (cat: CategoryType, isOverlay = false) => {
    const isSelected = cat.id === (category || 'Primary');
    const bgColor = getCategoryColor(cat.id);

    return (
      <button
        key={cat.id}
        ref={isSelected && !isOverlay ? activeTabElementRef : null}
        onClick={() => {
          setCategory(cat.id);
          setSearchValue({
            value: cat.searchValue || '',
            highlight: '',
            folder: '',
          });
        }}
        className={cn(
          'flex h-8 items-center justify-center gap-1 overflow-hidden rounded-md transition-all duration-300 ease-out border dark:border-none',
          isSelected
            ? cn('flex-1 px-3 text-white border-none', bgColor)
            : 'w-8 bg-white hover:bg-gray-100 dark:bg-[#313131] dark:hover:bg-[#313131]/80',
        )}
        tabIndex={isOverlay ? -1 : undefined}
      >
        <div className="relative overflow-hidden">{cat.icon}</div>
        {isSelected && (
          <div className="flex items-center justify-center gap-2.5 px-0.5">
            <div className="animate-in fade-in-0 slide-in-from-right-4 justify-start text-sm leading-none text-white duration-300">
              {cat.name}
            </div>
          </div>
        )}
      </button>
    );
  };

  // Update clip path when category changes
  useEffect(() => {
    const container = containerRef.current;
    const activeTabElement = activeTabElementRef.current;

    if (category && container && activeTabElement) {
      const { offsetLeft, offsetWidth } = activeTabElement;
      const clipLeft = Math.max(0, offsetLeft - 2);
      const clipRight = Math.min(container.offsetWidth, offsetLeft + offsetWidth + 2);
      const containerWidth = container.offsetWidth;

      if (containerWidth) {
        container.style.clipPath = `inset(0 ${Number(100 - (clipRight / containerWidth) * 100).toFixed(2)}% 0 ${Number((clipLeft / containerWidth) * 100).toFixed(2)}%)`;
      }
    }
  }, [category]);

  return (
    <div className="relative w-full">
      <div className="flex w-full items-start justify-start gap-2">
        {categories.map((cat) => renderCategoryButton(cat))}
      </div>

      <div
        aria-hidden
        className="absolute inset-0 z-10 overflow-hidden transition-[clip-path] duration-300 ease-in-out"
        ref={containerRef}
      >
        <div className="flex w-full items-start justify-start gap-2">
          {categories.map((cat) => renderCategoryButton(cat, true))}
        </div>
      </div>
    </div>
  );
}

function MailCategoryTabs({
  iconsOnly = false,
  onCategoryChange,
  initialCategory,
}: {
  iconsOnly?: boolean;
  onCategoryChange?: (category: string) => void;
  initialCategory?: string;
}) {
  const [, setSearchValue] = useSearchValue();
  const categories = Categories();

  // Initialize with just the initialCategory or "Primary"
  const [activeCategory, setActiveCategory] = useState(initialCategory || 'Primary');

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
    if (activeTab) {
      setSearchValue({
        value: activeTab.searchValue,
        highlight: '',
        folder: '',
      });
    }
  }, [activeCategory, setSearchValue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setSearchValue({
        value: '',
        highlight: '',
        folder: '',
      });
    };
  }, [setSearchValue]);

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
                  }}
                  className={cn(
                    'flex h-7 items-center gap-1.5 rounded-full px-2 text-xs font-medium transition-all duration-200',
                    activeCategory === category.id
                      ? 'bg-primary text-white'
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
                className={cn('flex items-center gap-1.5 rounded-full px-2 text-xs font-medium')}
                tabIndex={-1}
              >
                <p>{category.icon}</p>
                <span className={cn('hidden', !iconsOnly && 'md:inline')}>{category.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
