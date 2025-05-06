'use client';

import {
  Archive2,
  Bell,
  CurvedArrow,
  Eye,
  Important,
  Lightning,
  Mail,
  Star2,
  Tag,
  User,
  X,
  MessageSquare,
  Trash,
  ArrowCircle,
  ScanEye,
} from '../icons/icons';
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
  bulkArchive,
  bulkDeleteThread,
  bulkStar,
  getMail,
  markAsImportant,
  markAsRead,
  deleteAllSpamEmails,
  checkSpamEmails
} from '@/actions/mail';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ThreadDemo, ThreadDisplay } from '@/components/mail/thread-display';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MailList, MailListDemo } from '@/components/mail/mail-list';
import { handleUnsubscribe } from '@/lib/email-utils.client';
import { useMediaQuery } from '../../hooks/use-media-query';
import { useAISidebar } from '@/components/ui/ai-sidebar';
import { useSearchValue } from '@/hooks/use-search-value';
import { useHotkeysContext } from 'react-hotkeys-hook';
import { useParams, useRouter } from 'next/navigation';
import { useMail } from '@/components/mail/use-mail';
import { SidebarToggle } from '../ui/sidebar-toggle';
import { Skeleton } from '@/components/ui/skeleton';
import { useBrainState } from '@/hooks/use-summary';
import { clearBulkSelectionAtom } from './use-mail';
import { useThreads } from '@/hooks/use-threads';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';
import { useStats } from '@/hooks/use-stats';
import { useTranslations } from 'next-intl';
import { SearchBar } from './search-bar';
import { Command } from 'lucide-react';
import { useQueryState } from 'nuqs';
import { cn } from '@/lib/utils';
import { useAtom } from 'jotai';
import { toast } from 'sonner';

export function MailLayout() {
  const params = useParams<{ folder: string }>();
  const folder = params?.folder ?? 'inbox';
  const [mail, setMail] = useMail();
  const [, clearBulkSelection] = useAtom(clearBulkSelectionAtom);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const t = useTranslations();
  const prevFolderRef = useRef(folder);
  const { enableScope, disableScope } = useHotkeysContext();
  const { data: brainState } = useBrainState();
  const { mutate: mutateThreads } = useThreads();
  const { mutate: mutateStats } = useStats();
  const [hasSpamEmails, setHasSpamEmails] = useState(false);
  // Track when spam emails are deleted to refresh the UI
  const [spamDeleteCounter, setSpamDeleteCounter] = useState(0);

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
  const [, setActiveReplyId] = useQueryState('activeReplyId');

  const handleClose = useCallback(() => {
    setThreadId(null);
    setActiveReplyId(null);
  }, [setThreadId]);

  const onDeleteAllSpam = useCallback(async () => {
    toast.promise(
      deleteAllSpamEmails()
        .then(async (result) => {
          await mutateThreads();
          await mutateStats();
          // Increment counter to trigger useEffect to check if there are any spam emails left
          setSpamDeleteCounter(prev => prev + 1);
          return result;
        })
        .catch((error) => {
          console.error("Failed to delete spam emails:", error);
          throw error;
        }),
      {
        loading: 'Deleting all spam emails...',
        success: (result) => result.message || 'Successfully deleted all spam emails',
        error: (err) => err.message || 'Failed to delete spam emails',
      }
    );
  }, [mutateThreads, mutateStats]);

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

  // Check if spam folder has emails when in spam folder
  useEffect(() => {
    if (folder === 'spam') {
      const checkForSpamEmails = async () => {
        try {
          const result = await checkSpamEmails();
          setHasSpamEmails(result.hasEmails);
        } catch (error) {
          console.error('Error checking spam emails:', error);
          setHasSpamEmails(false);
        }
      };
      
      checkForSpamEmails();
    }
  }, [folder, spamDeleteCounter]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="rounded-inherit relative z-[5] flex p-0 md:mt-1">
        <ResizablePanelGroup
          direction="horizontal"
          autoSaveId="mail-panel-layout"
          className="rounded-inherit gap-1 overflow-hidden"
        >
          <div
            className={cn(
              'w-full border-none !bg-transparent lg:w-fit',
              threadId ? 'md:hidden lg:block' : '',
            )}
          >
            <div className="bg-panelLight dark:bg-panelDark h-screen flex-1 flex-col overflow-y-auto overflow-x-hidden border-[#E7E7E7] shadow-inner md:flex md:h-[calc(100dvh-0.5rem)] md:rounded-2xl md:border md:shadow-sm lg:w-screen lg:max-w-[415px] xl:max-w-[500px] dark:border-[#252525]">
              <div
                className={cn(
                  'sticky top-0 z-[15] flex items-center justify-between gap-1.5 border-b border-[#E7E7E7] p-2 px-[20px] transition-colors md:min-h-14 dark:border-[#252525]',
                )}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <div>
                    <SidebarToggle className="h-fit px-2" />
                  </div>
                  <div>
                    {mail.bulkSelected.length > 0 ? (
                      <div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => {
                                setMail({ ...mail, bulkSelected: [] });
                              }}
                              className="flex h-6 items-center gap-1 rounded-md bg-[#313131] px-2 text-xs text-[#A0A0A0] hover:bg-[#252525]"
                            >
                              <X className="h-3 w-3 fill-[#A0A0A0]" />
                              <span>esc</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {t('common.actions.exitSelectionModeEsc')}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    ) : null}
                  </div>
                  {brainState?.enabled ? (
                    <Button
                      variant="outline"
                      size={'sm'}
                      className="text-muted-foreground h-fit min-h-0 px-2 py-1 text-[10px] uppercase"
                    >
                      <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                      Auto Labeling
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="p-2 px-[22px]">
                <SearchBar />
                {folder === 'spam' && hasSpamEmails && (
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center justify-center gap-2 w-full border-[#FCCDD5] hover:bg-[#FDE4E9]/10 dark:border-[#6E2532] dark:hover:bg-[#411D23]/60"
                      onClick={onDeleteAllSpam}
                    >
                      <Trash className="h-4 w-4 text-[#F43F5E] fill-[#F43F5E]" />
                      <span>Delete All Spam</span>
                    </Button>
                  </div>
                )}
                <div className="mt-2">
                  {folder === 'inbox' && (
                    <CategorySelect isMultiSelectMode={mail.bulkSelected.length > 0} />
                  )}
                </div>
              </div>
              <div
                className={cn(
                  `${category[0] === 'Important' ? 'bg-[#F59E0D]' : category[0] === 'All Mail' ? 'bg-[#006FFE]' : category[0] === 'Personal' ? 'bg-[#39ae4a]' : category[0] === 'Updates' ? 'bg-[#8B5CF6]' : category[0] === 'Promotions' ? 'bg-[#F43F5E]' : category[0] === 'Unread' ? 'bg-[#006FFE]' : 'bg-[#F59E0D]'}`,
                  'relative bottom-0.5 z-[5] h-0.5 w-full transition-opacity',
                  isValidating ? 'opacity-100' : 'opacity-0',
                )}
              />
              <div className="relative z-[1] h-[calc(100dvh-(2px+88px+49px+2px))] overflow-hidden pt-0 md:h-[calc(100dvh-9.8rem)]">
                <MailList isCompact={true} />
              </div>
            </div>
          </div>

          {isDesktop && (
            <ResizablePanel
              className={`bg-panelLight dark:bg-panelDark ${threadId ? 'mr-1' : 'lg:mr-1'} w-fit rounded-2xl border border-[#E7E7E7] shadow-sm lg:flex lg:shadow-sm dark:border-[#252525]`}
              defaultSize={30}
              minSize={30}
            >
              <div className="relative h-[calc(100vh-(10px))] flex-1 lg:h-[calc(100vh-(12px+14px))]">
                <ThreadDisplay />
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
              <DrawerContent className="bg-panelLight dark:bg-panelDark h-[calc(100dvh-3rem)] p-0">
                <DrawerHeader className="sr-only">
                  <DrawerTitle>Email Details</DrawerTitle>
                </DrawerHeader>
                <div className="flex h-full flex-col">
                  <div className="h-full overflow-y-auto outline-none">
                    {threadId ? <ThreadDisplay /> : null}
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
  const [mail, setMail] = useMail();
  const params = useParams<{ folder: string }>();
  const folder = params?.folder ?? 'inbox';
  const { mutate: mutateThreads } = useThreads();
  const { mutate: mutateStats } = useStats();

  const handleMassUnsubscribe = async () => {
    setIsLoading(true);
    toast.promise(
      Promise.all(
        mail.bulkSelected.filter(Boolean).map(async (bulkSelected) => {
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
      ).then(async () => {
        setIsUnsub(false);
        setIsLoading(false);
        await mutateThreads();
        await mutateStats();
        setMail({ ...mail, bulkSelected: [] });
      }),
      {
        loading: 'Unsubscribing...',
        success: 'All done! you will no longer receive emails from these mailing lists.',
        error: 'Something went wrong!',
      },
    );
  };

  const onMoveSuccess = useCallback(async () => {
    await mutateThreads();
    await mutateStats();
    setMail({ ...mail, bulkSelected: [] });
  }, [mail, setMail, mutateThreads, mutateStats]);

  return (
    <div className="flex items-center gap-2">
      <button
        className="flex h-8 flex-1 items-center justify-center gap-1 overflow-hidden rounded-md border bg-white px-3 text-sm transition-all duration-300 ease-out hover:bg-gray-100 dark:border-none dark:bg-[#313131] dark:hover:bg-[#313131]/80"
        onClick={() => {
          if (mail.bulkSelected.length === 0) return;
          toast.promise(markAsRead({ ids: mail.bulkSelected }).then(onMoveSuccess), {
            loading: 'Marking as read...',
            success: 'All done! marked as read',
            error: 'Something went wrong!',
          });
        }}
      >
        <div className="relative overflow-visible">
          <Eye className="fill-[#9D9D9D] dark:fill-[#9D9D9D]" />
        </div>
        <div className="flex items-center justify-center gap-2.5">
          <div className="justify-start leading-none">Mark all as read</div>
        </div>
      </button>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="flex aspect-square h-8 items-center justify-center gap-1 overflow-hidden rounded-md border bg-white px-2 text-sm transition-all duration-300 ease-out hover:bg-gray-100 dark:border-none dark:bg-[#313131] dark:hover:bg-[#313131]/80"
            onClick={() => {
              if (mail.bulkSelected.length === 0) return;
              toast.promise(markAsImportant({ ids: mail.bulkSelected }).then(onMoveSuccess), {
                loading: 'Marking as important...',
                success: 'All done! marked as important',
                error: 'Something went wrong!',
              });
            }}
          >
            <div className="relative overflow-visible">
              <Lightning className="fill-[#9D9D9D] dark:fill-[#9D9D9D]" />
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('common.mail.markAsImportant')}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="flex aspect-square h-8 items-center justify-center gap-1 overflow-hidden rounded-md border bg-white px-2 text-sm transition-all duration-300 ease-out hover:bg-gray-100 dark:border-none dark:bg-[#313131] dark:hover:bg-[#313131]/80"
            onClick={() => {
              if (mail.bulkSelected.length === 0) return;
              toast.promise(bulkArchive({ ids: mail.bulkSelected }).then(onMoveSuccess), {
                loading: 'Moving to archive...',
                success: 'All done! moved to archive',
                error: 'Something went wrong!',
              });
            }}
          >
            <div className="relative overflow-visible">
              <Archive2 className="fill-[#9D9D9D]" />
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('common.mail.archive')}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="flex aspect-square h-8 items-center justify-center gap-1 overflow-hidden rounded-md border bg-white px-2 text-sm transition-all duration-300 ease-out hover:bg-gray-100 dark:border-none dark:bg-[#313131] dark:hover:bg-[#313131]/80"
            onClick={() => {
              if (mail.bulkSelected.length === 0) return;
              toast.promise(bulkStar({ ids: mail.bulkSelected }).then(onMoveSuccess), {
                loading: 'Marking as starred...',
                success: 'All done! marked as starred',
                error: 'Something went wrong!',
              });
            }}
          >
            <div className="relative overflow-visible">
              <Star2 className="fill-[#9D9D9D] stroke-[#9D9D9D] dark:stroke-[#9D9D9D]" />
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('common.mail.starAll')}</TooltipContent>
      </Tooltip>

      <Dialog onOpenChange={setIsUnsub} open={isUnsub}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <button className="flex aspect-square h-8 items-center justify-center gap-1 overflow-hidden rounded-md border border-[#FCCDD5] bg-[#FDE4E9] px-2 text-sm transition-all duration-300 ease-out hover:bg-[#FDE4E9]/80 dark:border-[#6E2532] dark:bg-[#411D23] dark:hover:bg-[#313131]/80 hover:dark:bg-[#411D23]/60">
                <div className="relative overflow-visible">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.3}
                    stroke="currentColor"
                    className="size-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636"
                      strokeOpacity={0.6}
                    />
                  </svg>
                </div>
              </button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>{t('common.mail.unSubscribeFromAll')}</TooltipContent>
        </Tooltip>

        <DialogContent
          showOverlay
          className="bg-panelLight dark:bg-panelDark max-w-lg rounded-xl border p-4"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleMassUnsubscribe();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Mass Unsubscribe</DialogTitle>
            <DialogDescription>
              We will remove you from all of the mailing lists in the selected threads. If your
              action is required to unsubscribe from certain threads, you will be notified.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" className="mt-3 h-8" onClick={() => setIsUnsub(false)}>
              <span>Cancel</span>{' '}
            </Button>
            <Button
              className="mt-3 h-8 [&_svg]:size-3.5"
              disabled={isLoading}
              onClick={handleMassUnsubscribe}
            >
              {<span>Unsubscribe</span>}{' '}
              <div className="flex h-5 items-center justify-center gap-1 rounded-sm bg-white/10 px-1 dark:bg-black/10">
                <Command className="h-2 w-3 text-white dark:text-[#929292]" />
                <CurvedArrow className="mt-1.5 h-5 w-3.5 fill-white dark:fill-[#929292]" />
              </div>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="flex aspect-square h-8 items-center justify-center gap-1 overflow-hidden rounded-md border border-[#FCCDD5] bg-[#FDE4E9] px-2 text-sm transition-all duration-300 ease-out hover:bg-[#FDE4E9]/80 dark:border-[#6E2532] dark:bg-[#411D23] dark:hover:bg-[#313131]/80 hover:dark:bg-[#411D23]/60"
            onClick={() => {
              if (mail.bulkSelected.length === 0) return;
              toast.promise(bulkDeleteThread({ ids: mail.bulkSelected }).then(onMoveSuccess), {
                loading: 'Moving to bin...',
                success: 'All done! moved to bin',
                error: 'Something went wrong!',
              });
            }}
          >
            <div className="relative overflow-visible">
              <Trash className="h-4 w-4 text-[#F43F5E] fill-[#F43F5E]" />
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('common.mail.moveToBin')}</TooltipContent>
      </Tooltip>
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
      icon: <Lightning className={cn('fill-white dark:fill-white')} />,
    },
    {
      id: 'All Mail',
      name: 'All Mail',
      searchValue: 'is:inbox',
      icon: <Mail className={cn('fill-white dark:fill-white')} />,
      colors:
        'border-0 bg-[#006FFE] text-white dark:bg-[#006FFE] dark:text-white dark:hover:bg-[#006FFE]/90',
    },
    {
      id: 'Personal',
      name: t('common.mailCategories.personal'),
      searchValue: 'is:personal',
      icon: <User className={cn('fill-white dark:fill-white')} />,
    },
    {
      id: 'Updates',
      name: t('common.mailCategories.updates'),
      searchValue: 'is:updates',
      icon: <Bell className={cn('fill-white dark:fill-white')} />,
    },
    {
      id: 'Promotions',
      name: 'Promotions',
      searchValue: 'is:promotions',
      icon: <Tag className={cn('fill-white dark:fill-white')} />,
    },
    {
      id: 'Unread',
      name: 'Unread',
      searchValue: 'is:unread',
      icon: <ScanEye className={cn('h-4 w-4 fill-white dark:fill-white')} />,
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
    case 'unread':
      return 'bg-[#FF4800]';
    default:
      return 'bg-base-primary-500';
  }
}

function CategorySelect({ isMultiSelectMode }: { isMultiSelectMode: boolean }) {
  const [mail, setMail] = useMail();
  const [searchValue, setSearchValue] = useSearchValue();
  const categories = Categories();
  const params = useParams<{ folder: string }>();
  const folder = params?.folder ?? 'inbox';
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

  const renderCategoryButton = (cat: CategoryType, isOverlay = false, idx?: number) => {
    const isSelected = cat.id === (category || 'Primary');
    const bgColor = getCategoryColor(cat.id);

    return (
      <Tooltip key={cat.id}>
        <TooltipTrigger asChild>
          <button
            ref={!isOverlay ? activeTabElementRef : null}
            onClick={() => {
              setCategory(cat.id);
              setSearchValue({
                value: cat.searchValue || '',
                highlight: searchValue.highlight,
                folder: '',
              });
            }}
            className={cn(
              'flex h-8 items-center justify-center gap-1 overflow-hidden rounded-md border transition-all duration-300 ease-out dark:border-none',
              isSelected
                ? cn('flex-1 border-none px-3 text-white', bgColor)
                : 'w-8 bg-white hover:bg-gray-100 dark:bg-[#313131] dark:hover:bg-[#313131]/80',
            )}
            tabIndex={isOverlay ? -1 : undefined}
          >
            <div className="relative overflow-visible">{cat.icon}</div>
            {isSelected && (
              <div className="flex items-center justify-center gap-2.5 px-0.5">
                <div className="animate-in fade-in-0 slide-in-from-right-4 justify-start text-sm leading-none text-white duration-300">
                  {cat.name}
                </div>
              </div>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align={isSelected ? 'center' : idx === 0 ? 'start' : 'end'}>
          <span>{cat.name}</span>
        </TooltipContent>
      </Tooltip>
    );
  };

  // Update clip path when category changes
  useEffect(() => {
    const container = containerRef.current;
    const activeTabElement = activeTabElementRef.current;

    if (category && container && activeTabElement) {
      setMail({ ...mail, bulkSelected: [] });
      const { offsetLeft, offsetWidth } = activeTabElement;
      const clipLeft = Math.max(0, offsetLeft - 2);
      const clipRight = Math.min(container.offsetWidth, offsetLeft + offsetWidth + 2);
      const containerWidth = container.offsetWidth;

      if (containerWidth) {
        container.style.clipPath = `inset(0 ${Number(100 - (clipRight / containerWidth) * 100).toFixed(2)}% 0 ${Number((clipLeft / containerWidth) * 100).toFixed(2)}%)`;
      }
    }
  }, [category]);

  if (isMultiSelectMode) {
    return <BulkSelectActions />;
  }

  return (
    <div className="relative w-full">
      <div className="flex w-full items-start justify-start gap-2">
        {categories.map((cat, idx) => renderCategoryButton(cat, false, idx))}
      </div>

      <div
        aria-hidden
        className="absolute inset-0 z-10 overflow-hidden transition-[clip-path] duration-300 ease-in-out"
        ref={containerRef}
      >
        <div className="flex w-full items-start justify-start gap-2">
          {categories.map((cat, idx) => renderCategoryButton(cat, true, idx))}
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
  const t = useTranslations();
  const [category] = useQueryState('category', {
    defaultValue: 'Important',
  });
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
                  <div className="relative overflow-visible">{category.icon}</div>
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
                <div className="relative overflow-visible">{category.icon}</div>
                <span className={cn('hidden', !iconsOnly && 'md:inline')}>{category.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
