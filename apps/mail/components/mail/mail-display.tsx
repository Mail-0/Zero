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
import { Briefcase, Star, StickyNote, Users, Lock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { handleUnsubscribe } from '@/lib/email-utils.client';
import { getListUnsubscribeAction } from '@/lib/email-utils';
import AttachmentsAccordion from './attachments-accordion';
import { cn, getEmailLogo, formatDate } from '@/lib/utils';
import AttachmentDialog from './attachment-dialog';
import { useSummary } from '@/hooks/use-summary';
import { TextShimmer } from '../ui/text-shimmer';
import { type ParsedMessage } from '@/types';
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

const getAttachmentType = (mimeType: string): string => {
  // Return exact strings that AttachmentDialog expects
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'excel';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'word';
  return 'other';
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
  setSelectedAttachment: (attachment: null | {
    id: string;
    name: string;
    type: string;
    url: string;
  }) => void;
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
            className={`rounded-md p-1 ${bgColor} -ml-1.5 border-2 border-white transition-transform first:ml-0 dark:border-[#1A1A1A]`}
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

const AiSummary = ({
  onClick,
  e,
}: {
  onClick?: (e: React.MouseEvent) => void;
  e?: React.MouseEvent;
}) => {
  const [showSummary, setShowSummary] = useState(true);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event from bubbling up
    setShowSummary(!showSummary);
  };

  return (
    <div
      className="mt-5 max-w-3xl rounded-xl border border-[#8B5CF6] bg-white p-3 dark:bg-[#252525]"
      onClick={(e) => e.stopPropagation()} // Prevent clicks from collapsing email
    >
      <div className="flex cursor-pointer items-center" onClick={handleToggle}>
        <p className="text-sm font-medium text-[#929292]">AI Summary</p>
        <ChevronDown
          className={`ml-1 h-2.5 w-2.5 fill-[#929292] transition-transform ${showSummary ? '' : 'rotate-180'}`}
        />
      </div>
      {showSummary && (
        <div className="mt-2 text-sm text-black dark:text-white">
          Design review of new email client features. Team discussed command center improvements and
          category system. General positive feedback, with suggestions for quick actions placement.
        </div>
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

  console.warn(emailData, 'emailData');

  useEffect(() => {
    if (!demo) {
      // Set all emails to collapsed by default except the last one
      setIsCollapsed(totalEmails ? index !== totalEmails - 1 : false);
      if (totalEmails && index === totalEmails - 1) {
        if (totalEmails > 5) {
          setTimeout(() => {
            const element = document.getElementById(`mail-${emailData.id}`);
            element?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      }
    }
  }, [index, emailData.id, totalEmails, demo]);

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
              <p className="font-medium text-black dark:text-white">
                {emailData.subject}{' '}
                <span className="text-[#6D6D6D] dark:text-[#8C8C8C]">
                  {totalEmails && `[${totalEmails}]`}
                </span>
              </p>
              <div className="mt-2 flex items-center gap-4">
                {emailData?.tags ? (
                  <MailDisplayLabels labels={emailData?.tags.map((t) => t.name) || []} />
                ) : null}
                <div className="bg-iconLight dark:bg-iconDark/20 relative h-3 w-0.5 rounded-full" />
                <div className="flex items-center gap-2 text-sm text-[#6D6D6D] dark:text-[#8C8C8C]">
                  {(() => {
                    interface Person {
                      name: string;
                      email: string;
                    }

                    const allPeople = [
                      ...(folder === 'sent' ? [] : [emailData.sender]),
                      ...(emailData.to || []),
                      ...(emailData.cc || []),
                      ...(emailData.bcc || []),
                    ];

                    const people = allPeople.filter(
                      (p): p is Person =>
                        Boolean(p?.email) &&
                        p.name !== 'No Sender Name' &&
                        p === allPeople.find((other) => other?.email === p?.email),
                    );

                    const renderPerson = (person: Person) => (
                      <div
                        key={person.email}
                        className="inline-flex items-center justify-start gap-1.5 overflow-hidden rounded-full border border-[#DBDBDB] bg-white p-1 pr-2 dark:border-[#2B2B2B] dark:bg-[#1A1A1A]"
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={getEmailLogo(person.email)} className="rounded-full" />
                          <AvatarFallback className="rounded-full bg-[#F5F5F5] text-xs font-bold dark:bg-[#373737]">
                            {getFirstLetterCharacter(person.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="justify-start text-sm font-medium leading-none text-[#1A1A1A] dark:text-white">
                          {person.name || person.email}
                        </div>
                      </div>
                    );

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
                          <span className="text-sm">
                            +{people.length - 2} {people.length - 2 === 1 ? 'other' : 'others'}
                          </span>
                        </>
                      );
                    }

                    return null;
                  })()}
                </div>
              </div>
              {/* <AiSummary /> */}
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
                <AvatarFallback className="rounded-full bg-[#FFFFFF] font-bold text-[#9F9F9F] dark:bg-[#373737]">
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
                              className="hover:bg-iconLight dark:hover:bg-iconDark/20 flex items-center gap-2 rounded-md p-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setOpenDetailsPopover(!openDetailsPopover);
                              }}
                              ref={triggerRef}
                            >
                              <p className="text-xs text-[#6D6D6D] underline dark:text-[#8C8C8C]">
                                Details
                              </p>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="align-items-start w-[420px] rounded-lg border p-3 text-left shadow-lg dark:bg-[#1A1A1A]"
                            onBlur={(e) => {
                              if (!triggerRef.current?.contains(e.relatedTarget)) {
                                setOpenDetailsPopover(false);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="space-y-1 text-sm">
                              <div className="flex">
                                <span className="w-24 text-end text-gray-500">
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
                                <span className="w-24 text-end text-gray-500">
                                  {t('common.mailDisplay.to')}:
                                </span>
                                <span className="text-muted-foreground ml-3">
                                  {emailData?.to?.map((t) => cleanEmailDisplay(t.email)).join(', ')}
                                </span>
                              </div>
                              {emailData?.cc && emailData.cc.length > 0 && (
                                <div className="flex">
                                  <span className="w-24 text-end text-gray-500">
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
                                  <span className="w-24 text-end text-gray-500">
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
                                <span className="w-24 text-end text-gray-500">
                                  {t('common.mailDisplay.date')}:
                                </span>
                                <span className="text-muted-foreground ml-3">
                                  {format(new Date(emailData?.receivedOn), 'PPpp')}
                                </span>
                              </div>
                              <div className="flex">
                                <span className="w-24 text-end text-gray-500">
                                  {t('common.mailDisplay.mailedBy')}:
                                </span>
                                <span className="text-muted-foreground ml-3">
                                  {cleanEmailDisplay(emailData?.sender?.email)}
                                </span>
                              </div>
                              <div className="flex">
                                <span className="w-24 text-end text-gray-500">
                                  {t('common.mailDisplay.signedBy')}:
                                </span>
                                <span className="text-muted-foreground ml-3">
                                  {cleanEmailDisplay(emailData?.sender?.email)}
                                </span>
                              </div>
                              {emailData.tls && (
                                <div className="flex items-center">
                                  <span className="w-24 text-end text-gray-500">
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

                      <time className="text-sm font-medium text-[#6D6D6D] dark:text-[#8C8C8C]">
                        {formatDate(emailData?.receivedOn)}
                      </time>
                    </div>
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-medium text-[#6D6D6D] dark:text-[#8C8C8C]">
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
                        <p className="text-sm font-medium text-[#6D6D6D] dark:text-[#8C8C8C]">
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
            <div className="h-fit w-full p-0 px-4">
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
                <div className="mb-4 flex items-center gap-2 pt-4">
                  {emailData?.attachments.map((attachment, index) => (
                    <div key={index}>
                      <button
                        className="dark: flex h-7 items-center gap-1 rounded-[5px] border bg-[#FAFAFA] px-4 text-sm font-medium hover:bg-[#F0F0F0] dark:bg-[#262626] dark:hover:bg-[#303030]"
                        onClick={() => {
                          // Handle attachment preview
                          const attachmentType = getAttachmentType(attachment.mimeType);
                          try {
                            // Convert base64 to blob for all attachments
                            const byteCharacters = atob(attachment.body);
                            const byteNumbers = new Array(byteCharacters.length);
                            for (let i = 0; i < byteCharacters.length; i++) {
                              byteNumbers[i] = byteCharacters.charCodeAt(i);
                            }
                            const byteArray = new Uint8Array(byteNumbers);
                            const blob = new Blob([byteArray], { type: attachment.mimeType });
                            const blobUrl = URL.createObjectURL(blob);
                            // const link = document.createElement('a');
                            // link.href = blobUrl;
                            // document.body.appendChild(link);
                            // link.click();
                            // document.body.removeChild(link);
                            // window.URL.revokeObjectURL(blobUrl);

                            setSelectedAttachment({
                              id: attachment.attachmentId,
                              name: attachment.filename,
                              type: attachmentType,
                              url: blobUrl
                            });
                          } catch (error) {
                            console.error("Error handling attachment:", error);
                          }
                        }
                        }
                      >
                        {getFileIcon(attachment.filename)}
                        <span className="text-black dark:text-white">
                          {attachment.filename}
                        </span>{' '}
                        <span className="text-[#6D6D6D] dark:text-[#929292]">
                          {formatFileSize(attachment.size)}
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mb-2 mt-2 flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMode('reply');
                    setActiveReplyId(emailData.id);
                  }}
                  className="inline-flex h-7 items-center justify-center gap-1 overflow-hidden rounded-md border bg-white px-1.5 dark:border-none dark:bg-[#313131]"
                >
                  <Reply className="fill-[#6D6D6D] dark:fill-[#9B9B9B]" />
                  <div className="flex items-center justify-center gap-2.5 pl-0.5 pr-1">
                    <div className="justify-start text-sm leading-none text-black dark:text-white">
                      Reply
                    </div>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMode('replyAll');
                    setActiveReplyId(emailData.id);
                  }}
                  className="inline-flex h-7 items-center justify-center gap-1 overflow-hidden rounded-md border bg-white px-1.5 dark:border-none dark:bg-[#313131]"
                >
                  <ReplyAll className="fill-[#6D6D6D] dark:fill-[#9B9B9B]" />
                  <div className="flex items-center justify-center gap-2.5 pl-0.5 pr-1">
                    <div className="justify-start text-sm leading-none text-black dark:text-white">
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
                  className="inline-flex h-7 items-center justify-center gap-1 overflow-hidden rounded-md border bg-white px-1.5 dark:border-none dark:bg-[#313131]"
                >
                  <Forward className="fill-[#6D6D6D] dark:fill-[#9B9B9B]" />
                  <div className="flex items-center justify-center gap-2.5 pl-0.5 pr-1">
                    <div className="justify-start text-sm leading-none text-black dark:text-white">
                      Forward
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <AttachmentDialog
        selectedAttachment={selectedAttachment}
        setSelectedAttachment={setSelectedAttachment}
      />
    </div >
  );
};

export default memo(MailDisplay);