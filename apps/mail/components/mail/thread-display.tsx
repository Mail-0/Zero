import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTheme } from 'next-themes';
import Image from 'next/image';

import {
  ChevronLeft,
  ChevronRight,
  X,
  Reply,
  Archive,
  ThreeDots,
  Trash,
  Expand,
  ArchiveX,
  Forward,
  ReplyAll,
  Star,
} from '../icons/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { CircleAlertIcon, Inbox, ShieldAlertIcon, StopCircleIcon } from 'lucide-react';
import { moveThreadsTo, type ThreadDestination } from '@/lib/thread-actions';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useMailNavigation } from '@/hooks/use-mail-navigation';
import { focusedIndexAtom } from '@/hooks/use-mail-navigation';
import { backgroundQueueAtom } from '@/store/backgroundQueue';
import { handleUnsubscribe } from '@/lib/email-utils.client';
import { useThread, useThreads } from '@/hooks/use-threads';
import { useAISidebar } from '@/components/ui/ai-sidebar';
import { useHotkeysContext } from 'react-hotkeys-hook';
import { MailDisplaySkeleton } from './mail-skeleton';
import { useTRPC } from '@/providers/query-provider';
import { useMutation } from '@tanstack/react-query';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { useStats } from '@/hooks/use-stats';
import ThreadSubject from './thread-subject';
import type { ParsedMessage } from '@/types';
import ReplyCompose from './reply-composer';
import { Separator } from '../ui/separator';
import { useTranslations } from 'next-intl';
import { useMail } from '../mail/use-mail';
import { NotesPanel } from './note-panel';
import { cn, FOLDERS } from '@/lib/utils';
import MailDisplay from './mail-display';
import { useQueryState } from 'nuqs';
import { useAtom } from 'jotai';
import { toast } from 'sonner';

interface ThreadDisplayProps {
  threadParam?: any;
  onClose?: () => void;
  isMobile?: boolean;
  messages?: ParsedMessage[];
  id?: string;
}

export function ThreadDemo({ messages, isMobile }: ThreadDisplayProps) {
  const isFullscreen = false;
  return (
    <div
      className={cn(
        'flex flex-col',
        isFullscreen ? 'h-screen' : isMobile ? 'h-full' : 'h-[calc(100vh-2rem)]',
      )}
    >
      <div
        className={cn(
          'bg-offsetLight dark:bg-offsetDark relative flex flex-col overflow-hidden transition-all duration-300',
          isMobile ? 'h-full' : 'h-full',
          !isMobile && !isFullscreen && 'rounded-r-lg',
          isFullscreen ? 'fixed inset-0 z-50' : '',
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ScrollArea className="flex-1" type="scroll">
            <div className="pb-4">
              {[...(messages || [])].reverse().map((message, index) => (
                <div
                  key={message.id}
                  className={cn(
                    'transition-all duration-200',
                    index > 0 && 'border-border border-t',
                  )}
                >
                  <MailDisplay
                    demo
                    emailData={message}
                    isFullscreen={isFullscreen}
                    isMuted={false}
                    isLoading={false}
                    index={index}
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

function ThreadActionButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  className,
}: {
  icon: React.ComponentType<React.ComponentPropsWithRef<any>> & {
    startAnimation?: () => void;
    stopAnimation?: () => void;
  };
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const iconRef = useRef<any>(null);

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            disabled={disabled}
            onClick={onClick}
            variant="ghost"
            className={cn('md:h-fit md:px-2', className)}
            onMouseEnter={() => iconRef.current?.startAnimation?.()}
            onMouseLeave={() => iconRef.current?.stopAnimation?.()}
          >
            <Icon ref={iconRef} className="fill-muted-foreground" />
            <span className="sr-only">{label}</span>
          </Button>
        </TooltipTrigger>
        {/* <TooltipContent>{label}</TooltipContent> */}
      </Tooltip>
    </TooltipProvider>
  );
}

export function ThreadDisplay() {
  const isMobile = useIsMobile();
  const { toggleOpen: toggleAISidebar, open: isSidebarOpen } = useAISidebar();
  const params = useParams<{ folder: string }>();
  const folder = params?.folder ?? 'inbox';
  const [id, setThreadId] = useQueryState('threadId');
  const { data: emailData, isLoading, refetch: refetchThreads } = useThread(id ?? null);
  const [{ refetch: mutateThreads }, items] = useThreads();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mail, setMail] = useMail();
  const [isStarred, setIsStarred] = useState(false);
  const t = useTranslations();
  const { refetch: refetchStats } = useStats();
  const [mode, setMode] = useQueryState('mode');
  const [, setBackgroundQueue] = useAtom(backgroundQueueAtom);
  const [activeReplyId, setActiveReplyId] = useQueryState('activeReplyId');
  const [, setDraftId] = useQueryState('draftId');
  const { resolvedTheme } = useTheme();
  const [focusedIndex, setFocusedIndex] = useAtom(focusedIndexAtom);
  const trpc = useTRPC();
  const { mutateAsync: markAsRead } = useMutation(trpc.mail.markAsRead.mutationOptions());

  const handlePrevious = useCallback(() => {
    if (!id || !items.length || focusedIndex === null) return;
    if (focusedIndex > 0) {
      const prevThread = items[focusedIndex - 1];
      if (prevThread) {
        setThreadId(prevThread.id);
        setFocusedIndex(focusedIndex - 1);
      }
    }
  }, [items, id, focusedIndex, setThreadId, setFocusedIndex]);

  const handleNext = useCallback(() => {
    if (!id || !items.length || focusedIndex === null) return setThreadId(null);
    if (focusedIndex < items.length - 1) {
      const nextThread = items[focusedIndex + 1];
      if (nextThread) {
        setThreadId(nextThread.id);
        setActiveReplyId(null);
        setFocusedIndex(focusedIndex + 1);
      }
    }
  }, [items, id, focusedIndex, setThreadId, setActiveReplyId, setFocusedIndex]);

  // Check if thread contains any images (excluding sender avatars)
  const hasImages = useMemo(() => {
    if (!emailData) return false;
    return emailData.messages.some((message) => {
      const hasAttachments = message.attachments?.some((attachment) =>
        attachment.mimeType?.startsWith('image/'),
      );
      const hasInlineImages =
        message.processedHtml?.includes('<img') &&
        !message.processedHtml.includes('data:image/svg+xml;base64'); // Exclude avatar SVGs
      return hasAttachments || hasInlineImages;
    });
  }, [emailData]);

  const hasMultipleParticipants =
    (emailData?.latest?.to?.length ?? 0) + (emailData?.latest?.cc?.length ?? 0) + 1 > 2;

  /**
   * Mark email as read if it's unread, if there are no unread emails, mark the current thread as read
   */
  useEffect(() => {
    if (!emailData || !id) return;
    const unreadEmails = emailData.messages.filter((e) => e.unread);
    console.log({
      totalReplies: emailData.totalReplies,
      unreadEmails: unreadEmails.length,
    });
    if (unreadEmails.length > 0) {
      const ids = [id, ...unreadEmails.map((e) => e.id)];
      markAsRead({ ids })
        .catch((error) => {
          console.error('Failed to mark email as read:', error);
          toast.error(t('common.mail.failedToMarkAsRead'));
        })
        .then(() => Promise.allSettled([refetchThreads(), refetchStats()]));
    }
  }, [emailData, id]);

  const handleUnsubscribeProcess = () => {
    if (!emailData?.latest) return;
    toast.promise(handleUnsubscribe({ emailData: emailData.latest }), {
      success: 'Unsubscribed successfully!',
      error: 'Failed to unsubscribe',
    });
  };

  const isInArchive = folder === FOLDERS.ARCHIVE;
  const isInSpam = folder === FOLDERS.SPAM;
  const isInBin = folder === FOLDERS.BIN;
  const handleClose = useCallback(() => {
    setThreadId(null);
    setMode(null);
    setActiveReplyId(null);
    setDraftId(null);
  }, [setThreadId, setMode]);

  const moveThreadTo = useCallback(
    async (destination: ThreadDestination) => {
      if (!id) return;
      const promise = moveThreadsTo({
        threadIds: [id],
        currentFolder: folder,
        destination,
      });
      setBackgroundQueue({ type: 'add', threadId: `thread:${id}` });
      handleNext();

      toast.success(
        destination === 'inbox'
          ? t('common.actions.movedToInbox')
          : destination === 'spam'
            ? t('common.actions.movedToSpam')
            : destination === 'bin'
              ? t('common.actions.movedToBin')
              : t('common.actions.archived'),
      );
      toast.promise(promise, {
        error: t('common.actions.failedToMove'),
        finally: async () => {
          await Promise.all([refetchStats(), refetchThreads()]);
          //   setBackgroundQueue({ type: 'delete', threadId: `thread:${threadId}` });
        },
      });
    },
    [id, folder, t],
  );

  // Add handleToggleStar function
  const handleToggleStar = useCallback(async () => {
    if (!emailData || !id) return;

    const newStarredState = !isStarred;
    setIsStarred(newStarredState);
    if (newStarredState) {
      toast.success(t('common.actions.addedToFavorites'));
    } else {
      toast.success(t('common.actions.removedFromFavorites'));
    }
    mutateThreads();
  }, [emailData, id, isStarred, mutateThreads, t]);

  // Set initial star state based on email data
  useEffect(() => {
    if (emailData?.latest?.tags) {
      // Check if any tag has the name 'STARRED'
      setIsStarred(emailData.latest.tags.some((tag) => tag.name === 'STARRED'));
    }
  }, [emailData?.latest?.tags]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [handleClose]);

  // When mode changes, set the active reply to the latest message
  useEffect(() => {
    // Only clear the active reply when mode is cleared
    // This prevents overriding the specifically selected message
    if (!mode) {
      setActiveReplyId(null);
    }
  }, [mode]);

  // Scroll to the active reply composer when it's opened
  useEffect(() => {
    if (mode && activeReplyId) {
      setTimeout(() => {
        const replyElement = document.getElementById(`reply-composer-${activeReplyId}`);
        if (replyElement) {
          replyElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100); // Short delay to ensure the component is rendered
    }
  }, [mode, activeReplyId]);

  return (
    <div
      className={cn(
        'flex flex-col',
        isFullscreen ? 'h-screen' : isMobile ? 'h-full' : 'h-[calc(100dvh-19px)] rounded-xl',
      )}
    >
      <div
        className={cn(
          'bg-panel relative flex flex-col overflow-hidden rounded-xl transition-all duration-300',
          isMobile ? 'h-full' : 'h-full',
          !isMobile && !isFullscreen && 'rounded-r-lg',
          isFullscreen ? 'fixed inset-0 z-50' : '',
        )}
      >
        <div></div>
        {!id ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <Image
                src={resolvedTheme === 'dark' ? '/empty-state.svg' : '/empty-state-light.svg'}
                alt="Empty Thread"
                width={200}
                height={200}
              />
              <div className="mt-5">
                <p className="text-lg">It's empty here</p>
                <p className="text-md text-foreground/70">Choose an email to view details</p>
              </div>
            </div>
            {!isSidebarOpen && (
              <div className="fixed bottom-4 right-4 hidden md:block">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-10 w-10 rounded-md p-0"
                      onClick={toggleAISidebar}
                    >
                      <Image
                        src="/black-icon.svg"
                        alt="AI Assistant"
                        width={20}
                        height={20}
                        className="block dark:hidden"
                      />
                      <Image
                        src="/white-icon.svg"
                        alt="AI Assistant"
                        width={20}
                        height={20}
                        className="hidden dark:block"
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Toggle AI Assistant</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        ) : !emailData || isLoading ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <ScrollArea className="h-full flex-1" type="auto">
              <div className="pb-4">
                <MailDisplaySkeleton isFullscreen={isFullscreen} />
              </div>
            </ScrollArea>
          </div>
        ) : (
          <>
            <div
              className={cn(
                'border-panelBorder flex flex-shrink-0 items-center border-b px-1 pb-1 md:px-3 md:pb-[11px] md:pt-[12px]',
                isMobile && 'bg-panel sticky top-0 z-10 mt-2',
              )}
            >
              <div className="flex flex-1 items-center gap-2">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleClose}
                        className="hover:bg-muted inline-flex h-7 w-7 items-center justify-center gap-1 overflow-hidden rounded-md md:hidden"
                      >
                        <X className="fill-muted-foreground h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{t('common.actions.close')}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <ThreadActionButton
                  icon={X}
                  label={t('common.actions.close')}
                  onClick={handleClose}
                  className="hidden md:flex"
                />
                {/* <ThreadSubject subject={emailData.latest?.subject} /> */}
                <div className="bg-muted relative h-3 w-0.5 rounded-full" />{' '}
                <div className="flex items-center gap-1">
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handlePrevious}
                          className="hover:bg-muted inline-flex h-7 w-7 items-center justify-center gap-1 overflow-hidden rounded-md md:hidden"
                        >
                          <ChevronLeft className="fill-muted-foreground h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Previous email</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <ThreadActionButton
                    icon={ChevronLeft}
                    label="Previous email"
                    onClick={handlePrevious}
                    className="hidden md:flex"
                  />
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handleNext}
                          className="hover:bg-muted inline-flex h-7 w-7 items-center justify-center gap-1 overflow-hidden rounded-md md:hidden"
                        >
                          <ChevronRight className="fill-muted-foreground h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Next email</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <ThreadActionButton
                    icon={ChevronRight}
                    label="Next email"
                    onClick={handleNext}
                    className="hidden md:flex"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <NotesPanel threadId={id} />
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleToggleStar}
                        className="bg-popover inline-flex h-7 w-7 items-center justify-center gap-1 overflow-hidden rounded-md"
                      >
                        <Star
                          className={cn(
                            'ml-[2px] mt-[2.4px] h-5 w-5',
                            isStarred
                              ? 'fill-yellow-400 stroke-yellow-400'
                              : 'stroke-muted-foreground fill-transparent stroke-[1.5px]',
                          )}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {isStarred
                        ? t('common.threadDisplay.unstar')
                        : t('common.threadDisplay.star')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => moveThreadTo('archive')}
                        className="bg-popover inline-flex h-7 w-7 items-center justify-center gap-1 overflow-hidden rounded-md"
                      >
                        <Archive className="text-muted-foreground" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {t('common.threadDisplay.archive')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {!isInBin && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => moveThreadTo('bin')}
                          className="border-destructive-foreground/30 bg-destructive inline-flex h-7 w-7 items-center justify-center gap-1 overflow-hidden rounded-md border"
                        >
                          <Trash className="fill-destructive-foreground" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">{t('common.mail.moveToBin')}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="bg-popover inline-flex h-7 w-7 items-center justify-center gap-1 overflow-hidden rounded-md">
                      <ThreeDots className="fill-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {/* <DropdownMenuItem onClick={() => setIsFullscreen(!isFullscreen)}>
                      <Expand className="fill-iconLight dark:fill-iconDark mr-2" />
                      <span>
                        {isFullscreen
                          ? t('common.threadDisplay.exitFullscreen')
                          : t('common.threadDisplay.enterFullscreen')}
                      </span>
                    </DropdownMenuItem> */}

                    {isInSpam || isInArchive || isInBin ? (
                      <DropdownMenuItem onClick={() => moveThreadTo('inbox')}>
                        <Inbox className="mr-2 h-4 w-4" />
                        <span>{t('common.mail.moveToInbox')}</span>
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem onClick={() => moveThreadTo('spam')}>
                          <ArchiveX className="fill-muted-foreground mr-2" />
                          <span>{t('common.threadDisplay.moveToSpam')}</span>
                        </DropdownMenuItem>
                        {emailData.latest?.listUnsubscribe ||
                        emailData.latest?.listUnsubscribePost ? (
                          <DropdownMenuItem onClick={handleUnsubscribeProcess}>
                            <ShieldAlertIcon className="fill-muted-foreground mr-2" />
                            <span>Unsubscribe</span>
                          </DropdownMenuItem>
                        ) : null}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className={cn('flex min-h-0 flex-1 flex-col', isMobile && 'h-full')}>
              <ScrollArea
                className={cn('flex-1', isMobile ? 'h-[calc(100%-1px)]' : 'h-full')}
                type="auto"
              >
                <div className="pb-4">
                  {(emailData.messages || []).map((message, index) => (
                    <div
                      key={message.id}
                      className={cn(
                        'transition-all duration-200',
                        index > 0 && 'border-panelBorder border-t',
                        mode && activeReplyId === message.id && '',
                      )}
                    >
                      <MailDisplay
                        emailData={message}
                        isFullscreen={isFullscreen}
                        isMuted={false}
                        isLoading={false}
                        index={index}
                        totalEmails={emailData?.totalReplies}
                      />
                      {mode && activeReplyId === message.id && (
                        <div className="px-4 py-2" id={`reply-composer-${message.id}`}>
                          <ReplyCompose messageId={message.id} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {!isSidebarOpen && (
                <div className="fixed bottom-4 right-4 hidden md:block">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-10 w-10 rounded-md p-0"
                        onClick={toggleAISidebar}
                      >
                        <Image
                          src="/black-icon.svg"
                          alt="AI Assistant"
                          width={20}
                          height={20}
                          className="block dark:hidden"
                        />
                        <Image
                          src="/white-icon.svg"
                          alt="AI Assistant"
                          width={20}
                          height={20}
                          className="hidden dark:block"
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Toggle AI Assistant</TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
