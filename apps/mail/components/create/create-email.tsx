//create-email NEW
'use client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UploadedFileIcon } from '@/components/create/uploaded-file-icon';
import { useEmailAliases } from '@/hooks/use-email-aliases';
import { useConnections } from '@/hooks/use-connections';
import { useHotkeysContext } from 'react-hotkeys-hook';
import { Separator } from '@/components/ui/separator';
import { useMail } from '@/components/mail/use-mail';
import { DialogClose } from '@/components/ui/dialog';
import { useSettings } from '@/hooks/use-settings';
import { EmailComposer } from './email-composer';
import { useSession } from '@/lib/auth-client';
import { truncateFileName } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useDraft } from '@/hooks/use-drafts';
import { useTranslations } from 'next-intl';
import { sendEmail } from '@/actions/send';
import { useQueryState } from 'nuqs';
import { Plus, Paperclip, ArrowUp as ArrowUpIcon } from 'lucide-react';
import { X } from '../icons/icons';
import posthog from 'posthog-js';
import { toast } from 'sonner';
import * as React from 'react';
import './prosemirror.css';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SidebarToggle } from '@/components/ui/sidebar-toggle';
import { createDraft, getDraft } from '@/actions/drafts';

// Define JSONContent type
interface JSONContent {
  type: string;
  content?: JSONContent[];
  text?: string;
  [key: string]: any;
}

const MAX_VISIBLE_ATTACHMENTS = 12;

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Add a more lenient check for partial emails
const isPartialEmail = (email: string): boolean => {
  return email.includes('@');
};

const createEmptyDocContent = (): JSONContent => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [],
    },
  ],
});

// Mock function for generateJSON until proper implementation
const generateJSON = (content: string, extensions: any[]): JSONContent => {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      },
    ],
  };
};

export function CreateEmail({
  initialTo = '',
  initialSubject = '',
  initialBody = '',
  initialCc = '',
  initialBcc = '',
}: {
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
  initialCc?: string;
  initialBcc?: string;
}) {
  const [toInput, setToInput] = React.useState('');
  const [toEmails, setToEmails] = React.useState<string[]>(initialTo ? [initialTo] : []);
  const [ccInput, setCcInput] = React.useState('');
  const [ccEmails, setCcEmails] = React.useState<string[]>([]);
  const [bccInput, setBccInput] = React.useState('');
  const [bccEmails, setBccEmails] = React.useState<string[]>([]);
  const [mail, setMail] = React.useState({ showCc: false, showBcc: false });
  const [subjectInput, setSubjectInput] = React.useState(initialSubject);
  const [attachments, setAttachments] = React.useState<File[]>([]);
  const [resetEditorKey, setResetEditorKey] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [messageContent, setMessageContent] = React.useState(initialBody);
  const [draftId, setDraftId] = useQueryState('draftId');
  const [includeSignature, setIncludeSignature] = React.useState(true);
  const { settings } = useSettings();

  const [defaultValue, setDefaultValue] = React.useState<JSONContent | null>(() => {
    if (initialBody) {
      try {
        return generateJSON(initialBody, []);
      } catch (error) {
        console.error('Error parsing initial body:', error);
        return createEmptyDocContent();
      }
    }
    return null;
  });

  const { data: session } = useSession();
  const { data: connections } = useConnections();
  const { aliases, isLoading: isLoadingAliases } = useEmailAliases();
  const [composeOpen, setComposeOpen] = useQueryState('isComposeOpen');

  const activeAccount = React.useMemo(() => {
    if (!session) return null;
    return connections?.find((connection) => connection.id === session?.activeConnection?.id);
  }, [session, connections]);

  const userName =
    activeAccount?.name || session?.activeConnection?.name || session?.user?.name || '';
  const userEmail =
    activeAccount?.email || session?.activeConnection?.email || session?.user?.email || '';

  React.useEffect(() => {
    if (!draftId && !defaultValue) {
      setDefaultValue(createEmptyDocContent());
    }
  }, [draftId, defaultValue]);

  React.useEffect(() => {
    const loadDraft = async () => {
      if (!draftId) {
        setDefaultValue(createEmptyDocContent());
        return;
      }

      try {
        const draft = await getDraft(draftId);

        if (!draft) {
          toast.error('Draft not found');
          return;
        }

        setDraftId(draft.id);

        // Process to, cc, and bcc email addresses
        const toList = processDraftEmails(draft.to);
        const ccList = processDraftEmails(draft.cc);
        const bccList = processDraftEmails(draft.bcc);

        // Set emails and update mail state in a batch
        if (toList.length > 0) {
          setToEmails(toList);
        }

        if (draft.subject) {
          setSubjectInput(draft.subject);
        }

        // Single mail state update for both CC and BCC
        const mailStateUpdates = {
          showCc: ccList.length > 0,
          showBcc: bccList.length > 0,
        };

        setMail((prev) => ({ ...prev, ...mailStateUpdates }));

        // Only set cc/bcc emails if there are any
        if (ccList.length > 0) {
          setCcEmails(ccList);
        }

        if (bccList.length > 0) {
          setBccEmails(bccList);
        }

        // Parse content if available
        if (draft.content) {
          try {
            const json = generateJSON(draft.content, []);
            setDefaultValue(json);
            setMessageContent(draft.content);
          } catch (error) {
            console.error('Error parsing draft content:', error);
          }
        }

        setHasUnsavedChanges(false);
      } catch (error) {
        console.error('Error loading draft:', error);
        toast.error('Failed to load draft');
      }
    };

    // Helper function to process email lists consistently
    function processDraftEmails(emails: any): string[] {
      if (!emails) return [];

      if (Array.isArray(emails)) {
        return emails;
      }

      if (typeof emails === 'string' && emails.trim()) {
        return emails
          .split(',')
          .map((email: string) => email.trim())
          .filter(Boolean);
      }

      return [];
    }

    loadDraft();
  }, [
    draftId,
    setMail,
    setToEmails,
    setCcEmails,
    setBccEmails,
    setSubjectInput,
    setDefaultValue,
    setMessageContent,
    setHasUnsavedChanges,
    setDraftId,
  ]);

  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const draftIdParam = searchParams.get('draftId');

  // Add refs for all inputs
  const toInputRef = React.useRef<HTMLInputElement>(null);
  const ccInputRef = React.useRef<HTMLInputElement>(null);
  const bccInputRef = React.useRef<HTMLInputElement>(null);
  const subjectInputRef = React.useRef<HTMLInputElement>(null);

  // Remove auto-focus logic
  React.useEffect(() => {
    if (!isFirstMount.current) return;
    isFirstMount.current = false;
  }, []);

  // Remove keyboard shortcut handler
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if "/" is pressed and no input/textarea is focused
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

  const handleEmailInputChange = (type: 'to' | 'cc' | 'bcc', value: string) => {
    // Just update the input value, no validation or checks
    switch (type) {
      case 'to':
        setToInput(value);
        break;
      case 'cc':
        setCcInput(value);
        break;
      case 'bcc':
        setBccInput(value);
        break;
    }
  };

  const handleAddEmail = (type: 'to' | 'cc' | 'bcc', email: string) => {
    // Only validate and add when Enter is pressed
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    const emailState = type === 'to' ? toEmails : type === 'cc' ? ccEmails : bccEmails;
    const setEmailState = type === 'to' ? setToEmails : type === 'cc' ? setCcEmails : setBccEmails;
    const setInputState = type === 'to' ? setToInput : type === 'cc' ? setCcInput : setBccInput;

    if (isValidEmail(trimmedEmail)) {
      setEmailState([...emailState, trimmedEmail]);
      setInputState('');
      setHasUnsavedChanges(true);
    }
  };

  const saveDraft = React.useCallback(async () => {
    if (!hasUnsavedChanges) return;
    if (!toEmails.length && !subjectInput && !messageContent) return;

    try {
      setIsLoading(true);

      // Create a single draft data object
      const draftData = {
        to: toEmails.join(', '),
        cc: mail.showCc ? ccEmails.join(', ') : '',
        bcc: mail.showBcc ? bccEmails.join(', ') : '',
        subject: subjectInput,
        message: messageContent || '',
        attachments: attachments,
        id: draftId,
      };

      const response = await createDraft(draftData);

      if (response?.id && response.id !== draftId) {
        setDraftId(response.id);
      }

      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Failed to save draft');
    } finally {
      setIsLoading(false);
    }
  }, [
    toEmails,
    ccEmails,
    bccEmails,
    mail.showCc,
    mail.showBcc,
    subjectInput,
    messageContent,
    attachments,
    draftId,
    hasUnsavedChanges,
    setDraftId,
    setIsLoading,
    setHasUnsavedChanges,
  ]);

  React.useEffect(() => {
    if (!hasUnsavedChanges) return;

    const autoSaveTimer = setTimeout(() => {
      saveDraft();
    }, 3000);

    return () => clearTimeout(autoSaveTimer);
  }, [hasUnsavedChanges, saveDraft]);

  React.useEffect(() => {
    setHasUnsavedChanges(true);
  }, [messageContent]);

  const resetEmailForm = React.useCallback(() => {
    // Reset all form fields
    setToInput('');
    setToEmails([]);
    setCcInput('');
    setCcEmails([]);
    setBccInput('');
    setBccEmails([]);
    setSubjectInput('');
    setAttachments([]);
    setMessageContent('');
    setDefaultValue(createEmptyDocContent());
    setResetEditorKey((prev) => prev + 1);
    setHasUnsavedChanges(false);

    // Reset CC and BCC visibility
    setMail((prev) => ({
      ...prev,
      showCc: false,
      showBcc: false,
      replyComposerOpen: false,
      forwardComposerOpen: false,
    }));
  }, [
    setMail,
    setToInput,
    setToEmails,
    setCcInput,
    setCcEmails,
    setBccInput,
    setBccEmails,
    setSubjectInput,
    setAttachments,
    setMessageContent,
    setDefaultValue,
    setResetEditorKey,
    setHasUnsavedChanges,
  ]);

  const handleSendEmail = async () => {
    if (!toEmails.length) {
      toast.error('Please enter at least one recipient email address');
      return;
    }

    if (!messageContent.trim() || messageContent === JSON.stringify(defaultValue)) {
      toast.error('Please enter a message');
      return;
    }

    if (!subjectInput.trim()) {
      toast.error('Please enter a subject');
      return;
    }

    try {
      setIsLoading(true);

      // Create email data object
      const emailData = {
        to: toEmails.map((email) => ({ email, name: email.split('@')[0] || email })),
        // Only include CC and BCC if the fields are visible and have values
        cc:
          mail.showCc && ccEmails.length > 0
            ? ccEmails.map((email) => ({ email, name: email.split('@')[0] || email }))
            : undefined,
        bcc:
          mail.showBcc && bccEmails.length > 0
            ? bccEmails.map((email) => ({ email, name: email.split('@')[0] || email }))
            : undefined,
        subject: subjectInput,
        message: messageContent,
        attachments: attachments,
      };

      // Send the email with all required data
      await sendEmail(emailData);

      toast.success(t('pages.createEmail.emailSentSuccessfully'));

      // Reset all form fields
      resetEmailForm();
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error(t('pages.createEmail.failedToSendEmail'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.target || !(e.target as HTMLElement).closest('.ProseMirror')) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.target || !(e.target as HTMLElement).closest('.ProseMirror')) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!e.target || !(e.target as HTMLElement).closest('.ProseMirror')) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        setAttachments((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
        setHasUnsavedChanges(true);
      }
    }
  };

  // Add a mount ref to ensure we only auto-focus once
  const isFirstMount = React.useRef(true);

  const handleAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setAttachments((prev) => [...prev, ...Array.from(files)]);
      setHasUnsavedChanges(true);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setHasUnsavedChanges(true);
  };

  // REPLACE the useEffect from lines 501-555 with this unified version
  React.useEffect(() => {
    // Set initial To emails
    if (initialTo) {
      const emails = initialTo.split(',').map((email) => email.trim());
      const validEmails = emails.filter((email) => isValidEmail(email));
      if (validEmails.length > 0) {
        setToEmails(validEmails);
      } else {
        setToInput(initialTo); 
      }
    }

    // Set initial Subject
    if (initialSubject) {
      setSubjectInput(initialSubject);
    }

    // Set initial Body (only if not loading from a draft)
    if (initialBody && !defaultValue && !draftId) {
      setDefaultValue({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: initialBody },
            ],
          },
        ],
      });
      setMessageContent(initialBody);
    }
    
    // Set initial CC emails and visibility
    let showCcField = false;
    if (initialCc) {
      const emails = initialCc.split(',').map((email) => email.trim());
      const validEmails = emails.filter((email) => isValidEmail(email));
      if (validEmails.length > 0) {
        setCcEmails(validEmails);
        showCcField = true;
      } else if (initialCc.trim()) { 
         setCcInput(initialCc); 
         showCcField = true;
      }
    } else if (ccEmails.length > 0) {
      showCcField = true;
    }
    if (showCcField) {
        setMail((prev) => ({ ...prev, showCc: true }));
    }

    // Set initial BCC emails and visibility
    let showBccField = false;
    if (initialBcc) {
      const emails = initialBcc.split(',').map((email) => email.trim());
      const validEmails = emails.filter((email) => isValidEmail(email));
       if (validEmails.length > 0) {
        setBccEmails(validEmails);
        showBccField = true;
      } else if (initialBcc.trim()) {
        setBccInput(initialBcc);
        showBccField = true;
      }
    } else if (bccEmails.length > 0) {
      showBccField = true;
    }
    if (showBccField) {
       setMail((prev) => ({ ...prev, showBcc: true }));
    }

  }, [
    initialTo,
    initialSubject,
    initialBody,
    initialCc, 
    initialBcc, 
    defaultValue,
    draftId,
    setMail,
    setToEmails,
    setToInput,
    setCcEmails,
    setBccEmails,
    setCcInput,
    setBccInput,
    setSubjectInput,
    setMessageContent,
    setDefaultValue,
    ccEmails, // Need these here to trigger show on draft load
    bccEmails // Need these here to trigger show on draft load
  ]);

  return (
    <div
      className="bg-offsetLight dark:bg-offsetDark relative flex h-full flex-col overflow-hidden shadow-inner md:rounded-2xl md:border md:shadow-sm"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="bg-background/80 border-primary/30 absolute inset-0 z-50 m-4 flex items-center justify-center rounded-2xl border-2 border-dashed backdrop-blur-sm">
          <div className="text-muted-foreground flex flex-col items-center gap-2">
            <Paperclip className="text-muted-foreground h-12 w-12" />
            <p className="text-lg font-medium">{t('pages.createEmail.dropFilesToAttach')}</p>
          </div>
        </div>
      )}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-1.5 p-2 transition-colors">
        <SidebarToggle className="h-fit px-2" />
      </div>

      <div className="relative flex h-full flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[500px] space-y-12 px-4 pt-4 sm:max-w-[720px] md:px-2">
            <div className="space-y-3 md:px-1">
              <div className="flex items-center">
                <div className="text-muted-foreground w-20 flex-shrink-0 pr-3 text-right text-[1rem] font-[600] opacity-50 md:w-24">
                  {t('common.mailDisplay.to')}
                </div>
                <div className="group relative left-[2px] flex w-full flex-wrap items-center rounded-md border border-none bg-transparent p-1 transition-all focus-within:border-none focus:outline-none">
                  {toEmails.map((email, index) => (
                    <div
                      key={index}
                      className="bg-accent flex items-center gap-1 rounded-md border px-2 text-sm font-medium"
                    >
                      <span className="max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap">
                        {email}
                      </span>
                      <button
                        type="button"
                        disabled={isLoading}
                        className="text-muted-foreground hover:text-foreground ml-1 rounded-full"
                        onClick={() => {
                          setToEmails((emails) => emails.filter((_, i) => i !== index));
                          setHasUnsavedChanges(true);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <input
                    ref={toInputRef}
                    disabled={isLoading}
                    type="text"
                    className="text-md relative left-[3px] min-w-[120px] flex-1 bg-transparent placeholder:text-[#616161] placeholder:opacity-50 focus:outline-none"
                    placeholder={toEmails.length ? '' : t('pages.createEmail.example')}
                    value={toInput}
                    onChange={(e) => handleEmailInputChange('to', e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleAddEmail('to', toInput);
                      }
                    }}
                  />
                  <div className="flex items-center gap-1">
                    <Button
                      tabIndex={-1}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        const shouldShow = !mail.showCc;
                        setMail((prev) => ({ ...prev, showCc: shouldShow }));

                        // Focus the CC input if we're showing it, using RAF for proper DOM update
                        if (shouldShow) {
                          requestAnimationFrame(() => {
                            ccInputRef.current?.focus();
                          });
                        }
                      }}
                    >
                      Cc
                    </Button>
                    <Button
                      tabIndex={-1}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        const shouldShow = !mail.showBcc;
                        setMail((prev) => ({ ...prev, showBcc: shouldShow }));

                        // Focus the BCC input if we're showing it, using RAF for proper DOM update
                        if (shouldShow) {
                          requestAnimationFrame(() => {
                            bccInputRef.current?.focus();
                          });
                        }
                      }}
                    >
                      Bcc
                    </Button>
                  </div>
                </div>
              </div>

              {mail.showCc && (
                <div className="flex items-center">
                  <div className="text-muted-foreground w-20 flex-shrink-0 pr-3 text-right text-[1rem] font-[600] opacity-50 md:w-24">
                    Cc
                  </div>
                  <div className="group relative left-[2px] flex w-full flex-wrap items-center rounded-md border border-none bg-transparent p-1 transition-all focus-within:border-none focus:outline-none">
                    {ccEmails.map((email, index) => (
                      <div
                        key={index}
                        className="bg-accent flex items-center gap-1 rounded-md border px-2 text-sm font-medium"
                      >
                        <span className="max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap">
                          {email}
                        </span>
                        <button
                          type="button"
                          disabled={isLoading}
                          className="text-muted-foreground hover:text-foreground ml-1 rounded-full"
                          onClick={() => {
                            setCcEmails((emails) => emails.filter((_, i) => i !== index));
                            setHasUnsavedChanges(true);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <input
                      ref={ccInputRef}
                      disabled={isLoading}
                      type="text"
                      className="text-md relative left-[3px] min-w-[120px] flex-1 bg-transparent placeholder:text-[#616161] placeholder:opacity-50 focus:outline-none"
                      placeholder={ccEmails.length ? '' : 'Add Cc recipients'}
                      value={ccInput}
                      onChange={(e) => handleEmailInputChange('cc', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleAddEmail('cc', ccInput);
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {mail.showBcc && (
                <div className="flex items-center">
                  <div className="text-muted-foreground w-20 flex-shrink-0 pr-3 text-right text-[1rem] font-[600] opacity-50 md:w-24">
                    Bcc
                  </div>
                  <div className="group relative left-[2px] flex w-full flex-wrap items-center rounded-md border border-none bg-transparent p-1 transition-all focus-within:border-none focus:outline-none">
                    {bccEmails.map((email, index) => (
                      <div
                        key={index}
                        className="bg-accent flex items-center gap-1 rounded-md border px-2 text-sm font-medium"
                      >
                        <span className="max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap">
                          {email}
                        </span>
                        <button
                          type="button"
                          disabled={isLoading}
                          className="text-muted-foreground hover:text-foreground ml-1 rounded-full"
                          onClick={() => {
                            setBccEmails((emails) => emails.filter((_, i) => i !== index));
                            setHasUnsavedChanges(true);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <input
                      ref={bccInputRef}
                      disabled={isLoading}
                      type="text"
                      className="text-md relative left-[3px] min-w-[120px] flex-1 bg-transparent placeholder:text-[#616161] placeholder:opacity-50 focus:outline-none"
                      placeholder={bccEmails.length ? '' : 'Add Bcc recipients'}
                      value={bccInput}
                      onChange={(e) => handleEmailInputChange('bcc', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleAddEmail('bcc', bccInput);
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center">
                <div className="text-muted-foreground w-20 flex-shrink-0 pr-3 text-right text-[1rem] font-[600] opacity-50 md:w-24">
                  {t('common.searchBar.subject')}
                </div>
                <input
                  ref={toInputRef}
                  disabled={isLoading}
                  type="text"
                  className="text-md relative left-[7.5px] w-full bg-transparent placeholder:text-[#616161] placeholder:opacity-50 focus:outline-none"
                  placeholder={t('common.searchBar.subject')}
                  value={subjectInput}
                  onChange={(e) => {
                    setSubjectInput(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                />
              </div>

              <div className="flex">
                <div className="text-muted-foreground text-md relative -top-[1px] w-20 flex-shrink-0 pr-3 pt-2 text-right font-[600] opacity-50 md:w-24">
                  {t('pages.createEmail.body')}
                </div>
                <div className="w-full">
                  {defaultValue && (
                    <Editor
                      initialValue={defaultValue}
                      onChange={(newContent) => {
                        setMessageContent(newContent);
                        if (newContent.trim() !== '') {
                          setHasUnsavedChanges(true);
                        }
                      }}
                      key={resetEditorKey}
                      placeholder={t('pages.createEmail.writeYourMessageHere')}
                      onAttachmentsChange={setAttachments}
                      onCommandEnter={handleSendEmail}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-offsetLight dark:bg-offsetDark sticky bottom-0 left-0 right-0 mb-16 flex items-center justify-between p-4 pb-3 md:mb-0">
          <div className="flex items-center gap-4">
            <div className="mr-1 pb-2 pt-2">
              <AIAssistant
                currentContent={messageContent}
                subject={subjectInput}
                recipients={toEmails}
                userContext={{ name: userName, email: userEmail }}
                onContentGenerated={(jsonContent, newSubject) => {
                  console.log('CreateEmail: Received AI-generated content', {
                    jsonContentType: jsonContent.type,
                    hasContent: Boolean(jsonContent.content),
                    contentLength: jsonContent.content?.length || 0,
                    newSubject: newSubject,
                  });

                  try {
                    // Update the editor content with the AI-generated content
                    setDefaultValue(jsonContent);

                    // Extract and set the text content for validation purposes
                    // This ensures the submit button is enabled immediately
                    if (jsonContent.content && jsonContent.content.length > 0) {
                      // Extract text content from JSON structure recursively
                      const extractTextContent = (node: any): string => {
                        if (!node) return '';

                        if (node.text) return node.text;

                        if (node.content && Array.isArray(node.content)) {
                          return node.content.map(extractTextContent).join(' ');
                        }

                        return '';
                      };

                      // Process all content nodes
                      const textContent = jsonContent.content
                        .map(extractTextContent)
                        .join('\n')
                        .trim();
                      setMessageContent(textContent);
                    }

                    // Update the subject if provided
                    if (newSubject && (!subjectInput || subjectInput.trim() === '')) {
                      console.log('CreateEmail: Setting new subject from AI', newSubject);
                      setSubjectInput(newSubject);
                    }

                    // Mark as having unsaved changes
                    setHasUnsavedChanges(true);

                    // Reset the editor to ensure it picks up the new content
                    setResetEditorKey((prev) => prev + 1);

                    console.log('CreateEmail: Successfully applied AI content');
                  } catch (error) {
                    console.error('CreateEmail: Error applying AI content', error);
                    toast.error('Error applying AI content to your email. Please try again.');
                  }
                }}
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  <span>
                    {attachments.length || 'no'}{' '}
                    {t('common.replyCompose.attachmentCount', { count: attachments.length })}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 touch-auto" align="start">
                <div className="space-y-2">
                  <div className="px-1">
                    <h4 className="font-medium leading-none">
                      {t('common.replyCompose.attachments')}
                    </h4>
                    <p className="text-muted-foreground text-sm">
                      {attachments.length}{' '}
                      {t('common.replyCompose.fileCount', { count: attachments.length })}
                    </p>
                  </div>
                  <Separator />
                  <div className="h-[300px] touch-auto overflow-y-auto overscroll-contain px-1 py-1">
                    <div className="grid grid-cols-2 gap-2">
                      {attachments.map((file, index) => (
                        <div
                          key={index}
                          className="group relative overflow-hidden rounded-md border"
                        >
                          <UploadedFileIcon
                            removeAttachment={removeAttachment}
                            index={index}
                            file={file}
                          />
                          <div className="bg-muted/10 p-2">
                            <p className="text-xs font-medium">{truncateFileName(file.name, 20)}</p>
                            <p className="text-muted-foreground text-xs">
                              {(file.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <div className="group relative -left-5">
              <Input
                type="file"
                id="attachment-input"
                className="w-10 opacity-0"
                onChange={handleAttachment}
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              />
              <Button
                variant={'outline'}
                size={'icon'}
                type="button"
                aria-label="Add attachment"
                className="pointer-events-none absolute left-0 top-0 scale-75 rounded-full transition-transform group-hover:scale-90"
              >
                <Plus />
              </Button>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="default"
              className="h-9 w-9 overflow-hidden rounded-full"
              onClick={handleSendEmail}
              disabled={
                isLoading || !toEmails.length || !messageContent.trim() || !subjectInput.trim()
              }
            >
              <ArrowUpIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
