import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { ArrowsPointingIn, PanelLeftOpen, Phone } from '../icons/icons';
import { ResizablePanel } from '@/components/ui/resizable';
import { useSearchValue } from '@/hooks/use-search-value';
import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AIChat } from '@/components/create/ai-chat';
import { useTRPC } from '@/providers/query-provider';
import { Tools } from '../../../server/src/types';
import { useBilling } from '@/hooks/use-billing';
import { PromptsDialog } from './prompts-dialog';
import { Button } from '@/components/ui/button';
import { useHotkeys } from 'react-hotkeys-hook';
import { useLabels } from '@/hooks/use-labels';
import { useSession } from '@/lib/auth-client';
import { useAgentChat } from 'agents/ai-react';
import { X, Expand, Plus } from 'lucide-react';
import { Gauge } from '@/components/ui/gauge';
import { useParams } from 'react-router';
import { useChat } from '@ai-sdk/react';
import { useAgent } from 'agents/react';
import { useQueryState } from 'nuqs';
import { cn } from '@/lib/utils';
import posthog from 'posthog-js';
import { toast } from 'sonner';

interface ChatHeaderProps {
  onClose: () => void;
  onToggleFullScreen: () => void;
  onToggleViewMode: () => void;
  isFullScreen: boolean;
  isPopup: boolean;
  isPro: boolean;
  onNewChat: () => void;
}

function ChatHeader({
  onClose,
  onToggleFullScreen,
  onToggleViewMode,
  isFullScreen,
  isPopup,
  isPro,
  onNewChat,
}: ChatHeaderProps) {
  const [, setPricingDialog] = useQueryState('pricingDialog');
  const { chatMessages } = useBilling();
  return (
    <div className="relative flex items-center justify-between border-b border-[#E7E7E7] px-2.5 pb-[10px] pt-[13px] dark:border-[#252525]">
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={onClose} variant="ghost" className="md:h-fit md:px-2">
              <X className="dark:text-iconDark text-iconLight" />
              <span className="sr-only">Close chat</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Close chat</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="flex items-center gap-2">
        {isFullScreen ? (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onToggleFullScreen}
                  variant="ghost"
                  className="hidden md:flex md:h-fit md:px-2"
                >
                  <ArrowsPointingIn className="dark:fill-iconDark fill-iconLight" />
                  <span className="sr-only">Toggle view mode</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove full screen</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onToggleFullScreen}
                    variant="ghost"
                    className="hidden md:flex md:h-fit md:px-2 [&>svg]:size-2"
                  >
                    <Expand className="dark:text-iconDark text-iconLight" />
                    <span className="sr-only">Toggle view mode</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Go to full screen</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onToggleViewMode}
                    variant="ghost"
                    className="hidden md:flex md:h-fit md:px-2"
                  >
                    {isPopup ? (
                      <PanelLeftOpen className="dark:fill-iconDark fill-iconLight" />
                    ) : (
                      <Phone className="dark:fill-iconDark fill-iconLight" />
                    )}
                    <span className="sr-only"></span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Go to {isPopup ? 'sidebar' : 'popup'}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}

        {!isPro && (
          <>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild className="md:h-fit md:px-2">
                  <div>
                    <Gauge
                      max={chatMessages.included_usage}
                      value={chatMessages.usage}
                      size="small"
                      showValue={true}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    You've used {chatMessages.usage} out of {chatMessages.included_usage} chat
                    messages.
                  </p>
                  <p className="mb-2">Upgrade for unlimited messages!</p>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPricingDialog('true');
                    }}
                    className="h-8 w-full"
                  >
                    Start 7 day free trial
                  </Button>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}

        <PromptsDialog />

        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={onNewChat} variant="ghost" className="md:h-fit md:px-2">
                <Plus className="dark:text-iconDark text-iconLight" />
                <span className="sr-only">New chat</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>New chat</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

interface AISidebarProps {
  className?: string;
}

type ViewMode = 'sidebar' | 'popup' | 'fullscreen';

export function useAIFullScreen() {
  const [isFullScreenQuery, setIsFullScreenQuery] = useQueryState('isFullScreen');

  // Initialize isFullScreen state from query parameter or localStorage
  const [isFullScreen, setIsFullScreenState] = useState<boolean>(() => {
    // First check query parameter
    if (isFullScreenQuery) {
      return isFullScreenQuery === 'true';
    }

    // Then check localStorage if on client
    if (typeof window !== 'undefined') {
      const savedFullScreen = localStorage.getItem('ai-fullscreen');
      if (savedFullScreen) {
        return savedFullScreen === 'true';
      }
    }

    return false;
  });

  // Update both query parameter and localStorage when fullscreen state changes
  const setIsFullScreen = useCallback(
    (value: boolean) => {
      // Immediately update local state for faster UI response
      setIsFullScreenState(value);

      // For exiting fullscreen, we need to be extra careful to ensure state is updated properly
      if (!value) {
        // Force immediate removal from localStorage for faster response
        if (typeof window !== 'undefined') {
          localStorage.removeItem('ai-fullscreen');
        }

        // Use setTimeout to ensure the state update happens in the next tick
        // This helps prevent the need for double-clicking
        setTimeout(() => {
          setIsFullScreenQuery(null).catch(console.error);
        }, 0);
      } else {
        // For entering fullscreen, we can use the normal flow
        setIsFullScreenQuery('true').catch(console.error);

        // Save to localStorage for persistence across sessions
        if (typeof window !== 'undefined') {
          localStorage.setItem('ai-fullscreen', 'true');
        }
      }
    },
    [setIsFullScreenQuery],
  );

  // Sync with query parameter on mount or when it changes
  useEffect(() => {
    const queryValue = isFullScreenQuery === 'true';
    if (isFullScreenQuery !== null && queryValue !== isFullScreen) {
      setIsFullScreenState(queryValue);
    }
  }, [isFullScreenQuery, isFullScreen]);

  // Initialize from localStorage on mount if query parameter is not set
  useEffect(() => {
    if (typeof window !== 'undefined' && !isFullScreenQuery) {
      const savedFullScreen = localStorage.getItem('ai-fullscreen');
      if (savedFullScreen === 'true') {
        setIsFullScreenQuery('true');
      }
    }

    // Force a re-render when exiting fullscreen mode
    if (isFullScreenQuery === null && isFullScreen) {
      setIsFullScreenState(false);
    }
  }, [isFullScreenQuery, setIsFullScreenQuery, isFullScreen]);

  return {
    isFullScreen,
    setIsFullScreen,
  };
}

export function useAISidebar() {
  const [open, setOpenQuery] = useQueryState('aiSidebar');
  const [viewModeQuery, setViewModeQuery] = useQueryState('viewMode');
  const { isFullScreen, setIsFullScreen } = useAIFullScreen();

  // Initialize viewMode from query parameter, localStorage, or default to 'sidebar'
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (viewModeQuery) return viewModeQuery as ViewMode;

    // Check localStorage for saved state if on client
    if (typeof window !== 'undefined') {
      const savedViewMode = localStorage.getItem('ai-viewmode');
      if (savedViewMode && (savedViewMode === 'sidebar' || savedViewMode === 'popup')) {
        return savedViewMode as ViewMode;
      }
    }

    return 'popup';
  });

  // Update query parameter and localStorage when viewMode changes
  const setViewMode = useCallback(
    async (mode: ViewMode) => {
      setViewModeState(mode);
      await setViewModeQuery(mode === 'popup' ? null : mode);

      // Save to localStorage for persistence across sessions
      if (typeof window !== 'undefined') {
        localStorage.setItem('ai-viewmode', mode);
      }
    },
    [setViewModeQuery],
  );

  // Function to set open state and save to localStorage
  const setOpen = useCallback(
    (openState: boolean) => {
      // For closing, we need to handle state updates more carefully
      if (!openState) {
        // First remove from localStorage immediately
        if (typeof window !== 'undefined') {
          localStorage.removeItem('ai-sidebar-open');
        }

        // Use setTimeout to ensure the query update happens in the next tick
        // This helps prevent the need for double-clicking
        setTimeout(() => {
          setOpenQuery(null).catch(console.error);
        }, 0);
      } else {
        // For opening, we can use the normal flow
        setOpenQuery('true').catch(console.error);

        // Save to localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('ai-sidebar-open', 'true');
        }
      }
    },
    [setOpenQuery],
  );

  // Toggle open state
  const toggleOpen = useCallback(() => {
    const newState = !(open === 'true');
    setOpen(newState);
  }, [open, setOpen]);

  // Sync with query parameters on mount or when they change
  useEffect(() => {
    if (viewModeQuery && viewModeQuery !== viewMode) {
      setViewModeState(viewModeQuery as ViewMode);
    }
  }, [viewModeQuery, viewMode]);

  return {
    open: !!open,
    viewMode,
    setViewMode,
    setOpen,
    toggleOpen,
    toggleViewMode: () => setViewMode(viewMode === 'popup' ? 'sidebar' : 'popup'),
    isFullScreen,
    setIsFullScreen,
    // Add convenience boolean flags for each state
    isSidebar: viewMode === 'sidebar',
    isPopup: viewMode === 'popup',
  };
}

function AISidebar({ className }: AISidebarProps) {
  const {
    open,
    setOpen,
    viewMode,
    setViewMode,
    isFullScreen,
    setIsFullScreen,
    toggleViewMode,
    isSidebar,
    isPopup,
  } = useAISidebar();
  const { isPro, track, refetch: refetchBilling } = useBilling();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const [threadId, setThreadId] = useQueryState('threadId');
  const { folder } = useParams<{ folder: string }>();
  const { refetch: refetchLabels } = useLabels();
  const [searchValue] = useSearchValue();
  const { data: session } = useSession();

  const agent = useAgent({
    agent: 'ZeroAgent',
    name: session?.user.id ?? 'general',
    host: `${import.meta.env.VITE_PUBLIC_BACKEND_URL}`,
  });

  const chatState = useAgentChat({
    agent,
    initialMessages: [],
    maxSteps: 5,
    body: {
      threadId: threadId ?? undefined,
      currentFolder: folder ?? undefined,
      currentFilter: searchValue.value ?? undefined,
    },
    onError(error) {
      console.error('Error in useChat', error);
      posthog.capture('AI Chat Error', {
        error: error.message,
        threadId: threadId ?? undefined,
        currentFolder: folder ?? undefined,
        currentFilter: searchValue.value ?? undefined,
        messages: chatState.messages,
      });
      toast.error('Error, please try again later');
    },
    onResponse: (response) => {
      posthog.capture('AI Chat Response', {
        response,
        threadId: threadId ?? undefined,
        currentFolder: folder ?? undefined,
        currentFilter: searchValue.value ?? undefined,
        messages: chatState.messages,
      });
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
    },
    async onToolCall({ toolCall }) {
      console.warn('toolCall', toolCall);
      posthog.capture('AI Chat Tool Call', {
        toolCall,
        threadId: threadId ?? undefined,
        currentFolder: folder ?? undefined,
        currentFilter: searchValue.value ?? undefined,
        messages: chatState.messages,
      });
      switch (toolCall.toolName) {
        case Tools.CreateLabel:
        case Tools.DeleteLabel:
          await refetchLabels();
          break;
        case Tools.SendEmail:
          await queryClient.invalidateQueries({
            queryKey: trpc.mail.listThreads.queryKey({ folder: 'sent' }),
          });
          break;
        case Tools.MarkThreadsRead:
        case Tools.MarkThreadsUnread:
        case Tools.ModifyLabels:
        case Tools.BulkDelete:
          console.log('modifyLabels', toolCall.args);
          await refetchLabels();
          await Promise.all(
            (toolCall.args as { threadIds: string[] }).threadIds.map((id) =>
              queryClient.invalidateQueries({
                queryKey: trpc.mail.get.queryKey({ id }),
              }),
            ),
          );
          break;
      }
      await track({ featureId: 'chat-messages', value: 1 });
      await refetchBilling();
    },
  });

  useHotkeys('Meta+0', () => {
    setOpen(!open);
  });

  useHotkeys('Control+0', () => {
    setOpen(!open);
  });

  const handleNewChat = useCallback(() => {
    chatState.setMessages([]);
  }, [chatState]);

  return (
    <>
      {open && (
        <>
          {/* Desktop view - visible on md and larger screens */}
          {isSidebar && !isFullScreen && (
            <>
              <div className="w-[1px] opacity-0" />
              <ResizablePanel
                defaultSize={24}
                minSize={24}
                maxSize={24}
                className="bg-panelLight dark:bg-panelDark mb-1 mr-1 hidden h-[calc(100dvh-8px)] border-[#E7E7E7] shadow-sm md:block md:rounded-2xl md:border md:shadow-sm dark:border-[#252525]"
              >
                <div className={cn('h-[calc(98vh)]', 'flex flex-col', '', className)}>
                  <div className="flex h-full flex-col">
                    <ChatHeader
                      onClose={() => {
                        setOpen(false);
                        setIsFullScreen(false);
                      }}
                      onToggleFullScreen={() => setIsFullScreen(!isFullScreen)}
                      onToggleViewMode={toggleViewMode}
                      isFullScreen={isFullScreen}
                      isPopup={isPopup}
                      isPro={isPro ?? false}
                      onNewChat={handleNewChat}
                    />
                    <div className="relative flex-1 overflow-hidden">
                      <AIChat {...chatState} />
                    </div>
                  </div>
                </div>
              </ResizablePanel>
            </>
          )}

          {/* Popup view - visible on small screens or when popup mode is selected */}
          <div
            tabIndex={0}
            className={cn(
              'fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4 opacity-40 backdrop-blur-sm transition-opacity duration-150 hover:opacity-100 sm:inset-auto sm:bottom-4 sm:right-4 sm:flex-col sm:items-end sm:justify-end sm:p-0',
              'md:hidden',
              isPopup && !isFullScreen && 'md:flex',
              isFullScreen && '!inset-0 !flex !p-0 !opacity-100 !backdrop-blur-none',
              'rounded-2xl focus:opacity-100',
            )}
          >
            <div
              className={cn(
                'bg-panelLight dark:bg-panelDark w-full overflow-hidden rounded-2xl border border-[#E7E7E7] shadow-lg dark:border-[#252525]',
                'md:hidden',
                isPopup && !isFullScreen && 'w-[600px] max-w-[90vw] sm:w-[400px] md:block',
                isFullScreen && '!block !max-w-none !rounded-none !border-none',
              )}
            >
              <div
                className={cn(
                  'flex w-full flex-col',
                  isFullScreen ? 'h-screen' : 'h-[90vh] sm:h-[600px] sm:max-h-[85vh]',
                )}
              >
                <ChatHeader
                  onClose={() => {
                    setOpen(false);
                    setIsFullScreen(false);
                  }}
                  onToggleFullScreen={() => setIsFullScreen(!isFullScreen)}
                  onToggleViewMode={toggleViewMode}
                  isFullScreen={isFullScreen}
                  isPopup={isPopup}
                  isPro={isPro ?? false}
                  onNewChat={handleNewChat}
                />
                <div className="relative flex-1 overflow-hidden">
                  <AIChat {...chatState} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default AISidebar;
