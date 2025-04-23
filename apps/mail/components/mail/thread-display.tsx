import {
  Archive,
  ArchiveX,
  Expand,
  Forward,
  MailOpen,
  Reply,
  ReplyAll,
  X,
  Trash,
  MoreVertical,
  StickyNote,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useParams } from 'next/navigation';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { moveThreadsTo, ThreadDestination } from '@/lib/thread-actions';
import { useThread, useThreads } from '@/hooks/use-threads';
import { markAsRead, markAsUnread } from '@/actions/mail';
import { MailDisplaySkeleton } from './mail-skeleton';
import { Button } from '@/components/ui/button';
import { modifyLabels } from '@/actions/mail';
import { useStats } from '@/hooks/use-stats';
import ThreadSubject from './thread-subject';
import ReplyCompose from './reply-composer';
import { useTranslations } from 'next-intl';
import { useMail } from '../mail/use-mail';
import { NotesPanel } from './note-panel';
import { cn, FOLDERS } from '@/lib/utils';
import MailDisplay from './mail-display';
import { ParsedMessage } from '@/types';
import { Inbox } from 'lucide-react';
import { useQueryState } from 'nuqs';
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
  const [mail, setMail] = useMail();

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
            <Icon ref={iconRef} className="h-4 w-4" />
            <span className="sr-only">{label}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ThreadDisplay({ isMobile, id }: ThreadDisplayProps) {
  const { data: emailData, isLoading, mutate: mutateThread } = useThread(id ?? null);
  const { mutate: mutateThreads } = useThreads();
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [mail, setMail] = useMail();
  const t = useTranslations();
  const { mutate: mutateStats } = useStats();
  const { folder } = useParams<{ folder: string }>();
  const [threadId, setThreadId] = useQueryState('threadId');
  const [mode, setMode] = useQueryState('mode');

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
        .then(() => Promise.allSettled([mutateThread(), mutateStats()]));
    }
  }, [emailData, id]);

  const isInArchive = folder === FOLDERS.ARCHIVE;
  const isInSpam = folder === FOLDERS.SPAM;
  const isInBin = folder === FOLDERS.BIN;
  const handleClose = useCallback(() => {
    setThreadId(null);
    setMode(null);
  }, [setThreadId, setMode]);

  const moveThreadTo = useCallback(
    async (destination: ThreadDestination) => {
      if (!threadId) return;
      const promise = async () => {
        await moveThreadsTo({
          threadIds: [threadId],
          currentFolder: folder,
          destination,
        });
        await Promise.all([mutateStats(), mutateThreads()]);
        handleClose();
      };

      toast.promise(promise(), {
        loading: t('common.actions.moving'),
        success:
          destination === 'inbox'
            ? t('common.actions.movedToInbox')
            : destination === 'spam'
              ? t('common.actions.movedToSpam')
              : destination === 'bin'
                ? t('common.actions.movedToBin')
                : t('common.actions.archived'),
        error: t('common.actions.failedToMove'),
      });
    },
    [threadId, folder, mutateStats, mutateThreads, handleClose, t],
  );

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [handleClose]);

  if (!emailData || isLoading)
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
            <ScrollArea className="h-full flex-1" type="auto">
              <div className="pb-4">
                <MailDisplaySkeleton isFullscreen={isFullscreen} />
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    );

  return (
    <div
      className={cn(
        'flex flex-col',
        isFullscreen ? 'h-screen' : isMobile ? 'h-full' : 'h-[calc(100vh-2rem)]',
      )}
    >
      <div
        className={cn(
          'bg-offsetLight dark:bg-offsetDark relative flex flex-col transition-all duration-300',
          isMobile ? 'h-full' : 'h-full',
          !isMobile && !isFullscreen && 'rounded-r-lg',
          isFullscreen ? 'fixed inset-0 z-50' : '',
        )}
      >
        <div className="flex flex-shrink-0 items-center border-b px-1 pb-1 md:px-3 md:pb-1.5 md:pt-[10px]">
          <div className="flex flex-1 items-center gap-2">
            <ThreadActionButton icon={X} label={t('common.actions.close')} onClick={handleClose} />
            <ThreadSubject subject={emailData.latest?.subject} />
          </div>
          <div className="flex items-center md:gap-2">
            <ThreadActionButton
              icon={Reply}
              label={t('common.threadDisplay.reply')}
              disabled={!emailData}
              className={cn(mode === 'reply' && 'bg-primary/10')}
              onClick={() => {
                setMode('reply');
              }}
            />
            {hasMultipleParticipants && (
              <ThreadActionButton
                icon={ReplyAll}
                label={t('common.threadDisplay.replyAll')}
                disabled={!emailData}
                className={cn(mode === 'replyAll' && 'bg-primary/10')}
                onClick={() => {
                  setMode('replyAll');
                }}
              />
            )}
            <ThreadActionButton
              icon={Forward}
              label={t('common.threadDisplay.forward')}
              disabled={!emailData}
              className={cn(mode === 'forward' && 'bg-primary/10')}
              onClick={() => {
                setMode('forward');
              }}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">More actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* {threadId && (
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <StickyNote className="mr-2 h-4 w-4" />
                    <span>{t('common.notes.title')}</span>
                    <div className="absolute right-0 top-0" onClick={(e) => e.stopPropagation()}>
                      <NotesPanel threadId={threadId} />
                    </div>
                  </DropdownMenuItem>
                )} */}
                <DropdownMenuItem onClick={() => setIsFullscreen(!isFullscreen)}>
                  <Expand className="mr-2 h-4 w-4" />
                  <span>
                    {isFullscreen
                      ? t('common.threadDisplay.exitFullscreen')
                      : t('common.threadDisplay.enterFullscreen')}
                  </span>
                </DropdownMenuItem>
                {isInSpam || isInArchive || isInBin ? (
                  <DropdownMenuItem onClick={() => moveThreadTo('inbox')}>
                    <Inbox className="mr-2 h-4 w-4" />
                    <span>{t('common.mail.moveToInbox')}</span>
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => moveThreadTo('archive')}>
                      <Archive className="mr-2 h-4 w-4" />
                      <span>{t('common.threadDisplay.archive')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => moveThreadTo('spam')}>
                      <ArchiveX className="mr-2 h-4 w-4" />
                      <span>{t('common.threadDisplay.moveToSpam')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => moveThreadTo('bin')}>
                      <Trash className="mr-2 h-4 w-4" />
                      <span>{t('common.mail.moveToBin')}</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <ScrollArea className="h-full flex-1" type="auto">
            <div className="pb-4">
              {hasImages && !mail.showImages && (
                <div className="bg-warning/10 border-warning/20 m-4 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-warning text-sm">{t('common.mail.imagesHidden')}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMail((prev) => ({ ...prev, showImages: true }))}
                    >
                      {t('common.mail.showImages')}
                    </Button>
                  </div>
                </div>
              )}
              {(emailData.messages || []).map((message, index) => (
                <div
                  key={message.id}
                  className={cn(
                    'transition-all duration-200',
                    index > 0 && 'border-border border-t',
                  )}
                >
                  <MailDisplay
                    emailData={message}
                    isFullscreen={isFullscreen}
                    isMuted={isMuted}
                    isLoading={false}
                    index={index}
                    totalEmails={emailData?.totalReplies}
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className={cn('relative z-10 mt-3', isFullscreen ? 'mb-2' : '')}>
            <ReplyCompose />
          </div>
        </div>
      </div>
    </div>
  );
}
