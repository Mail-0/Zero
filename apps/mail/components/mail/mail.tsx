import {
  Bell,
  Lightning,
  Mail,
  ScanEye,
  Tag,
  User,
  X,
  Search,
  PencilCompose,
} from '../icons/icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCategorySettings, useDefaultCategoryId } from '@/hooks/use-categories';
import { useNavigate, useParams, Link, useLocation } from 'react-router';
import { useCommandPalette } from '../context/command-palette-context';
import { RefreshCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useHotkeys, useHotkeysContext } from 'react-hotkeys-hook';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useActiveConnection } from '@/hooks/use-connections';
import useSearchLabels from '@/hooks/use-labels-search';
import * as CustomIcons from '@/components/icons/icons';
import { MailList } from '@/components/mail/mail-list';
import { navigationConfig } from '@/config/navigation';
import { useMail } from '@/components/mail/use-mail';
import { PricingDialog } from '../ui/pricing-dialog';
import { clearBulkSelectionAtom } from './use-mail';
import AISidebar from '@/components/ui/ai-sidebar';
import { useThreads } from '@/hooks/use-threads';
import { Button } from '@/components/ui/button';
import { useLabels } from '@/hooks/use-labels';
import { useSession } from '@/lib/auth-client';
import { useStats } from '@/hooks/use-stats';
import { m } from '@/paraglide/messages';
import { isMac } from '@/lib/platform';
import { useQueryState } from 'nuqs';
import { cn } from '@/lib/utils';
import { useAtom } from 'jotai';

// const AutoLabelingSettings = () => {
//   const trpc = useTRPC();
//   const [open, setOpen] = useState(false);
//   const { data: storedLabels, refetch: refetchStoredLabels } = useQuery(
//     trpc.brain.getLabels.queryOptions(void 0, {
//       staleTime: 1000 * 60 * 60, // 1 hour
//     }),
//   );
//   const { mutateAsync: updateLabels, isPending } = useMutation(
//     trpc.brain.updateLabels.mutationOptions({
//       onSuccess: () => {
//         refetchStoredLabels();
//       },
//     }),
//   );
//   const [, setPricingDialog] = useQueryState('pricingDialog');
//   const [labels, setLabels] = useState<ITag[]>([]);
//   const [newLabel, setNewLabel] = useState({ name: '', usecase: '' });
//   const { mutateAsync: EnableBrain, isPending: isEnablingBrain } = useMutation(
//     trpc.brain.enableBrain.mutationOptions(),
//   );
//   const { mutateAsync: DisableBrain, isPending: isDisablingBrain } = useMutation(
//     trpc.brain.disableBrain.mutationOptions(),
//   );
//   const { data: brainState, refetch: refetchBrainState } = useBrainState();
//   const { isLoading, isPro } = useBilling();

//   useEffect(() => {
//     if (storedLabels) {
//       setLabels(
//         storedLabels.map((label) => ({
//           id: label.name,
//           name: label.name,
//           text: label.name,
//           usecase: label.usecase,
//         })),
//       );
//     }
//   }, [storedLabels]);

//   const handleResetToDefault = useCallback(() => {
//     setLabels(
//       defaultLabels.map((label) => ({
//         id: label.name,
//         name: label.name,
//         text: label.name,
//         usecase: label.usecase,
//       })),
//     );
//   }, [storedLabels]);

//   const handleAddLabel = () => {
//     if (!newLabel.name || !newLabel.usecase) return;
//     setLabels([...labels, { id: newLabel.name, ...newLabel, text: newLabel.name }]);
//     setNewLabel({ name: '', usecase: '' });
//   };

//   const handleDeleteLabel = (id: string) => {
//     setLabels(labels.filter((label) => label.id !== id));
//   };

//   const handleUpdateLabel = (id: string, field: 'name' | 'usecase', value: string) => {
//     setLabels(
//       labels.map((label) =>
//         label.id === id
//           ? { ...label, [field]: value, text: field === 'name' ? value : label.text }
//           : label,
//       ),
//     );
//   };

//   const handleSubmit = async () => {
//     const updatedLabels = labels.map((label) => ({
//       name: label.name,
//       usecase: label.usecase,
//     }));

//     if (newLabel.name.trim() && newLabel.usecase.trim()) {
//       updatedLabels.push({
//         name: newLabel.name,
//         usecase: newLabel.usecase,
//       });
//     }
//     await updateLabels({ labels: updatedLabels });
//     setOpen(false);
//     toast.success('Labels updated successfully, Zero will start using them.');
//   };

//   const handleEnableBrain = useCallback(async () => {
//     toast.promise(EnableBrain, {
//       loading: 'Enabling autolabeling...',
//       success: 'Autolabeling enabled successfully',
//       error: 'Failed to enable autolabeling',
//       finally: async () => {
//         await refetchBrainState();
//       },
//     });
//   }, []);

//   const handleDisableBrain = useCallback(async () => {
//     toast.promise(DisableBrain, {
//       loading: 'Disabling autolabeling...',
//       success: 'Autolabeling disabled successfully',
//       error: 'Failed to disable autolabeling',
//       finally: async () => {
//         await refetchBrainState();
//       },
//     });
//   }, []);

//   const handleToggleAutolabeling = useCallback(() => {
//     if (brainState?.enabled) {
//       handleDisableBrain();
//     } else {
//       handleEnableBrain();
//     }
//   }, [brainState?.enabled]);

//   return (
//     <Dialog
//       open={open}
//       onOpenChange={(state) => {
//         if (!isPro) {
//           setPricingDialog('true');
//         } else {
//           setOpen(state);
//         }
//       }}
//     >
//       <DialogTrigger asChild>
//         <div className="flex items-center gap-2">
//           <Switch
//             disabled={isEnablingBrain || isDisablingBrain || isLoading}
//             checked={brainState?.enabled ?? false}
//           />
//           <span className="text-muted-foreground cursor-pointer text-xs font-medium">
//             Auto label
//           </span>
//         </div>
//       </DialogTrigger>
//       <DialogContent showOverlay className="max-w-2xl">
//         <DialogHeader>
//           <div className="flex items-center justify-between">
//             <DialogTitle>Label Settings</DialogTitle>
//             <button
//               onClick={handleToggleAutolabeling}
//               className="bg-offsetLight dark:bg-offsetDark flex items-center gap-2 rounded-lg border px-1.5 py-1"
//             >
//               <span className="text-muted-foreground text-sm">
//                 {isEnablingBrain || isDisablingBrain
//                   ? 'Updating...'
//                   : brainState?.enabled
//                     ? 'Disable autolabeling'
//                     : 'Enable autolabeling'}
//               </span>
//               <Switch checked={brainState?.enabled} />
//             </button>
//           </div>
//           <DialogDescription className="mt-2">
//             Configure the labels that Zero uses to automatically organize your emails.
//           </DialogDescription>
//         </DialogHeader>

//         <ScrollArea className="h-[400px]">
//           <div className="space-y-3">
//             {labels.map((label, index) => (
//               <div
//                 key={label.id}
//                 className="bg-card group relative space-y-2 rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md"
//               >
//                 <div className="flex items-center justify-between">
//                   <Label
//                     htmlFor={`label-name-${index}`}
//                     className="text-muted-foreground text-xs font-medium"
//                   >
//                     Label Name
//                   </Label>
//                   <Button
//                     variant="ghost"
//                     size="icon"
//                     className="h-6 w-6 transition-opacity group-hover:opacity-100"
//                     onClick={() => handleDeleteLabel(label.id)}
//                   >
//                     <Trash className="h-3 w-3 fill-[#F43F5E]" />
//                   </Button>
//                 </div>
//                 <Input
//                   id={`label-name-${index}`}
//                   type="text"
//                   value={label.name}
//                   onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
//                     handleUpdateLabel(label.id, 'name', e.target.value)
//                   }
//                   className="h-8"
//                   placeholder="e.g., Important, Follow-up, Archive"
//                 />
//                 <div className="space-y-2">
//                   <Label
//                     htmlFor={`label-usecase-${index}`}
//                     className="text-muted-foreground text-xs font-medium"
//                   >
//                     Use Case Description
//                   </Label>
//                   <Textarea
//                     id={`label-usecase-${index}`}
//                     value={label.usecase}
//                     onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
//                       handleUpdateLabel(label.id, 'usecase', e.target.value)
//                     }
//                     className="min-h-[60px] resize-none"
//                     placeholder="Describe when this label should be applied..."
//                   />
//                 </div>
//               </div>
//             ))}

//             <div className="bg-muted/50 mt-3 space-y-2 rounded-lg border border-dashed p-4">
//               <div className="space-y-2">
//                 <Label
//                   htmlFor="new-label-name"
//                   className="text-muted-foreground text-xs font-medium"
//                 >
//                   New Label Name
//                 </Label>
//                 <Input
//                   id="new-label-name"
//                   type="text"
//                   value={newLabel.name}
//                   onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
//                     setNewLabel({ ...newLabel, name: e.target.value })
//                   }
//                   className="h-8 dark:bg-[#141414]"
//                   placeholder="Enter a new label name"
//                 />
//               </div>
//               <div className="space-y-2">
//                 <Label
//                   htmlFor="new-label-usecase"
//                   className="text-muted-foreground text-xs font-medium"
//                 >
//                   Use Case Description
//                 </Label>
//                 <Textarea
//                   id="new-label-usecase"
//                   value={newLabel.usecase}
//                   onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
//                     setNewLabel({ ...newLabel, usecase: e.target.value })
//                   }
//                   className="min-h-[60px] resize-none dark:bg-[#141414]"
//                   placeholder="Describe when this label should be applied..."
//                 />
//               </div>
//               <Button
//                 className="mt-2 h-8 w-full"
//                 onClick={handleAddLabel}
//                 disabled={!newLabel.name || !newLabel.usecase}
//               >
//                 Add New Label
//               </Button>
//             </div>
//           </div>
//         </ScrollArea>
//         <DialogFooter className="mt-4">
//           <div className="flex w-full justify-end gap-2">
//             <Button size="xs" variant="outline" onClick={handleResetToDefault}>
//               Default Labels
//             </Button>
//             <Button size="xs" onClick={handleSubmit} disabled={isPending}>
//               Save Changes
//             </Button>
//           </div>
//         </DialogFooter>
//       </DialogContent>
//     </Dialog>
//   );
// };

export function MailLayout() {
  const params = useParams<{ folder: string }>();
  const folder = params?.folder ?? 'inbox';
  const [mail, setMail] = useMail();
  const [, clearBulkSelection] = useAtom(clearBulkSelectionAtom);
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();
  const prevFolderRef = useRef(folder);
  const { enableScope, disableScope } = useHotkeysContext();
  const { data: activeConnection } = useActiveConnection();
  const { activeFilters, clearAllFilters } = useCommandPalette();
  const [, setIsCommandPaletteOpen] = useQueryState('isCommandPaletteOpen');

  useEffect(() => {
    if (prevFolderRef.current !== folder && mail.bulkSelected.length > 0) {
      clearBulkSelection();
    }
    prevFolderRef.current = folder;
  }, [folder, mail.bulkSelected.length, clearBulkSelection]);

  useEffect(() => {
    if (!session?.user && !isPending) {
      navigate('/login');
    }
  }, [session?.user, isPending, navigate]);

  const [{ isFetching, refetch: refetchThreads }] = useThreads();

  // Enable mail-list scope since threads are now on their own page
  useEffect(() => {
    enableScope('mail-list');
    return () => {
      disableScope('mail-list');
    };
  }, [enableScope, disableScope]);

  //   const handleMailListMouseEnter = useCallback(() => {
  //     enableScope('mail-list');
  //   }, [enableScope]);

  //   const handleMailListMouseLeave = useCallback(() => {
  //     disableScope('mail-list');
  //   }, [disableScope]);

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
        navigator.registerProtocolHandler('mailto', `/api/mailto-handler?mailto=%s`);
      } catch (error) {
        console.error('Failed to register protocol handler:', error);
      }
    }
  }, []);

  const defaultCategoryId = useDefaultCategoryId();
  const [category] = useQueryState('category', { defaultValue: defaultCategoryId });

  const handleClearFilters = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      clearAllFilters();
    },
    [clearAllFilters],
  );

  const handleExitBulkSelection = useCallback(() => {
    setMail({ ...mail, bulkSelected: [] });
  }, [mail, setMail]);

  const handleRefetchThreads = useCallback(() => {
    refetchThreads();
  }, [refetchThreads]);

  const handleOpenCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen('true');
  }, [setIsCommandPaletteOpen]);

  return (
    <TooltipProvider delayDuration={0}>
      <PricingDialog />
      <div className="rounded-inherit z-5 relative flex p-0 md:mr-0.5 md:mt-1">
        <div className="bg-panelLight dark:bg-panelDark mb-1 w-full max-w-full shadow-sm md:mr-[3px] md:rounded-2xl lg:h-[calc(100dvh-8px)] lg:shadow-sm">
          <div className="w-full max-w-full md:h-[calc(100dvh-10px)]">
            <div className="z-15 sticky top-0 p-4 pb-0">
              <div className="flex items-center gap-2">
                {mail.bulkSelected.length === 0 ? (
                  <>
                    <Button
                      variant="outline"
                      className={cn(
                        'text-muted-foreground border-border/40 bg-background/50 hover:bg-accent/30 focus-visible:ring-ring dark:border-border/20 dark:bg-background/40 relative flex h-10 flex-1 select-none items-center justify-start overflow-hidden rounded-lg border pl-3 text-left text-sm font-normal shadow-none ring-0 backdrop-blur-sm transition-all focus-visible:ring-2 focus-visible:ring-offset-2',
                      )}
                      onClick={handleOpenCommandPalette}
                    >
                      <Search className="fill-muted-foreground h-4 w-4" />

                      <span className="ml-3 hidden truncate pr-20 lg:inline-block">
                        {activeFilters.length > 0
                          ? activeFilters.map((f) => f.display).join(', ')
                          : 'Search'}
                      </span>
                      <span className="ml-3 inline-block truncate pr-20 lg:hidden">
                        {activeFilters.length > 0
                          ? `${activeFilters.length} filter${activeFilters.length > 1 ? 's' : ''}`
                          : 'Search'}
                      </span>

                      <div className="absolute right-2 flex items-center gap-2">
                        {activeFilters.length > 0 && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-6 rounded-md px-2 text-xs"
                            onClick={handleClearFilters}
                          >
                            Clear
                          </Button>
                        )}
                        <kbd className="bg-muted border-border/40 dark:bg-muted/40 pointer-events-none hidden h-6 select-none items-center gap-1 rounded border px-2 text-xs font-medium opacity-80 sm:flex">
                          <span className={cn('text-xs', isMac ? 'text-sm' : 'text-xs')}>
                            {isMac ? '⌘' : 'Ctrl'}
                          </span>
                          <span className="text-xs">K</span>
                        </kbd>
                      </div>
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-between">
                    <div className="text-foreground text-sm font-medium">
                      {mail.bulkSelected.length} selected
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleExitBulkSelection}
                          className="h-8 gap-2 rounded-lg"
                        >
                          <X className="h-3 w-3" />
                          <span className="text-xs">ESC</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{m['common.actions.exitSelectionModeEsc']()}</TooltipContent>
                    </Tooltip>
                  </div>
                )}

                <Button
                  onClick={handleRefetchThreads}
                  variant="ghost"
                  size="icon"
                  className="hover:bg-accent/50 h-10 w-10 rounded-lg border-none bg-transparent backdrop-blur-sm"
                >
                  <RefreshCcw className="text-muted-foreground h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Horizontal Categories Row */}
            {activeConnection && <HorizontalCategories />}

            <div className="px-4 pt-2">
              <div
                className={cn(
                  `${category === 'Important' ? 'bg-[#F59E0D]' : category === 'All Mail' ? 'bg-[#006FFE]' : category === 'Personal' ? 'bg-[#39ae4a]' : category === 'Updates' ? 'bg-[#8B5CF6]' : category === 'Promotions' ? 'bg-[#F43F5E]' : category === 'Unread' ? 'bg-[#FF4800]' : 'bg-[#F59E0D]'}`,
                  'h-0.5 w-full rounded-full transition-opacity',
                  isFetching ? 'opacity-100' : 'opacity-0',
                )}
              />
            </div>

            <div className="z-1 relative h-[calc(100dvh-(2px+2px))] overflow-hidden pt-0 md:h-[calc(100dvh-8rem)]">
              <MailList />
            </div>
          </div>
        </div>

        {activeConnection?.id ? <AISidebar /> : null}
      </div>
    </TooltipProvider>
  );
}

interface CategoryItem {
  id: string;
  name: string;
  searchValue: string;
  icon?: React.ReactNode;
  colors?: string;
}

function HorizontalCategories() {
  const categorySettings = useCategorySettings();
  const { setLabels, labels } = useSearchLabels();
  const [, setIsComposeOpen] = useQueryState('isComposeOpen');
  const { userLabels } = useLabels();
  const { data: activeConnection } = useActiveConnection();
  const location = useLocation();
  const { data: stats } = useStats();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Get navigation items from config
  const navigationItems = navigationConfig.mail.sections.flatMap((section) => section.items);

  // Function to check scroll state
  const checkScrollState = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  }, []);

  // Handle horizontal scrolling with mouse wheel
  const handleWheel = useCallback((e: WheelEvent) => {
    if (scrollContainerRef.current) {
      e.preventDefault();
      const scrollAmount = e.deltaY > 0 ? 300 : -300;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  }, []);

  // Check scroll state on mount and when content changes
  useEffect(() => {
    checkScrollState();
    const handleResize = () => checkScrollState();
    window.addEventListener('resize', handleResize);

    // Add wheel event listener for horizontal scrolling
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (scrollContainer) {
        scrollContainer.removeEventListener('wheel', handleWheel);
      }
    };
  }, [checkScrollState, userLabels, handleWheel]);

  // Scroll functions
  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  // Get badge count for navigation items
  const getBadgeCount = (itemId: string) => {
    if (!stats) return 0;
    const folderMap: Record<string, string> = {
      inbox: 'inbox',
      sent: 'sent',
      drafts: 'draft',
      archive: 'archive',
      spam: 'spam',
      trash: 'bin',
      snoozed: 'snoozed',
    };
    const folderName = folderMap[itemId];
    return stats.find((stat) => stat.label?.toLowerCase() === folderName)?.count ?? 0;
  };

  useHotkeys(
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    (key) => {
      const category = categorySettings[Number(key.key) - 1];
      if (!category) return;
      const isCurrentlyActive = labels.includes(category.searchValue);

      if (isCurrentlyActive) {
        setLabels(labels.filter((label) => label !== category.searchValue));
      } else {
        setLabels([...labels, category.searchValue]);
      }
    },
    {
      scopes: ['mail-list'],
      preventDefault: true,
      enableOnFormTags: false,
    },
  );

  const handleLabelChange = (searchValue: string) => {
    const trimmed = searchValue.trim();
    if (!trimmed) {
      setLabels([]);
      return;
    }

    const parsedLabels = trimmed
      .split(',')
      .map((label) => label.trim())
      .filter((label) => label.length > 0);

    if (parsedLabels.length === 0) {
      setLabels([]);
      return;
    }

    const currentLabelsSet = new Set(labels);
    const parsedLabelsSet = new Set(parsedLabels);

    const allLabelsSelected = parsedLabels.every((label) => currentLabelsSet.has(label));

    if (allLabelsSelected) {
      const updatedLabels = labels.filter((label) => !parsedLabelsSet.has(label));
      setLabels(updatedLabels);
    } else {
      const newLabelsSet = new Set([...labels, ...parsedLabels]);
      setLabels(Array.from(newLabelsSet));
    }
  };

  const handleComposeClick = () => {
    setIsComposeOpen('true');
  };

  const handleLabelClick = (labelName: string) => {
    const isCurrentlyActive = labels.includes(`label:${labelName}`);

    if (isCurrentlyActive) {
      setLabels(labels.filter((label) => label !== `label:${labelName}`));
    } else {
      setLabels([...labels, `label:${labelName}`]);
    }
  };

  return (
    <div className="relative my-2 w-full px-4">
      {/* Left scroll arrow */}
      {canScrollLeft && (
        <Button
          variant="ghost"
          size="sm"
          className="bg-background/80 absolute left-2 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full p-0 shadow-sm backdrop-blur-sm"
          onClick={scrollLeft}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      {/* Right scroll arrow */}
      {canScrollRight && (
        <Button
          variant="ghost"
          size="sm"
          className="bg-background/80 absolute right-2 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full p-0 shadow-sm backdrop-blur-sm"
          onClick={scrollRight}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      {/* Scrollable content */}
      <div
        ref={scrollContainerRef}
        className="scrollbar-none flex w-full gap-2 overflow-x-auto"
        onScroll={checkScrollState}
        style={{ maxWidth: '100%', minWidth: 0 }}
      >
        <button
          onClick={handleComposeClick}
          className="flex h-8 shrink-0 items-center gap-2 rounded-lg bg-[#006FFE] px-4 text-sm font-medium text-white transition-all hover:bg-[#0056CC]"
        >
          <PencilCompose className="h-3.5 w-3.5 fill-white" />
          <span className="whitespace-nowrap">New Email</span>
        </button>

        {/* Navigation buttons */}
        {navigationItems.map((item) => {
          const isActive = location.pathname === item.url;
          const badgeCount = getBadgeCount(item.id || '');
          const IconComponent = item.icon;

          return (
            <Link
              key={item.url}
              to={item.url}
              className={cn(
                'text-muted-foreground border-border/40 bg-background/50 hover:bg-accent/30 dark:border-border/20 dark:bg-background/40 flex h-8 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium backdrop-blur-sm transition-all',
                isActive && 'bg-primary text-primary-foreground border-primary',
              )}
            >
              <IconComponent className={cn('h-3.5 w-3.5', isActive && 'fill-primary-foreground')} />
              <span className="whitespace-nowrap">{item.title}</span>
              {badgeCount > 0 && (
                <span className="bg-primary text-primary-foreground ml-1 rounded-full px-1.5 py-0.5 text-xs font-medium">
                  {badgeCount}
                </span>
              )}
            </Link>
          );
        })}
        {categorySettings.map((category) => {
          const isActive =
            category.searchValue === ''
              ? labels.length === 0
              : category.searchValue.split(',').some((val) => labels.includes(val));

          return (
            <button
              key={category.id}
              onClick={() => handleLabelChange(category.searchValue)}
              className={cn(
                'text-muted-foreground border-border/40 bg-background/50 hover:bg-accent/30 dark:border-border/20 dark:bg-background/40 flex h-8 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium backdrop-blur-sm transition-all',
                isActive && 'bg-primary text-primary-foreground border-primary',
              )}
            >
              <span className="whitespace-nowrap">{category.name}</span>
            </button>
          );
        })}

        {/* User Labels */}
        {activeConnection && userLabels && userLabels.length > 0 && (
          <>
            <div className="border-border/40 bg-border/40 mx-2 h-6 w-px" />
            {userLabels.slice(0, 10).map((label) => {
              const isActive = labels.includes(`label:${label.name}`);

              return (
                <button
                  key={label.id}
                  onClick={() => handleLabelClick(label.name)}
                  className={cn(
                    'text-muted-foreground border-border/40 bg-background/50 hover:bg-accent/30 dark:border-border/20 dark:bg-background/40 flex h-8 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium backdrop-blur-sm transition-all',
                    isActive &&
                      !label.color?.backgroundColor &&
                      'bg-primary text-primary-foreground border-primary',
                  )}
                  style={{
                    backgroundColor:
                      isActive && label.color?.backgroundColor
                        ? label.color.backgroundColor
                        : undefined,
                    color: isActive && label.color?.textColor ? label.color.textColor : undefined,
                  }}
                >
                  <span className="whitespace-nowrap">{label.name}</span>
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

export const Categories = () => {
  const defaultCategoryIdInner = useDefaultCategoryId();
  const categorySettings = useCategorySettings();
  const [activeCategory] = useQueryState('category', {
    defaultValue: defaultCategoryIdInner,
  });

  const categories = categorySettings.map((cat) => {
    const base = {
      id: cat.id,
      name: (() => {
        const key = `common.mailCategories.${cat.id
          .split(' ')
          .map((w, i) => (i === 0 ? w.toLowerCase() : w))
          .join('')}` as keyof typeof m;
        return m[key] && typeof m[key] === 'function' ? (m[key] as () => string)() : cat.name;
      })(),
      searchValue: cat.searchValue,
    } as const;

    // Helper to decide fill colour depending on selection
    const isSelected = activeCategory === cat.id;
    if (cat.icon && cat.icon in CustomIcons) {
      const DynamicIcon = CustomIcons[cat.icon as keyof typeof CustomIcons];
      return {
        ...base,
        icon: (
          <DynamicIcon
            className={cn(
              'fill-muted-foreground h-4 w-4 dark:fill-white',
              isSelected && 'fill-white',
            )}
          />
        ),
      };
    }

    switch (cat.id) {
      case 'Important':
        return {
          ...base,
          icon: (
            <Lightning
              className={cn('fill-muted-foreground dark:fill-white', isSelected && 'fill-white')}
            />
          ),
        };
      case 'All Mail':
        return {
          ...base,
          icon: (
            <Mail
              className={cn('fill-muted-foreground dark:fill-white', isSelected && 'fill-white')}
            />
          ),
          colors:
            'border-0 bg-[#006FFE] text-white dark:bg-[#006FFE] dark:text-white dark:hover:bg-[#006FFE]/90',
        };
      case 'Personal':
        return {
          ...base,
          icon: (
            <User
              className={cn('fill-muted-foreground dark:fill-white', isSelected && 'fill-white')}
            />
          ),
        };
      case 'Promotions':
        return {
          ...base,
          icon: (
            <Tag
              className={cn('fill-muted-foreground dark:fill-white', isSelected && 'fill-white')}
            />
          ),
        };
      case 'Updates':
        return {
          ...base,
          icon: (
            <Bell
              className={cn('fill-muted-foreground dark:fill-white', isSelected && 'fill-white')}
            />
          ),
        };
      case 'Unread':
        return {
          ...base,
          icon: (
            <ScanEye
              className={cn(
                'fill-muted-foreground h-4 w-4 dark:fill-white',
                isSelected && 'fill-white',
              )}
            />
          ),
        };
      default:
        return base;
    }
  });

  return categories as CategoryItem[];
};
