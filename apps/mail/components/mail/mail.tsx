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
} from '../icons/icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useActiveConnection, useConnections } from '@/hooks/use-connections';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCommandPalette } from '../context/command-palette-context';
import { useOptimisticActions } from '@/hooks/use-optimistic-actions';
import { ThreadDisplay } from '@/components/mail/thread-display';
import { trpcClient, useTRPC } from '@/providers/query-provider';
import { backgroundQueueAtom } from '@/store/backgroundQueue';
import { handleUnsubscribe } from '@/lib/email-utils.client';
import { useMediaQuery } from '../../hooks/use-media-query';
import { useSearchValue } from '@/hooks/use-search-value';
import { MailList } from '@/components/mail/mail-list';
import { useHotkeysContext } from 'react-hotkeys-hook';
import { useNavigate, useParams } from 'react-router';
import { useMail } from '@/components/mail/use-mail';
import { PricingDialog } from '../ui/pricing-dialog';
import { SidebarToggle } from '../ui/sidebar-toggle';
import { Textarea } from '@/components/ui/textarea';
import { useBrainState } from '@/hooks/use-summary';
import { clearBulkSelectionAtom } from './use-mail';
import AISidebar from '@/components/ui/ai-sidebar';
import { Command, RefreshCcw } from 'lucide-react';
import { cleanSearchValue, cn } from '@/lib/utils';
import { useBilling } from '@/hooks/use-billing';
import { useThreads } from '@/hooks/use-threads';
import AIToggleButton from '../ai-toggle-button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useSession } from '@/lib/auth-client';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStats } from '@/hooks/use-stats';
import { useTranslations } from 'use-intl';
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
    toast.promise(EnableBrain({}), {
      loading: 'Enabling autolabeling...',
      success: 'Autolabeling enabled successfully',
      error: 'Failed to enable autolabeling',
      finally: async () => {
        await refetchBrainState();
      },
    });
  }, []);

  const handleDisableBrain = useCallback(async () => {
    toast.promise(DisableBrain({}), {
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
          {/* <div
            className={cn(
              'h-2 w-2 animate-pulse rounded-full',
              brainState?.enabled ? 'bg-green-400' : 'bg-red-400',
            )}
          /> */}

          <Switch
            disabled={isEnablingBrain || isDisablingBrain || isLoading}
            checked={brainState?.enabled ?? false}
          />
          <span className="text-muted-foreground cursor-pointer text-xs">Auto label</span>
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
  const t = useTranslations();
  const prevFolderRef = useRef(folder);
  const { enableScope, disableScope } = useHotkeysContext();
  const { data: activeConnection } = useActiveConnection();
  const { open, setOpen, activeFilters, clearAllFilters } = useCommandPalette();

  const activeAccount = useMemo(() => {
    if (!activeConnection?.id || !connections?.connections) return null;
    return connections.connections.find((connection) => connection.id === activeConnection?.id);
  }, [activeConnection?.id, connections?.connections]);

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
  const [, setActiveReplyId] = useQueryState('activeReplyId');

  const handleClose = useCallback(() => {
    setThreadId(null);
    setActiveReplyId(null);
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
        navigator.registerProtocolHandler('mailto', `/api/mailto-handler?mailto=%s`);
      } catch (error) {
        console.error('Failed to register protocol handler:', error);
      }
    }
  }, []);

  const category = useQueryState('category');

  return (
    <TooltipProvider delayDuration={0}>
      <PricingDialog />
      <div className="rounded-inherit relative z-[5] flex p-0 md:mt-1">
        <ResizablePanelGroup
          direction="horizontal"
          autoSaveId="mail-panel-layout"
          className="rounded-inherit overflow-hidden"
        >
          <ResizablePanel
            defaultSize={35}
            minSize={35}
            maxSize={40}
            className={cn(
              `bg-panelLight dark:bg-panelDark mb-1 w-fit shadow-sm md:rounded-2xl md:border md:border-[#E7E7E7] lg:flex lg:shadow-sm dark:border-[#252525]`,
              isDesktop && threadId && 'hidden lg:block',
            )}
          >
            <div className="w-full md:h-[calc(100dvh-10px)]">
              <div
                className={cn(
                  'sticky top-0 z-[15] flex items-center justify-between gap-1.5 border-b border-[#E7E7E7] p-2 px-[20px] transition-colors md:min-h-14 dark:border-[#252525]',
                )}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <div>
                    <SidebarToggle className="h-fit px-2" />
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
                              {t('common.actions.exitSelectionModeEsc')}
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
                    'text-muted-foreground relative flex h-9 w-full select-none items-center justify-start overflow-hidden rounded-[0.5rem] border bg-white text-left text-sm font-normal shadow-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-[#141414]',
                  )}
                  onClick={() => setOpen(!open)}
                >
                  <span className="hidden truncate pr-20 lg:inline-block">
                    {activeFilters.length > 0
                      ? activeFilters.map((f) => f.display).join(', ')
                      : 'Search & Filters'}
                  </span>
                  <span className="inline-block truncate pr-20 lg:hidden">
                    {activeFilters.length > 0
                      ? `${activeFilters.length} filter${activeFilters.length > 1 ? 's' : ''}`
                      : 'Search...'}
                  </span>

                  <span className="absolute right-[0.45rem] top-[0.45rem] flex gap-1">
                    {/* {activeFilters.length > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 rounded px-1">
                        {activeFilters.length}
                      </Badge>
                    )} */}
                    {activeFilters.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 rounded px-1.5 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearAllFilters();
                        }}
                      >
                        Clear
                      </Button>
                    )}
                    <kbd className="bg-muted pointer-events-none hidden h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                      <span className="text-sm">⌘</span> K
                    </kbd>
                  </span>
                </Button>
                <div className="mt-2">
                  {activeAccount?.providerId === 'google' && folder === 'inbox' && (
                    <CategorySelect isMultiSelectMode={mail.bulkSelected.length > 0} />
                  )}
                </div>
              </div>
              <div
                className={cn(
                  `${category[0] === 'Important' ? 'bg-[#F59E0D]' : category[0] === 'All Mail' ? 'bg-[#006FFE]' : category[0] === 'Personal' ? 'bg-[#39ae4a]' : category[0] === 'Updates' ? 'bg-[#8B5CF6]' : category[0] === 'Promotions' ? 'bg-[#F43F5E]' : category[0] === 'Unread' ? 'bg-[#FF4800]' : 'bg-[#F59E0D]'}`,
                  'relative bottom-0.5 z-[5] h-0.5 w-full transition-opacity',
                  isFetching ? 'opacity-100' : 'opacity-0',
                )}
              />
              <div className="relative z-[1] h-[calc(100dvh-(2px+88px+49px+2px))] overflow-hidden pt-0 md:h-[calc(100dvh-9.8rem)]">
                <MailList />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle className="mr-0.5 hidden opacity-0 md:block" />

          {isDesktop && (
            <ResizablePanel
              className={cn(
                'bg-panelLight dark:bg-panelDark mb-1 mr-0.5 w-fit rounded-2xl border border-[#E7E7E7] shadow-sm dark:border-[#252525]',
                // Only show on md screens and larger when there is a threadId
                !threadId && 'hidden lg:block',
              )}
              defaultSize={30}
              minSize={30}
            >
              <div className="lg:h-[calc(100dvh-(10px)] relative h-[calc(100dvh-(10px))] flex-1">
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
  const t = useTranslations();
  const [errorQty, setErrorQty] = useState(0);
  const [threadId, setThreadId] = useQueryState('threadId');
  const [isLoading, setIsLoading] = useState(false);
  const [isUnsub, setIsUnsub] = useState(false);
  const [mail, setMail] = useMail();
  const params = useParams<{ folder: string }>();
  const folder = params?.folder ?? 'inbox';
  const [{ refetch: refetchThreads }] = useThreads();
  const { refetch: refetchStats } = useStats();
  const trpc = useTRPC();
  const { mutateAsync: markAsImportant } = useMutation(trpc.mail.markAsImportant.mutationOptions());
  const { mutateAsync: bulkDeleteThread } = useMutation(trpc.mail.bulkDelete.mutationOptions());
  const queryClient = useQueryClient();
  const {
    optimisticMarkAsRead,
    optimisticToggleStar,
    optimisticMoveThreadsTo,
    optimisticDeleteThreads,
  } = useOptimisticActions();
  const [, setBackgroundQueue] = useAtom(backgroundQueueAtom);

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
                setErrorQty((eq) => eq++);
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

  const onMoveSuccess = useCallback(async () => {
    if (threadId && mail.bulkSelected.includes(threadId)) setThreadId(null);
    refetchThreads();
    refetchStats();
    await Promise.all(
      mail.bulkSelected.map((threadId) =>
        queryClient.invalidateQueries({ queryKey: trpc.mail.get.queryKey({ id: threadId }) }),
      ),
    );
    setMail({ ...mail, bulkSelected: [] });
  }, [mail, setMail, refetchThreads, refetchStats, threadId, setThreadId]);

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
        <TooltipContent>{t('common.mail.starAll')}</TooltipContent>
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
        <TooltipContent>{t('common.mail.archive')}</TooltipContent>
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
          <TooltipContent>{t('common.mail.unSubscribeFromAll')}</TooltipContent>
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
      searchValue: 'is:important NOT is:sent NOT is:draft',
      icon: (
        <Lightning
          className={cn(
            'fill-muted-foreground dark:fill-white',
            category === 'Important' && 'fill-white',
          )}
        />
      ),
    },
    {
      id: 'All Mail',
      name: 'All Mail',
      searchValue: 'NOT is:draft (is:inbox OR (is:sent AND to:me))',
      icon: (
        <Mail
          className={cn(
            'fill-muted-foreground dark:fill-white',
            category === 'All Mail' && 'fill-white',
          )}
        />
      ),
      colors:
        'border-0 bg-[#006FFE] text-white dark:bg-[#006FFE] dark:text-white dark:hover:bg-[#006FFE]/90',
    },
    {
      id: 'Personal',
      name: t('common.mailCategories.personal'),
      searchValue: 'is:personal NOT is:sent NOT is:draft',
      icon: (
        <User
          className={cn(
            'fill-muted-foreground dark:fill-white',
            category === 'Personal' && 'fill-white',
          )}
        />
      ),
    },
    {
      id: 'Updates',
      name: t('common.mailCategories.updates'),
      searchValue: 'is:updates NOT is:sent NOT is:draft',
      icon: (
        <Bell
          className={cn(
            'fill-muted-foreground dark:fill-white',
            category === 'Updates' && 'fill-white',
          )}
        />
      ),
    },
    {
      id: 'Promotions',
      name: 'Promotions',
      searchValue: 'is:promotions NOT is:sent NOT is:draft',
      icon: (
        <Tag
          className={cn(
            'fill-muted-foreground dark:fill-white',
            category === 'Promotions' && 'fill-white',
          )}
        />
      ),
    },
    {
      id: 'Unread',
      name: 'Unread',
      searchValue: 'is:unread NOT is:sent NOT is:draft',
      icon: (
        <ScanEye
          className={cn(
            'fill-muted-foreground h-4 w-4 dark:fill-white',
            category === 'Unread' && 'fill-white',
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

  const renderCategoryButton = (cat: CategoryType, isOverlay = false, idx: number) => {
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
                value: `${cat.searchValue} ${cleanSearchValue(searchValue.value).trim().length ? `AND ${cleanSearchValue(searchValue.value)}` : ''}`,
                highlight: searchValue.highlight,
                folder: '',
              });
            }}
            className={cn(
              'flex h-8 items-center justify-center gap-1 overflow-hidden rounded-lg border transition-all duration-300 ease-out dark:border-none',
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
        {!isSelected && (
          <TooltipContent side="top" className={`${idx === 0 ? 'ml-4' : ''}`}>
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
        )}
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
        className="pointer-events-none absolute inset-0 z-10 overflow-hidden transition-[clip-path] duration-300 ease-in-out"
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
