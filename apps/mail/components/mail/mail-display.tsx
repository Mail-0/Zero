import {
  Bell,
  Calendar,
  Docx,
  Figma,
  Forward,
  ImageFile,
  Lightning,
  PDF,
  Reply,
  ReplyAll,
  Tag,
  User,
  ChevronDown,
} from '../icons/icons';
import {
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogClose,
} from '../ui/dialog';
import { memo, useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { Briefcase, Star, StickyNote, Users, Lock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { handleUnsubscribe } from '@/lib/email-utils.client';
import { getListUnsubscribeAction } from '@/lib/email-utils';
import AttachmentsAccordion from './attachments-accordion';
import { cn, getEmailLogo, formatDate } from '@/lib/utils';
import { useBrainState } from '../../hooks/use-summary';
import { useThreadLabels } from '@/hooks/use-labels';
import type { Sender, ParsedMessage } from '@/types';
import { Markdown } from '@react-email/components';
import AttachmentDialog from './attachment-dialog';
import { useSummary } from '@/hooks/use-summary';
import { TextShimmer } from '../ui/text-shimmer';
import { useSession } from '@/lib/auth-client';
import { RenderLabels } from './render-labels';
import ReplyCompose from './reply-composer';
import { Separator } from '../ui/separator';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MailIframe } from './mail-iframe';
import { MailLabels } from './mail-list';
import { FileText } from 'lucide-react';
import { format, set } from 'date-fns';
import { Button } from '../ui/button';
import { useQueryState } from 'nuqs';
import { Badge } from '../ui/badge';
import Image from 'next/image';

// Add formatFileSize utility function
const formatFileSize = (size: number) => {
  const sizeInMB = (size / (1024 * 1024)).toFixed(2);
  return sizeInMB === '0.00' ? '' : `${sizeInMB} MB`;
};

// Add getFileIcon utility function
const getFileIcon = (filename: string) => {
  const extension = filename.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return <PDF className="fill-[#F43F5E]" />;
    case 'jpg':
      return <ImageFile />;
    case 'jpeg':
      return <ImageFile />;
    case 'png':
      return <ImageFile />;
    case 'gif':
      return <ImageFile />;
    case 'docx':
      return <Docx />;
    case 'fig':
      return <Figma />;
    case 'webp':
      return <ImageFile />;
    default:
      return <FileText className="h-4 w-4 text-[#8B5CF6]" />;
  }
};

const StreamingText = ({ text }: { text: string }) => {
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    let currentIndex = 0;
    setIsComplete(false);
    setIsThinking(true);

    const thinkingTimeout = setTimeout(() => {
      setIsThinking(false);
      setDisplayText('');

      const interval = setInterval(() => {
        if (currentIndex < text.length) {
          const nextChar = text[currentIndex];
          setDisplayText((prev) => prev + nextChar);
          currentIndex++;
        } else {
          setIsComplete(true);
          clearInterval(interval);
        }
      }, 20);

      return () => clearInterval(interval);
    }, 1000);

    return () => {
      clearTimeout(thinkingTimeout);
    };
  }, [text]);

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'bg-gradient-to-r from-neutral-500 via-neutral-300 to-neutral-500 bg-[length:200%_100%] bg-clip-text text-sm leading-relaxed text-transparent',
          isComplete ? 'animate-shine-slow' : '',
        )}
      >
        {isThinking ? (
          <TextShimmer duration={1}>Thinking...</TextShimmer>
        ) : (
          <span>{displayText}</span>
        )}
        {!isComplete && !isThinking && (
          <span className="animate-blink bg-primary ml-0.5 inline-block h-4 w-0.5"></span>
        )}
      </div>
    </div>
  );
};

type Props = {
  emailData: ParsedMessage;
  isFullscreen: boolean;
  isMuted: boolean;
  isLoading: boolean;
  index: number;
  totalEmails?: number;
  demo?: boolean;
  subject?: string;
  onReply?: () => void;
  onReplyAll?: () => void;
  onForward?: () => void;
};

const MailDisplayLabels = ({ labels }: { labels: string[] }) => {
  const visibleLabels = labels.filter(
    (label) => !['unread', 'inbox'].includes(label.toLowerCase()),
  );

  if (!visibleLabels.length) return null;

  return (
    <div className="flex">
      {visibleLabels.map((label, index) => {
        const normalizedLabel = label.toLowerCase().replace(/^category_/i, '');

        let icon = null;
        let bgColor = '';

        switch (normalizedLabel) {
          case 'important':
            icon = <Lightning className="h-3.5 w-3.5 fill-white" />;
            bgColor = 'bg-[#F59E0D]';
            break;
          case 'promotions':
            icon = <Tag className="h-3.5 w-3.5 fill-white" />;
            bgColor = 'bg-[#F43F5E]';
            break;
          case 'personal':
            icon = <User className="h-3.5 w-3.5 fill-white" />;
            bgColor = 'bg-[#39AE4A]';
            break;
          case 'updates':
            icon = <Bell className="h-3.5 w-3.5 fill-white" />;
            bgColor = 'bg-[#8B5CF6]';
            break;
          case 'work':
            icon = <Briefcase className="h-3.5 w-3.5 text-white" />;
            bgColor = 'bg-neutral-600';
            break;
          case 'forums':
            icon = <Users className="h-3.5 w-3.5 text-white" />;
            bgColor = 'bg-blue-600';
            break;
          case 'notes':
            icon = <StickyNote className="h-3.5 w-3.5 text-white" />;
            bgColor = 'bg-amber-500';
            break;
          case 'starred':
            icon = <Star className="h-3.5 w-3.5 text-white" />;
            bgColor = 'bg-yellow-500';
            break;
          default:
            return null;
        }

        return (
          <Badge
            key={`${label}-${index}`}
            className={`rounded-md p-1 ${bgColor} border-panel -ml-1.5 border-2 transition-transform first:ml-0`}
          >
            {icon}
          </Badge>
        );
      })}
    </div>
  );
};

// Helper function to get first letter character
const getFirstLetterCharacter = (name?: string) => {
  if (!name) return '';
  const match = name.match(/[a-zA-Z]/);
  return match ? match[0].toUpperCase() : '';
};

// Helper function to clean email display
const cleanEmailDisplay = (email?: string) => {
  if (!email) return '';
  const match = email.match(/^[^a-zA-Z]*(.*?)[^a-zA-Z]*$/);
  return match ? match[1] : email;
};

// Helper function to clean name display
const cleanNameDisplay = (name?: string) => {
  if (!name) return '';
  return name.trim();
};

const AiSummary = () => {
  const [threadId] = useQueryState('threadId');
  const { data: summary, isLoading } = useSummary(threadId ?? null);
  const [showSummary, setShowSummary] = useState(false);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSummary(!showSummary);
  };

  if (isLoading) return null;
  if (!summary?.short?.length) return null;

  return (
    <div
      className="border-panelBorder mt-2 max-w-3xl rounded-xl border bg-white px-4 py-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex cursor-pointer items-center" onClick={handleToggle}>
        <TextShimmer className="text-xs font-medium text-[#929292]">Summary</TextShimmer>

        {!isLoading && (
          <ChevronDown
            className={`ml-1 h-2.5 w-2.5 fill-[#929292] transition-transform ${showSummary ? 'rotate-180' : ''}`}
          />
        )}
      </div>
      {showSummary && (
        <Markdown markdownContainerStyles={{ fontSize: 12 }}>{summary?.short || ''}</Markdown>
      )}
    </div>
  );
};

const MailDisplay = ({ emailData, index, totalEmails, demo }: Props) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [unsubscribed, setUnsubscribed] = useState(false);
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);
  const [preventCollapse, setPreventCollapse] = useState(false);
  const { folder } = useParams<{ folder: string }>();
  const [selectedAttachment, setSelectedAttachment] = useState<null | {
    id: string;
    name: string;
    type: string;
    url: string;
  }>(null);
  const [openDetailsPopover, setOpenDetailsPopover] = useState<boolean>(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const t = useTranslations();
  const [activeReplyId, setActiveReplyId] = useQueryState('activeReplyId');
  const { data: session } = useSession();
  const { labels: threadLabels } = useThreadLabels(
    emailData.tags ? emailData.tags.map((l) => l.id) : [],
  );
  const { data: brainState } = useBrainState();

  useEffect(() => {
    if (!demo) {
      if (activeReplyId === emailData.id) {
        setIsCollapsed(false);
      } else {
        setIsCollapsed(activeReplyId ? true : totalEmails ? index !== totalEmails - 1 : false);
      }
      // Set all emails to collapsed by default except the last one
      if (totalEmails && index === totalEmails - 1) {
        if (totalEmails > 5) {
          setTimeout(() => {
            const element = document.getElementById(`mail-${emailData.id}`);
            element?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      }
    }
  }, [index, activeReplyId, emailData.id, totalEmails, demo]);

  const listUnsubscribeAction = useMemo(
    () =>
      emailData.listUnsubscribe
        ? getListUnsubscribeAction({
            listUnsubscribe: emailData.listUnsubscribe,
            listUnsubscribePost: emailData.listUnsubscribePost,
          })
        : undefined,
    [emailData.listUnsubscribe, emailData.listUnsubscribePost],
  );

  const _handleUnsubscribe = async () => {
    setIsUnsubscribing(true);
    try {
      await handleUnsubscribe({
        emailData,
      });
      setIsUnsubscribing(false);
      setUnsubscribed(true);
    } catch (e) {
      setIsUnsubscribing(false);
      setUnsubscribed(false);
    }
  };

  const [mode, setMode] = useQueryState('mode');

  // Clear any pending timeouts when component unmounts
  useEffect(() => {
    return () => {
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current);
      }
    };
  }, []);

  // Function to handle popover state changes
  const handlePopoverChange = useCallback((open: boolean) => {
    setOpenDetailsPopover(open);

    if (!open) {
      // When closing the popover, prevent collapse for a short time
      setPreventCollapse(true);

      // Clear any existing timeout
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current);
      }

      // Set a timeout to allow collapse again after a delay
      collapseTimeoutRef.current = setTimeout(() => {
        setPreventCollapse(false);
      }, 300);
    }
  }, []);

  // Handle email collapse toggle
  const toggleCollapse = useCallback(() => {
    // Only toggle if we're not in prevention mode
    if (!preventCollapse && !openDetailsPopover) {
      setIsCollapsed(!isCollapsed);
    }
  }, [isCollapsed, preventCollapse, openDetailsPopover]);

  const renderPerson = useCallback(
    (person: Sender) => (
      <Popover key={person.email}>
        <PopoverTrigger asChild>
          <div
            key={person.email}
            className="border-muted-foreground/30 bg-muted/40 inline-flex items-center justify-start gap-1.5 overflow-hidden rounded-full border p-1 pr-2"
          >
            <Avatar className="h-5 w-5">
              <AvatarImage src={getEmailLogo(person.email)} className="rounded-full" />
              <AvatarFallback className="text-muted-foreground rounded-full text-xs font-bold">
                {getFirstLetterCharacter(person.name || person.email)}
              </AvatarFallback>
            </Avatar>
            <div className="text-muted-foreground justify-start text-sm font-medium leading-none">
              {person.name || person.email}
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent className="text-sm">
          <p>Email: {person.email}</p>
          <p>Name: {person.name || 'Unknown'}</p>
        </PopoverContent>
      </Popover>
    ),
    [],
  );

  const people = useMemo(() => {
    if (!session?.activeConnection) return [];
    const allPeople = [
      ...(folder === 'sent' ? [] : [emailData.sender]),
      ...(emailData.to || []),
      ...(emailData.cc || []),
      ...(emailData.bcc || []),
    ];
    return allPeople.filter(
      (p): p is Sender =>
        Boolean(p?.email) &&
        p.email !== session.activeConnection!.email &&
        p.name !== 'No Sender Name' &&
        p === allPeople.find((other) => other?.email === p?.email),
    );
  }, [emailData]);

  return (
    <div
      className={cn('relative flex-1 overflow-hidden')}
      id={`mail-${emailData.id}`}
      onClick={(e) => {
        if (openDetailsPopover) {
          e.stopPropagation();
        }
      }}
    >
      <div className="relative h-full overflow-y-auto">
        <div className={cn('px-4', index === 0 && 'border-b py-4')}>
          {index === 0 && (
            <>
              <span className="text-foreground inline-flex items-center gap-2 font-medium">
                <span>
                  {emailData.subject}{' '}
                  <span className="text-[#6D6D6D] dark:text-[#8C8C8C]">
                    {totalEmails && totalEmails > 1 && `[${totalEmails}]`}
                  </span>
                </span>
                {emailData?.tags ? (
                  <MailDisplayLabels labels={emailData?.tags.map((t) => t.name) || []} />
                ) : null}
              </span>
              <div className="mt-2 flex items-center gap-4">
                <RenderLabels labels={threadLabels} />
                {threadLabels.length ? (
                  <div className="bg-iconLight dark:bg-iconDark/20 relative h-3 w-0.5 rounded-full" />
                ) : null}
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  {(() => {
                    if (people.length <= 2) {
                      return people.map(renderPerson);
                    }

                    // Only show first two people plus count if we have at least two people
                    const firstPerson = people[0];
                    const secondPerson = people[1];

                    if (firstPerson && secondPerson) {
                      return (
                        <>
                          {renderPerson(firstPerson)}
                          {renderPerson(secondPerson)}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm">
                                +{people.length - 2} {people.length - 2 === 1 ? 'other' : 'others'}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="flex flex-col gap-1">
                              {people.slice(2).map((person, index) => (
                                <div key={index}>{renderPerson(person)}</div>
                              ))}
                            </TooltipContent>
                          </Tooltip>
                        </>
                      );
                    }

                    return null;
                  })()}
                </div>
              </div>
              {brainState?.enabled && <AiSummary />}
            </>
          )}
        </div>
        <div
          className="flex cursor-pointer flex-col pb-2 transition-all duration-200"
          onClick={toggleCollapse}
        >
          <div className="mt-3 flex w-full items-start justify-between gap-4 px-4">
            <div className="flex w-full justify-center gap-4">
              <Avatar className="mt-3 h-8 w-8 rounded-full border dark:border-none">
                <AvatarImage
                  className="rounded-full"
                  src={getEmailLogo(emailData?.sender?.email)}
                />
                <AvatarFallback className="rounded-full font-bold">
                  {getFirstLetterCharacter(emailData?.sender?.name)}
                </AvatarFallback>
              </Avatar>

              <div className="flex w-full items-center justify-between">
                <div className="flex w-full items-center justify-start">
                  <div className="flex w-full flex-col">
                    <div className="flex w-full items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold">
                          {cleanNameDisplay(emailData?.sender?.name)}
                        </span>
                        <Popover open={openDetailsPopover} onOpenChange={handlePopoverChange}>
                          <PopoverTrigger asChild>
                            <button
                              className="hover:bg-muted/50 flex items-center gap-2 rounded-md p-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setOpenDetailsPopover(!openDetailsPopover);
                              }}
                              ref={triggerRef}
                            >
                              <p className="text-muted-foreground text-xs underline">Details</p>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="align-items-start w-[420px] rounded-lg border p-3 text-left shadow-lg"
                            onBlur={(e) => {
                              if (!triggerRef.current?.contains(e.relatedTarget)) {
                                setOpenDetailsPopover(false);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="space-y-1 text-sm">
                              <div className="flex">
                                <span className="text-muted-foreground/60 w-24 text-end">
                                  {t('common.mailDisplay.from')}:
                                </span>
                                <div className="ml-3">
                                  <span className="text-muted-foreground pr-1 font-bold">
                                    {cleanNameDisplay(emailData?.sender?.name)}
                                  </span>
                                  {emailData?.sender?.name !== emailData?.sender?.email && (
                                    <span className="text-muted-foreground">
                                      {cleanEmailDisplay(emailData?.sender?.email)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex">
                                <span className="text-muted-foreground/60 w-24 text-end">
                                  {t('common.mailDisplay.to')}:
                                </span>
                                <span className="text-muted-foreground ml-3">
                                  {emailData?.to?.map((t) => cleanEmailDisplay(t.email)).join(', ')}
                                </span>
                              </div>
                              {emailData?.cc && emailData.cc.length > 0 && (
                                <div className="flex">
                                  <span className="text-muted-foreground/60 w-24 text-end">
                                    {t('common.mailDisplay.cc')}:
                                  </span>
                                  <span className="text-muted-foreground ml-3">
                                    {emailData?.cc
                                      ?.map((t) => cleanEmailDisplay(t.email))
                                      .join(', ')}
                                  </span>
                                </div>
                              )}
                              {emailData?.bcc && emailData.bcc.length > 0 && (
                                <div className="flex">
                                  <span className="text-muted-foreground/60 w-24 text-end">
                                    {t('common.mailDisplay.bcc')}:
                                  </span>
                                  <span className="text-muted-foreground ml-3">
                                    {emailData?.bcc
                                      ?.map((t) => cleanEmailDisplay(t.email))
                                      .join(', ')}
                                  </span>
                                </div>
                              )}
                              <div className="flex">
                                <span className="text-muted-foreground/60 w-24 text-end">
                                  {t('common.mailDisplay.date')}:
                                </span>
                                <span className="text-muted-foreground ml-3">
                                  {format(new Date(emailData?.receivedOn), 'PPpp')}
                                </span>
                              </div>
                              <div className="flex">
                                <span className="text-muted-foreground/60 w-24 text-end">
                                  {t('common.mailDisplay.mailedBy')}:
                                </span>
                                <span className="text-muted-foreground ml-3">
                                  {cleanEmailDisplay(emailData?.sender?.email)}
                                </span>
                              </div>
                              <div className="flex">
                                <span className="text-muted-foreground/60 w-24 text-end">
                                  {t('common.mailDisplay.signedBy')}:
                                </span>
                                <span className="text-muted-foreground ml-3">
                                  {cleanEmailDisplay(emailData?.sender?.email)}
                                </span>
                              </div>
                              {emailData.tls && (
                                <div className="flex items-center">
                                  <span className="text-muted-foreground/60 w-24 text-end">
                                    {t('common.mailDisplay.security')}:
                                  </span>
                                  <div className="text-muted-foreground ml-3 flex items-center gap-1">
                                    <Lock className="h-4 w-4 text-green-600" />{' '}
                                    {t('common.mailDisplay.standardEncryption')}
                                  </div>
                                </div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <time className="text-muted-foreground text-sm font-medium">
                        {formatDate(emailData?.receivedOn)}
                      </time>
                    </div>
                    <div className="flex items-center gap-1 pb-2">
                      <p className="text-muted-foreground text-sm font-medium">
                        To:{' '}
                        {(() => {
                          // Combine to and cc recipients
                          const allRecipients = [
                            ...(emailData?.to || []),
                            ...(emailData?.cc || []),
                          ];

                          // If you're the only recipient
                          if (allRecipients.length === 1 && folder !== 'sent') {
                            return <span key="you">You</span>;
                          }

                          // Show first 3 recipients + count of others
                          const visibleRecipients = allRecipients.slice(0, 3);
                          const remainingCount = allRecipients.length - 3;

                          return (
                            <>
                              {visibleRecipients.map((recipient, index) => (
                                <span key={recipient.email}>
                                  {cleanNameDisplay(recipient.name) ||
                                    cleanEmailDisplay(recipient.email)}
                                  {index < visibleRecipients.length - 1 ? ', ' : ''}
                                </span>
                              ))}
                              {remainingCount > 0 && (
                                <span key="others">{`, +${remainingCount} others`}</span>
                              )}
                            </>
                          );
                        })()}
                      </p>
                      {(emailData?.bcc?.length || 0) > 0 && (
                        <p className="text-muted-foreground text-sm font-medium">
                          Bcc:{' '}
                          {emailData?.bcc?.map((recipient, index) => (
                            <span key={recipient.email}>
                              {cleanNameDisplay(recipient.name) ||
                                cleanEmailDisplay(recipient.email)}
                              {index < (emailData?.bcc?.length || 0) - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  </div>

                  <span className="text-muted-foreground flex grow-0 items-center gap-2 text-sm">
                    {/* <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                      {emailData?.sender?.email}
                    </span> */}

                    {/* {listUnsubscribeAction && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="xs"
                            variant="secondary"
                            disabled={unsubscribed || isUnsubscribing}
                          >
                            {unsubscribed && <Check className="h-4 w-4" />}
                            {isUnsubscribing && (
                              <LoaderCircleIcon className="h-4 w-4 animate-spin" />
                            )}
                            {unsubscribed
                              ? t('common.mailDisplay.unsubscribed')
                              : t('common.mailDisplay.unsubscribe')}
                          </Button>
                        </DialogTrigger>

                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t('common.mailDisplay.unsubscribe')}</DialogTitle>
                            <DialogDescription className="break-words">
                              {t('common.mailDisplay.unsubscribeDescription')}
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter className="gap-2">
                            <DialogClose asChild>
                              <Button disabled={isUnsubscribing} variant="outline">
                                {t('common.mailDisplay.cancel')}
                              </Button>
                            </DialogClose>
                            <DialogClose asChild>
                              <Button disabled={isUnsubscribing} onClick={_handleUnsubscribe}>
                                {t('common.mailDisplay.unsubscribe')}
                              </Button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                    {isMuted && <BellOff className="h-4 w-4" />} */}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className={cn(
            'h-0 overflow-hidden transition-all duration-200',
            !isCollapsed && 'h-[1px]',
          )}
        ></div>

        <div
          className={cn(
            'grid overflow-hidden transition-all duration-200',
            isCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="h-fit w-full p-0">
              {emailData?.decodedBody ? (
                <MailIframe html={emailData?.decodedBody} senderEmail={emailData.sender.email} />
              ) : (
                <div
                  className="flex h-[500px] w-full items-center justify-center"
                  style={{ minHeight: '500px' }}
                >
                  <div className="bg-secondary h-32 w-32 animate-pulse rounded-full" />
                </div>
              )}
              {emailData?.attachments && emailData?.attachments.length > 0 ? (
                <div className="mb-4 flex flex-wrap items-center gap-2 px-4 pt-4">
                  {emailData?.attachments.map((attachment, index) => (
                    <div key={index}>
                      <button
                        className="bg-muted/50 hover:bg-muted flex h-7 items-center gap-1 rounded-[5px] border px-4 text-sm font-medium"
                        onClick={() => {
                          try {
                            // Convert base64 to blob
                            const byteCharacters = atob(attachment.body);
                            const byteNumbers = new Array(byteCharacters.length);
                            for (let i = 0; i < byteCharacters.length; i++) {
                              byteNumbers[i] = byteCharacters.charCodeAt(i);
                            }
                            const byteArray = new Uint8Array(byteNumbers);
                            const blob = new Blob([byteArray], { type: attachment.mimeType });

                            // Create object URL and trigger download
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = attachment.filename;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                          } catch (error) {
                            console.error('Error downloading attachment:', error);
                          }
                        }}
                      >
                        {getFileIcon(attachment.filename)}
                        <span className="text-foreground max-w-[15ch] truncate text-sm">
                          {attachment.filename}
                        </span>{' '}
                        <span className="text-muted-foreground/60 whitespace-nowrap text-sm">
                          {formatFileSize(attachment.size)}
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mb-2 mt-2 flex gap-2 px-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMode('reply');
                    setActiveReplyId(emailData.id);
                  }}
                  className="dark:bg-muted inline-flex h-7 items-center justify-center gap-1 overflow-hidden rounded-md border px-1.5 dark:border-none"
                >
                  <Reply className="fill-muted-foreground" />
                  <div className="flex items-center justify-center gap-2.5 pl-0.5 pr-1">
                    <div className="text-foreground justify-start text-sm leading-none">Reply</div>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMode('replyAll');
                    setActiveReplyId(emailData.id);
                  }}
                  className="dark:bg-muted inline-flex h-7 items-center justify-center gap-1 overflow-hidden rounded-md border px-1.5 dark:border-none"
                >
                  <ReplyAll className="fill-muted-foreground" />
                  <div className="flex items-center justify-center gap-2.5 pl-0.5 pr-1">
                    <div className="text-foreground justify-start text-sm leading-none">
                      Reply All
                    </div>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMode('forward');
                    setActiveReplyId(emailData.id);
                  }}
                  className="dark:bg-muted inline-flex h-7 items-center justify-center gap-1 overflow-hidden rounded-md border px-1.5 dark:border-none"
                >
                  <Forward className="fill-muted-foreground" />
                  <div className="flex items-center justify-center gap-2.5 pl-0.5 pr-1">
                    <div className="text-foreground justify-start text-sm leading-none">
                      Forward
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(MailDisplay);
