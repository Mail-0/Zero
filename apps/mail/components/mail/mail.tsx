import {
  Archive2,
  Bell,
  CurvedArrow,
  Eye,
  Lightning,
  Mail,
  ScanEye,
  Star2,
  Tag,
  Trash,
  User,
  X,
  Search,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useCategorySettings, useDefaultCategoryId } from '@/hooks/use-categories';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useActiveConnection, useConnections } from '@/hooks/use-connections';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCommandPalette } from '../context/command-palette-context';
import { useOptimisticActions } from '@/hooks/use-optimistic-actions';
import { ThreadDisplay } from '@/components/mail/thread-display';
import { trpcClient, useTRPC } from '@/providers/query-provider';
import { backgroundQueueAtom } from '@/store/backgroundQueue';
import { handleUnsubscribe } from '@/lib/email-utils.client';
import { useMediaQuery } from '../../hooks/use-media-query';
import { useSearchValue } from '@/hooks/use-search-value';
import * as CustomIcons from '@/components/icons/icons';
import { isMac } from '@/lib/hotkeys/use-hotkey-utils';
import { MailList } from '@/components/mail/mail-list';
import { useHotkeysContext } from 'react-hotkeys-hook';
import SelectAllCheckbox from './select-all-checkbox';
import { useNavigate, useParams } from 'react-router';
import { useMail } from '@/components/mail/use-mail';
import { SidebarToggle } from '../ui/sidebar-toggle';
import { PricingDialog } from '../ui/pricing-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useBrainState } from '@/hooks/use-summary';
import { clearBulkSelectionAtom } from './use-mail';
import AISidebar from '@/components/ui/ai-sidebar';
import { Command, RefreshCcw } from 'lucide-react';
import { cleanSearchValue, cn } from '@/lib/utils';
import { useThreads } from '@/hooks/use-threads';
import { useBilling } from '@/hooks/use-billing';
import AIToggleButton from '../ai-toggle-button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';
import { ScrollArea } from '../ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useStats } from '@/hooks/use-stats';
import type { IConnection } from '@/types';
import { m } from '@/paraglide/messages';
import { useQueryState } from 'nuqs';
import { useAtom } from 'jotai';
import { toast } from 'sonner';

interface ITag {
  id: string;
  name: string;
  usecase: string;
  text: string;
}

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

const AutoLabelingSettings = () => {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const { data: storedLabels } = useQuery(trpc.brain.getLabels.queryOptions());
  const { mutateAsync: updateLabels, isPending } = useMutation(
    trpc.brain.updateLabels.mutationOptions(),
  );
  const [, setPricingDialog] = useQueryState('pricingDialog');
  const [labels, setLabels] = useState<ITag[]>([]);
  const [newLabel, setNewLabel] = useState({ name: '', usecase: '' });
  const { mutateAsync: EnableBrain, isPending: isEnablingBrain } = useMutation(
    trpc.brain.enableBrain.mutationOptions(),
  );
  const { mutateAsync: DisableBrain, isPending: isDisablingBrain } = useMutation(
    trpc.brain.disableBrain.mutationOptions(),
  );
  const { data: brainState, refetch: refetchBrainState } = useBrainState();
  const { isLoading, isPro } = useBilling();

  useEffect(() => {
    if (storedLabels) {
      setLabels(
        storedLabels.map((label) => ({
          id: label.name,
          name: label.name,
          text: label.name,
          usecase: label.usecase,
        })),
      );
    }
  }, [storedLabels]);

  const handleResetToDefault = useCallback(() => {
    setLabels(
      defaultLabels.map((label) => ({
        id: label.name,
        name: label.name,
        text: label.name,
        usecase: label.usecase,
      })),
    );
  }, [storedLabels]);

  const handleAddLabel = () => {
    if (!newLabel.name || !newLabel.usecase) return;
    setLabels([...labels, { id: newLabel.name, ...newLabel, text: newLabel.name }]);
    setNewLabel({ name: '', usecase: '' });
  };

  const handleDeleteLabel = (id: string) => {
    setLabels(labels.filter((label) => label.id !== id));
  };

  const handleUpdateLabel = (id: string, field: 'name' | 'usecase', value: string) => {
    setLabels(
      labels.map((label) =>
        label.id === id
          ? { ...label, [field]: value, text: field === 'name' ? value : label.text }
          : label,
      ),
    );
  };

  const handleSubmit = async () => {
    const updatedLabels = labels.map((label) => ({
      name: label.name,
      usecase: label.usecase,
    }));

    if (newLabel.name.trim() && newLabel.usecase.trim()) {
      updatedLabels.push({
        name: newLabel.name,
        usecase: newLabel.usecase,
      });
    }
    await updateLabels({ labels: updatedLabels });
    setOpen(false);
    toast.success('Labels updated successfully, Zero will start using them.');
  };

  const handleEnableBrain = useCallback(async () => {
    toast.promise(EnableBrain, {
      loading: 'Enabling autolabeling...',
      success: 'Autolabeling enabled successfully',
      error: 'Failed to enable autolabeling',
      finally: async () => {
        await refetchBrainState();
      },
    });
  }, []);

  const handleDisableBrain = useCallback(async () => {
    toast.promise(DisableBrain, {
      loading: 'Disabling autolabeling...',
      success: 'Autolabeling disabled successfully',
      error: 'Failed to disable autolabeling',
      finally: async () => {
        await refetchBrainState();
      },
    });
  }, []);

  const handleToggleAutolabeling = useCallback(() => {
    if (brainState?.enabled) {
      handleDisableBrain();
    } else {
      handleEnableBrain();
    }
  }, [brainState?.enabled]);

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        if (!isPro) {
          setPricingDialog('true');
        } else {
          setOpen(state);
        }
      }}
    >
      <DialogTrigger asChild>
        <div className="flex items-center gap-2">
          <Switch
            disabled={isEnablingBrain || isDisablingBrain || isLoading}
            checked={brainState?.enabled ?? false}
          />
          <span className="text-muted-foreground cursor-pointer text-xs font-medium">
            Auto label
          </span>
        </div>
      </DialogTrigger>
      <DialogContent showOverlay className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Label Settings</DialogTitle>
            <button
              onClick={handleToggleAutolabeling}
              className="bg-offsetLight dark:bg-offsetDark flex items-center gap-2 rounded-lg border px-1.5 py-1"
            >
              <span className="text-muted-foreground text-sm">
                {isEnablingBrain || isDisablingBrain
                  ? 'Updating...'
                  : brainState?.enabled
                    ? 'Disable autolabeling'
                    : 'Enable autolabeling'}
              </span>
              <Switch checked={brainState?.enabled} />
            </button>
          </div>
          <DialogDescription className="mt-2">
            Configure the labels that Zero uses to automatically organize your emails.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {labels.map((label, index) => (
              <div
                key={label.id}
                className="bg-card group relative space-y-2 rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor={`label-name-${index}`}
                    className="text-muted-foreground text-xs font-medium"
                  >
                    Label Name
                  </Label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 transition-opacity group-hover:opacity-100"
                    onClick={() => handleDeleteLabel(label.id)}
                  >
                    <Trash className="h-3 w-3 fill-[#F43F5E]" />
                  </Button>
                </div>
                <Input
                  id={`label-name-${index}`}
                  type="text"
                  value={label.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleUpdateLabel(label.id, 'name', e.target.value)
                  }
                  className="h-8"
                  placeholder="e.g., Important, Follow-up, Archive"
                />
                <div className="space-y-2">
                  <Label
                    htmlFor={`label-usecase-${index}`}
                    className="text-muted-foreground text-xs font-medium"
                  >
                    Use Case Description
                  </Label>
                  <Textarea
                    id={`label-usecase-${index}`}
                    value={label.usecase}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      handleUpdateLabel(label.id, 'usecase', e.target.value)
                    }
                    className="min-h-[60px] resize-none"
                    placeholder="Describe when this label should be applied..."
                  />
                </div>
              </div>
            ))}

            <div className="bg-muted/50 mt-3 space-y-2 rounded-lg border border-dashed p-4">
              <div className="space-y-2">
                <Label
                  htmlFor="new-label-name"
                  className="text-muted-foreground text-xs font-medium"
                >
                  New Label Name
                </Label>
                <Input
                  id="new-label-name"
                  type="text"
                  value={newLabel.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setNewLabel({ ...newLabel, name: e.target.value })
                  }
                  className="h-8 dark:bg-[#141414]"
                  placeholder="Enter a new label name"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="new-label-usecase"
                  className="text-muted-foreground text-xs font-medium"
                >
                  Use Case Description
                </Label>
                <Textarea
                  id="new-label-usecase"
                  value={newLabel.usecase}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setNewLabel({ ...newLabel, usecase: e.target.value })
                  }
                  className="min-h-[60px] resize-none dark:bg-[#141414]"
                  placeholder="Describe when this label should be applied..."
                />
              </div>
              <Button
                className="mt-2 h-8 w-full"
                onClick={handleAddLabel}
                disabled={!newLabel.name || !newLabel.usecase}
              >
                Add New Label
              </Button>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="mt-4">
          <div className="flex w-full justify-end gap-2">
            <Button size="xs" variant="outline" onClick={handleResetToDefault}>
              Default Labels
            </Button>
            <Button size="xs" onClick={handleSubmit} disabled={isPending}>
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export function MailLayout() {
  const params = useParams<{ folder: string }>();
  const folder = params?.folder ?? 'inbox';
  const [mail, setMail] = useMail();
  const [, clearBulkSelection] = useAtom(clearBulkSelectionAtom);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();
  const { data: connections } = useConnections();
  const prevFolderRef = useRef(folder);
  const { enableScope, disableScope } = useHotkeysContext();
  const { data: activeConnection } = useActiveConnection();
  const { activeFilters, clearAllFilters } = useCommandPalette();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useQueryState('isCommandPaletteOpen');

  const { data: activeAccount } = useActiveConnection();

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

  const [{ isFetching, refetch: refetchThreads }] = useThreads();
  const isDesktop = useMediaQuery('(min-width: 768px)');

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

  const handleMailListMouseEnter = useCallback(() => {
    enableScope('mail-list');
  }, [enableScope]);

  const handleMailListMouseLeave = useCallback(() => {
    disableScope('mail-list');
  }, [disableScope]);

  const [, setActiveReplyId] = useQueryState('activeReplyId');

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
  const [category, setCategory] = useQueryState('category', { defaultValue: defaultCategoryId });

  return (
    <TooltipProvider delayDuration={0}>
      <PricingDialog />
      <div className="rounded-inherit relative z-[5] flex p-0 md:mr-0.5 md:mt-1">
        <ResizablePanelGroup
          direction="horizontal"
          autoSaveId="mail-panel-layout"
          className="rounded-inherit overflow-hidden"
        >
          <ResizablePanel
            defaultSize={35}
            minSize={35}
            maxSize={35}
            className={cn(
              `bg-panelLight dark:bg-panelDark mb-1 mr-[3px] w-fit shadow-sm md:rounded-2xl lg:flex lg:h-[calc(100dvh-8px)] lg:shadow-sm`,
              isDesktop && threadId && 'hidden lg:block',
            )}
            onMouseEnter={handleMailListMouseEnter}
            onMouseLeave={handleMailListMouseLeave}
          >
            <div className="w-full md:h-[calc(100dvh-10px)]">
              <div
                className={cn(
                  'sticky top-0 z-[15] flex items-center justify-between gap-1.5 p-2 px-[20px] transition-colors md:min-h-14',
                )}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <div>
                    <SidebarToggle className="h-fit px-2" />
                    <SelectAllCheckbox className="ml-2" />
                  </div>

                  <div className="flex items-center gap-2">
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
                              {m['common.actions.exitSelectionModeEsc']()}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      ) : null}
                    </div>
                    <AutoLabelingSettings />
                    <div className="dark:bg-iconDark/20 relative ml-2 h-3 w-0.5 rounded-full bg-[#E7E7E7]" />{' '}
                    <Button
                      onClick={() => {
                        refetchThreads();
                      }}
                      variant="ghost"
                      className="md:h-fit md:px-2"
                    >
                      <RefreshCcw className="text-muted-foreground h-4 w-4 cursor-pointer" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="p-2 px-[22px]">
                <Button
                  variant="outline"
                  className={cn(
                    'text-muted-foreground relative flex h-8 w-full select-none items-center justify-start overflow-hidden rounded-lg border bg-white pl-2 text-left text-sm font-normal shadow-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:border-none dark:bg-[#141414]',
                  )}
                  onClick={() => setIsCommandPaletteOpen('true')}
                >
                  <Search className="fill-[#71717A] dark:fill-[#6F6F6F]" />

                  <span className="hidden truncate pr-20 lg:inline-block">
                    {activeFilters.length > 0
                      ? activeFilters.map((f) => f.display).join(', ')
                      : 'Search & Filter'}
                  </span>
                  <span className="inline-block truncate pr-20 lg:hidden">
                    {activeFilters.length > 0
                      ? `${activeFilters.length} filter${activeFilters.length > 1 ? 's' : ''}`
                      : 'Search...'}
                  </span>

                  <span className="absolute right-[0.1rem] flex items-center gap-1">
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
                    <kbd className="bg-muted text-md pointer-events-none hidden h-7 select-none flex-row items-center gap-1 rounded-md border-none px-2 font-medium !leading-[0] opacity-100 sm:flex dark:bg-[#262626] dark:text-[#929292]">
                      <span
                        className={cn(
                          'h-min !leading-[0.2]',
                          isMac ? 'mt-[1px] text-lg' : 'text-sm',
                        )}
                      >
                        {isMac ? '⌘' : 'Ctrl'}{' '}
                      </span>
                      <span className="h-min text-sm !leading-[0.2]"> K</span>
                    </kbd>
                  </span>
                </Button>
                {/* <div className="mt-2">
                  {activeAccount?.providerId === 'google' && folder === 'inbox' && (
                    <CategorySelect isMultiSelectMode={mail.bulkSelected.length > 0} />
                  )}
                </div> */}
              </div>
              <div
                className={cn(
                  `${category === 'Important' ? 'bg-[#F59E0D]' : category === 'All Mail' ? 'bg-[#006FFE]' : category === 'Personal' ? 'bg-[#39ae4a]' : category === 'Updates' ? 'bg-[#8B5CF6]' : category === 'Promotions' ? 'bg-[#F43F5E]' : category === 'Unread' ? 'bg-[#FF4800]' : 'bg-[#F59E0D]'}`,
                  'relative bottom-0.5 z-[5] h-0.5 w-full transition-opacity',
                  isFetching ? 'opacity-100' : 'opacity-0',
                )}
              />
              <div className="relative z-[1] h-[calc(100dvh-(2px+88px+49px+2px))] overflow-hidden pt-0 md:h-[calc(100dvh-7rem)]">
                <MailList />
              </div>
            </div>
          </ResizablePanel>

          {/* <ResizableHandle className="mr-0.5 hidden opacity-0 md:block" /> */}

          {isDesktop && (
            <ResizablePanel
              className={cn(
                'bg-panelLight dark:bg-panelDark mb-1 mr-0.5 w-fit rounded-2xl shadow-sm lg:h-[calc(100dvh-8px)]',
                // Only show on md screens and larger when there is a threadId
                !threadId && 'hidden lg:block',
              )}
              defaultSize={30}
              minSize={30}
            >
              <div className="relative flex-1">
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

          <AISidebar />
          <AIToggleButton />
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  );
}

function BulkSelectActions() {
  const [isLoading, setIsLoading] = useState(false);
  const [isUnsub, setIsUnsub] = useState(false);
  const [mail, setMail] = useMail();
  const params = useParams<{ folder: string }>();
  const folder = params?.folder ?? 'inbox';
  const [{ refetch: refetchThreads }] = useThreads();
  const { refetch: refetchStats } = useStats();
  const {
    optimisticMarkAsRead,
    optimisticToggleStar,
    optimisticMoveThreadsTo,
    optimisticDeleteThreads,
  } = useOptimisticActions();

  const handleMassUnsubscribe = async () => {
    setIsLoading(true);
    toast.promise(
      Promise.all(
        mail.bulkSelected.filter(Boolean).map(async (bulkSelected) => {
          await new Promise((resolve) => setTimeout(resolve, 499));
          const emailData = await trpcClient.mail.get.query({ id: bulkSelected });
          if (emailData) {
            const firstEmail = emailData.latest;
            if (firstEmail)
              return handleUnsubscribe({ emailData: firstEmail }).catch((e) => {
                toast.error(e.message ?? 'Unknown error while unsubscribing');
              });
          }
        }),
      ).then(async () => {
        setIsUnsub(false);
        setIsLoading(false);
        await refetchThreads();
        await refetchStats();
        setMail({ ...mail, bulkSelected: [] });
      }),
      {
        loading: 'Unsubscribing...',
        success: 'All done! you will no longer receive emails from these mailing lists.',
        error: 'Something went wrong!',
      },
    );
  };

  return (
    <div className="flex items-center gap-2">
      <button
        className="flex h-8 flex-1 items-center justify-center gap-1 overflow-hidden rounded-md border bg-white px-3 text-sm transition-all duration-300 ease-out hover:bg-gray-100 dark:border-none dark:bg-[#313131] dark:hover:bg-[#313131]/80"
        onClick={() => {
          if (mail.bulkSelected.length === 0) return;
          optimisticMarkAsRead(mail.bulkSelected);
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
              optimisticToggleStar(mail.bulkSelected, true);
            }}
          >
            <div className="relative overflow-visible">
              <Star2 className="fill-[#9D9D9D] stroke-[#9D9D9D] dark:stroke-[#9D9D9D]" />
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent>{m['common.mail.starAll']()}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="flex aspect-square h-8 items-center justify-center gap-1 overflow-hidden rounded-md border bg-white px-2 text-sm transition-all duration-300 ease-out hover:bg-gray-100 dark:border-none dark:bg-[#313131] dark:hover:bg-[#313131]/80"
            onClick={() => {
              if (mail.bulkSelected.length === 0) return;
              optimisticMoveThreadsTo(mail.bulkSelected, folder, 'archive');
            }}
          >
            <div className="relative overflow-visible">
              <Archive2 className="fill-[#9D9D9D]" />
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent>{m['common.mail.archive']()}</TooltipContent>
      </Tooltip>

      <Dialog onOpenChange={setIsUnsub} open={isUnsub}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <button className="flex aspect-square h-8 items-center justify-center gap-1 overflow-hidden rounded-md border bg-white px-2 text-sm transition-all duration-300 ease-out hover:bg-gray-100 dark:border-none dark:bg-[#313131] dark:hover:bg-[#313131]/80">
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
          <TooltipContent>{m['common.mail.unSubscribeFromAll']()}</TooltipContent>
        </Tooltip>

        <DialogContent
          showOverlay
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
              <span>Unsubscribe</span>
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
              optimisticDeleteThreads(mail.bulkSelected, folder);
            }}
          >
            <div className="relative overflow-visible">
              <Trash className="fill-[#F43F5E]" />
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent>{m['common.mail.moveToBin']()}</TooltipContent>
      </Tooltip>
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
        return base as any;
    }
  });

  return categories;
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
  const defaultCategoryIdInner = useDefaultCategoryId();
  const [category, setCategory] = useQueryState('category', {
    defaultValue: defaultCategoryIdInner,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const activeTabElementRef = useRef<HTMLButtonElement>(null);
  const overlayContainerRef = useRef<HTMLDivElement>(null);
  const [textSize, setTextSize] = useState<'normal' | 'small' | 'xs' | 'hidden'>('normal');
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  if (folder !== 'inbox') return <div className="h-8"></div>;

  useEffect(() => {
    const checkTextSize = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.offsetWidth;
      const selectedCategory = categories.find((cat) => cat.id === category);

      // Calculate approximate widths needed for different text sizes
      const baseIconWidth = (categories.length - 1) * 40; // unselected icons + gaps
      const selectedTextLength = selectedCategory ? selectedCategory.name.length : 10;

      // Estimate width needed for different text sizes
      const normalTextWidth = selectedTextLength * 8 + 60; // normal text
      const smallTextWidth = selectedTextLength * 7 + 50; // smaller text
      const xsTextWidth = selectedTextLength * 6 + 40; // extra small text
      const minIconWidth = 40; // minimum width for icon-only selected button

      const totalNormal = baseIconWidth + normalTextWidth;
      const totalSmall = baseIconWidth + smallTextWidth;
      const totalXs = baseIconWidth + xsTextWidth;
      const totalIconOnly = baseIconWidth + minIconWidth;

      if (containerWidth >= totalNormal) {
        setTextSize('normal');
      } else if (containerWidth >= totalSmall) {
        setTextSize('small');
      } else if (containerWidth >= totalXs) {
        setTextSize('xs');
      } else if (containerWidth >= totalIconOnly) {
        setTextSize('hidden'); // Hide text but keep button wide
      } else {
        setTextSize('hidden'); // Hide text in very tight spaces
      }
    };

    checkTextSize();

    // Use ResizeObserver to handle container size changes
    const resizeObserver = new ResizeObserver(() => {
      checkTextSize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [category, categories]);

  const renderCategoryButton = (cat: CategoryType, isOverlay = false, idx: number) => {
    const isSelected = cat.id === (category || 'Primary');
    const bgColor = getCategoryColor(cat.id);

    // Determine text classes based on current text size
    const getTextClasses = () => {
      switch (textSize) {
        case 'normal':
          return 'text-sm';
        case 'small':
          return 'text-xs';
        case 'xs':
          return 'text-[10px]';
        case 'hidden':
          return 'text-sm'; // Doesn't matter since text is hidden
        default:
          return 'text-sm';
      }
    };

    // Determine padding based on text size
    const getPaddingClasses = () => {
      switch (textSize) {
        case 'normal':
          return 'px-3';
        case 'small':
          return 'px-2.5';
        case 'xs':
          return 'px-2';
        case 'hidden':
          return 'px-2'; // Just enough padding for the icon
        default:
          return 'px-3';
      }
    };

    const showText = textSize !== 'hidden';

    const button = (
      <button
        ref={!isOverlay ? activeTabElementRef : null}
        onClick={() => {
          setCategory(cat.id);
          setSearchValue({
            value: `${cat.searchValue} ${cleanSearchValue(searchValue.value).trim().length ? `AND ${cleanSearchValue(searchValue.value)}` : ''}`,
            highlight: searchValue.highlight,
            folder: '',
          });
        }}
        className={cn(
          'flex h-8 items-center justify-center gap-1 overflow-hidden rounded-lg border transition-all duration-300 ease-out dark:border-none',
          isSelected
            ? cn('flex-1 border-none text-white', getPaddingClasses(), bgColor)
            : 'w-8 bg-white hover:bg-gray-100 dark:bg-[#313131] dark:hover:bg-[#313131]/80',
        )}
        tabIndex={isOverlay ? -1 : undefined}
      >
        <div className="relative overflow-visible">{cat.icon}</div>
        {isSelected && showText && (
          <div className="flex items-center justify-center gap-2.5 px-0.5">
            <div className={cn('justify-start truncate leading-none text-white', getTextClasses())}>
              {cat.name}
            </div>
          </div>
        )}
      </button>
    );

    if (!isDesktop) {
      return React.cloneElement(button, { key: cat.id });
    }

    return (
      <Tooltip key={cat.id}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent
          side="top"
          align={idx === 0 ? 'start' : idx === categories.length - 1 ? 'end' : 'center'}
        >
          <span className="mr-2">{cat.name}</span>
          <kbd
            className={cn(
              'border-muted-foreground/10 bg-accent h-6 rounded-[6px] border px-1.5 font-mono text-xs leading-6',
              '-me-1 ms-auto inline-flex max-h-full items-center',
            )}
          >
            {idx + 1}
          </kbd>
        </TooltipContent>
      </Tooltip>
    );
  };

  // Update clip path when category changes
  useEffect(() => {
    const container = overlayContainerRef.current;
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
  }, [category, textSize]); // Changed from showText to textSize

  if (isMultiSelectMode) {
    return <BulkSelectActions />;
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="flex w-full items-start justify-start gap-2">
        {categories.map((cat, idx) => renderCategoryButton(cat, false, idx))}
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 overflow-hidden transition-[clip-path] duration-300 ease-in-out"
        ref={overlayContainerRef}
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
        className="pointer-events-none absolute inset-0 z-10 overflow-hidden transition-[clip-path] duration-300 ease-in-out"
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
