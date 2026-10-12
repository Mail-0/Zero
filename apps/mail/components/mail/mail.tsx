// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
//   DialogTrigger,
// } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Bell, Lightning, Mail, ScanEye, Tag, User, X, Search } from '../icons/icons';
import {
  buildCategorySearchValue,
  parseCategoryIds,
  serializeCategoryIds,
  toggleCategoryId,
  useCategorySettings,
  useDefaultCategoryId,
} from '@/hooks/use-categories';
import { ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useCommandPalette } from '../context/command-palette-context';
import { useCallback, useEffect, useRef } from 'react';

import { ThreadDisplay } from '@/components/mail/thread-display';
import { useActiveConnection } from '@/hooks/use-connections';
// import { useMutation, useQuery } from '@tanstack/react-query';
// import { useTRPC } from '@/providers/query-provider';

import { useMediaQuery } from '../../hooks/use-media-query';

import { ZenNavigation, ZenBulkActions, ZenFolderSelect, ZenComposeButton } from './zen-navigation';
import { useSearchValue } from '@/hooks/use-search-value';
import * as CustomIcons from '@/components/icons/icons';
import { isMac } from '@/lib/hotkeys/use-hotkey-utils';
import { MailList } from '@/components/mail/mail-list';
import { useHotkeysContext } from 'react-hotkeys-hook';
// import SelectAllCheckbox from './select-all-checkbox';
import { useNavigate, useParams } from 'react-router';
import { useMail } from '@/components/mail/use-mail';
import { PricingDialog } from '../ui/pricing-dialog';
// import { Textarea } from '@/components/ui/textarea';
// import { useBrainState } from '@/hooks/use-summary';
import { clearBulkSelectionAtom } from './use-mail';
import AISidebar from '@/components/ui/ai-sidebar';
// import { useBilling } from '@/hooks/use-billing';
import AIToggleButton from '../ai-toggle-button';
import { useIsMobile } from '@/hooks/use-mobile';
// import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';
// import { ScrollArea } from '../ui/scroll-area';
// import { Label } from '@/components/ui/label';
// import { Input } from '@/components/ui/input';

import { cn } from '@/lib/utils';

import { m } from '@/paraglide/messages';
import { useQueryState } from 'nuqs';
import { useAtom } from 'jotai';
// import { toast } from 'sonner';

// interface ITag {
//   id: string;
//   name: string;
//   usecase: string;
//   text: string;
// }

export const defaultLabels = [
  {
    name: 'to respond',
    usecase: 'emails you need to respond to. NOT sales, marketing, or promotions.',
  },
  {
    name: 'FYI',
    usecase:
      'emails that are not important, but you should know about. NOT sales, marketing, or promotions.',
  },
  {
    name: 'comment',
    usecase:
      'Team chats in tools like Google Docs, Slack, etc. NOT marketing, sales, or promotions.',
  },
  {
    name: 'notification',
    usecase: 'Automated updates from services you use. NOT sales, marketing, or promotions.',
  },
  {
    name: 'promotion',
    usecase: 'Sales, marketing, cold emails, special offers or promotions. NOT to respond to.',
  },
  {
    name: 'meeting',
    usecase: 'Calendar events, invites, etc. NOT sales, marketing, or promotions.',
  },
  {
    name: 'billing',
    usecase: 'Billing notifications. NOT sales, marketing, or promotions.',
  },
];

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
  const isMobile = useIsMobile();
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
  }, [session?.user, isPending]);

  const isDesktop = useMediaQuery('(min-width: 768px)');

  const [threadId] = useQueryState('threadId');

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

  const handleMailListMouseEnter = useCallback(() => {
    enableScope('mail-list');
  }, [enableScope]);

  const handleMailListMouseLeave = useCallback(() => {
    disableScope('mail-list');
  }, [disableScope]);

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

  return (
    <TooltipProvider delayDuration={0}>
      <PricingDialog />
      <div className="rounded-inherit relative z-5 flex p-0 md:mr-0.5">
        <ResizablePanelGroup
          direction="horizontal"
          className={cn('rounded-inherit relative overflow-hidden', threadId && 'bg-sidebar')}
        >
          <ResizablePanel
              defaultSize={100}
              minSize={30}
              className={cn(
                'bg-panelLight dark:bg-panelDark h-dvh min-w-0 md:rounded-2xl',
                threadId && 'pointer-events-none absolute inset-0 -z-10 opacity-0',
              )}
              inert={!!threadId}
              onMouseEnter={handleMailListMouseEnter}
              onMouseLeave={handleMailListMouseLeave}
            >
              <div className="flex h-full w-full flex-col">
                <div
                  className={cn(
                    'sticky top-0 z-15 flex items-center justify-between gap-1.5 p-2 pb-0 transition-colors',
                  )}
                >
                  <div className="w-full">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 md:grid md:grid-cols-[1fr_auto_1fr]">
                      <ZenNavigation />
                      <ZenCategories
                        showCategories={
                          mail.bulkSelected.length === 0 &&
                          activeConnection?.providerId === 'google' &&
                          folder === 'inbox'
                        }
                      />
                      {mail.bulkSelected.length === 0 ? (
                        <div className="flex w-full min-w-0 basis-full gap-2 md:max-w-md md:basis-auto md:justify-self-end">
                          <Button
                            variant="outline"
                            className={cn(
                              'text-muted-foreground relative flex h-8 w-full items-center justify-start overflow-hidden rounded-lg border bg-white pl-2 text-left text-sm font-normal shadow-none ring-0 select-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:border-none dark:bg-[#141414]',
                            )}
                            onClick={() => setIsCommandPaletteOpen('true')}
                          >
                            <Search className="fill-[#71717A] dark:fill-[#6F6F6F]" />

                            <span className="hidden truncate pr-20 lg:inline-block">
                              {activeFilters.length > 0
                                ? activeFilters.map((f) => f.display).join(', ')
                                : 'Search'}
                            </span>
                            <span className="inline-block truncate pr-20 lg:hidden">
                              {activeFilters.length > 0
                                ? `${activeFilters.length} filter${activeFilters.length > 1 ? 's' : ''}`
                                : 'Search'}
                            </span>

                            <span className="absolute right-[0rem] flex items-center gap-1">
                              {/* {activeFilters.length > 0 && (
                            <Badge variant="secondary" className="ml-2 h-5 rounded px-1">
                              {activeFilters.length}
                            </Badge>
                          )} */}
                              {activeFilters.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="my-auto h-5 rounded-xl px-1.5 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    clearAllFilters();
                                  }}
                                >
                                  Clear
                                </Button>
                              )}
                              <kbd className="bg-muted text-md pointer-events-none mr-0.5 hidden h-7 flex-row items-center gap-1 rounded-md border-none px-2 leading-[0]! font-medium opacity-100 select-none sm:flex dark:bg-[#262626] dark:text-[#929292]">
                                <span
                                  className={cn(
                                    'h-min leading-[0.2]!',
                                    isMac ? 'mt-px text-lg' : 'text-sm',
                                  )}
                                >
                                  {isMac ? '⌘' : 'Ctrl'}{' '}
                                </span>
                                <span className="h-min text-sm leading-[0.2]!"> K</span>
                              </kbd>
                            </span>
                          </Button>
                        </div>
                      ) : null}
                      {mail.bulkSelected.length > 0 ? (
                        <div className="flex items-center gap-2 md:justify-self-end">
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
                              {m['common.actions.exitSelectionModeEsc']()}
                            </TooltipContent>
                          </Tooltip>
                          <ZenBulkActions />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="relative z-1 min-h-0 flex-1 overflow-hidden pt-0">
                  <MailList />
                </div>
              </div>
          </ResizablePanel>

          {/* <ResizableHandle className="mr-0.5 hidden opacity-0 md:block" /> */}

          {isDesktop && threadId && (
            <ResizablePanel
              className={cn('bg-sidebar relative z-10 h-dvh min-w-0')}
              defaultSize={100}
              minSize={30}
            >
              <div className="relative h-full flex-1">
                <ThreadDisplay />
              </div>
            </ResizablePanel>
          )}

          {/* Mobile Thread View */}
          {isMobile && threadId && (
            <div className="bg-panelLight dark:bg-panelDark fixed inset-0 z-50">
              <div className="flex h-full flex-col">
                <div className="h-full overflow-y-auto outline-none">
                  <ThreadDisplay />
                </div>
              </div>
            </div>
          )}

          {activeConnection?.id ? <AISidebar /> : null}
          {activeConnection?.id ? <AIToggleButton /> : null}
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  );
}

function ZenCategories({ showCategories }: { showCategories: boolean }) {
  const categories = useMailCategories();
  const defaultCategoryId = useDefaultCategoryId();
  const [category, setCategory] = useQueryState('category', { defaultValue: defaultCategoryId });
  const selectedIds = parseCategoryIds(category);
  const [, setSearchValue] = useSearchValue();
  const categoryColors: Record<string, string> = {
    Important: 'bg-[#8B5CF6]',
    Personal: 'bg-[#39ae4a]',
    Promotions: 'bg-[#F43F5E]',
    Updates: 'bg-[#F59E0D]',
    Unread: 'bg-[#FF4800]',
  };

  return (
    <div className="bg-muted flex shrink-0 items-center gap-0.5 rounded-lg p-0.5 md:justify-self-center">
      <ZenComposeButton />
      <div className="bg-border mx-1 h-4 w-px" />
      <ZenFolderSelect />
      {showCategories && <div className="bg-border mx-1 h-4 w-px" />}
      {showCategories &&
        categories.map((item) => (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <button
                aria-label={item.name}
                aria-pressed={selectedIds.includes(item.id)}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md',
                  selectedIds.includes(item.id) && [
                    categoryColors[item.id] ?? 'bg-[#006FFE]',
                    '[&_svg]:fill-white',
                  ],
                )}
                onClick={() => {
                  const next = toggleCategoryId(selectedIds, item.id);
                  setCategory(serializeCategoryIds(next));
                  setSearchValue({
                    value: buildCategorySearchValue(next, categories),
                    highlight: '',
                    folder: '',
                  });
                }}
              >
                {item.icon}
              </button>
            </TooltipTrigger>
            <TooltipContent>{item.name}</TooltipContent>
          </Tooltip>
        ))}
    </div>
  );
}

export const useMailCategories = () => {
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
    const isSelected = parseCategoryIds(activeCategory).includes(cat.id);
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
        return { ...base, icon: null };
    }
  });

  return categories;
};
