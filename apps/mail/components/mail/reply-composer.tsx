'use client';

import {
  cleanEmailAddress,
  truncateFileName,
  cn,
  convertJSONToHTML,
  createAIJsonContent,
  constructReplyBody,
} from '@/lib/utils';
import {
  ArrowUp,
  Paperclip,
  Reply,
  X,
  Plus,
  Sparkles,
  Check,
  X as XIcon,
  Forward,
  ReplyAll,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRef, useState, useEffect, useCallback, useReducer } from 'react';
import { UploadedFileIcon } from '@/components/create/uploaded-file-icon';
import { extractTextFromHTML } from '@/actions/extractText';
import { useForm, SubmitHandler } from 'react-hook-form';
import { generateAIResponse } from '@/actions/ai-reply';
import { useHotkeysContext } from 'react-hotkeys-hook';
import { Separator } from '@/components/ui/separator';
import { useMail } from '@/components/mail/use-mail';
import { useSettings } from '@/hooks/use-settings';
import Editor from '@/components/create/editor';
import { Button } from '@/components/ui/button';
import { useThread } from '@/hooks/use-threads';
import { useSession } from '@/lib/auth-client';
import { createDraft } from '@/actions/drafts';
import { useTranslations } from 'next-intl';
import { sendEmail } from '@/actions/send';
import type { JSONContent } from 'novel';
import { useQueryState } from 'nuqs';
import { Input } from '../ui/input';
import posthog from 'posthog-js';
import { Sender } from '@/types';
import { toast } from 'sonner';
import type { z } from 'zod';

// Utility function to check if an email is a noreply address
const isNoReplyAddress = (email: string): boolean => {
  const lowerEmail = email.toLowerCase();
  return (
    lowerEmail.includes('noreply') ||
    lowerEmail.includes('no-reply') ||
    lowerEmail.includes('notifications@github.com')
  );
};

// Define state interfaces
interface ComposerState {
  isUploading: boolean;
  isComposerOpen: boolean;
  isDragging: boolean;
  isEditorFocused: boolean;
  editorKey: number;
  editorInitialValue?: JSONContent;
  hasUnsavedChanges: boolean;
  isLoading: boolean;
}

interface AIState {
  isLoading: boolean;
  suggestion: string | null;
  showOptions: boolean;
}

interface MailState {
  replyComposerOpen: boolean;
  replyAllComposerOpen: boolean;
  forwardComposerOpen: boolean;
  // ... other existing state
}

// Define action types
type ComposerAction =
  | { type: 'SET_UPLOADING'; payload: boolean }
  | { type: 'SET_COMPOSER_OPEN'; payload: boolean }
  | { type: 'SET_DRAGGING'; payload: boolean }
  | { type: 'SET_EDITOR_FOCUSED'; payload: boolean }
  | { type: 'INCREMENT_EDITOR_KEY' }
  | { type: 'SET_EDITOR_INITIAL_VALUE'; payload: JSONContent | undefined }
  | { type: 'SET_UNSAVED_CHANGES'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean };

type AIAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SUGGESTION'; payload: string | null }
  | { type: 'SET_SHOW_OPTIONS'; payload: boolean }
  | { type: 'RESET' };

// Create reducers
const composerReducer = (state: ComposerState, action: ComposerAction): ComposerState => {
  switch (action.type) {
    case 'SET_UPLOADING':
      return { ...state, isUploading: action.payload };
    case 'SET_COMPOSER_OPEN':
      return { ...state, isComposerOpen: action.payload };
    case 'SET_DRAGGING':
      return { ...state, isDragging: action.payload };
    case 'SET_EDITOR_FOCUSED':
      return { ...state, isEditorFocused: action.payload };
    case 'INCREMENT_EDITOR_KEY':
      return { ...state, editorKey: state.editorKey + 1 };
    case 'SET_EDITOR_INITIAL_VALUE':
      return { ...state, editorInitialValue: action.payload };
    case 'SET_UNSAVED_CHANGES':
      return { ...state, hasUnsavedChanges: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
};

const aiReducer = (state: AIState, action: AIAction): AIState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_SUGGESTION':
      return { ...state, suggestion: action.payload };
    case 'SET_SHOW_OPTIONS':
      return { ...state, showOptions: action.payload };
    case 'RESET':
      return { isLoading: false, suggestion: null, showOptions: false };
    default:
      return state;
  }
};

interface ReplyComposeProps {
  mode?: 'reply' | 'replyAll' | 'forward';
}

type FormData = {
  messageContent: string;
  to: string[];
  cc: string[];
  bcc: string[];
  toInput: string;
  ccInput: string;
  bccInput: string;
};

export default function ReplyCompose({ mode = 'reply' }: ReplyComposeProps) {
  const [threadId] = useQueryState('threadId');
  const { data: emailData, mutate } = useThread(threadId);
  const [attachments, setAttachments] = useState<File[]>([]);
  const { data: session } = useSession();
  const [mail, setMail] = useMail();
  const { settings } = useSettings();
  const [draftId, setDraftId] = useQueryState('draftId');
  const { enableScope, disableScope } = useHotkeysContext();
  const [isEditingRecipients, setIsEditingRecipients] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const ccInputRef = useRef<HTMLInputElement | null>(null);
  const bccInputRef = useRef<HTMLInputElement | null>(null);

  // Use global state instead of local state
  const composerIsOpen =
    mode === 'reply'
      ? mail.replyComposerOpen
      : mode === 'replyAll'
        ? mail.replyAllComposerOpen
        : mail.forwardComposerOpen;
  const setComposerIsOpen = (value: boolean) => {
    setMail((prev: typeof mail) => ({
      ...prev,
      replyComposerOpen: mode === 'reply' ? value : prev.replyComposerOpen,
      replyAllComposerOpen: mode === 'replyAll' ? value : prev.replyAllComposerOpen,
      forwardComposerOpen: mode === 'forward' ? value : prev.forwardComposerOpen,
    }));
  };

  // Use reducers instead of multiple useState
  const [composerState, composerDispatch] = useReducer(composerReducer, {
    isUploading: false,
    isComposerOpen: false,
    isDragging: false,
    isEditorFocused: false,
    editorKey: 0,
    editorInitialValue: undefined,
    hasUnsavedChanges: false,
    isLoading: false,
  });

  const [aiState, aiDispatch] = useReducer(aiReducer, {
    isLoading: false,
    suggestion: null,
    showOptions: false,
  });

  const composerRef = useRef<HTMLFormElement>(null);
  const t = useTranslations();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    getValues,
    reset,
    control,
    watch,
  } = useForm<FormData>({
    defaultValues: {
      messageContent: '',
      to: [],
      cc: [],
      bcc: [],
      toInput: '',
      ccInput: '',
      bccInput: '',
    },
  });

  // Watch all recipient fields
  const toEmails = watch('to');
  const ccEmails = watch('cc');
  const bccEmails = watch('bcc');

  // const handleAddEmail = (type: 'to' | 'cc' | 'bcc', value: string) => {
  //   const trimmedEmail = value.trim().replace(/,$/, '');
  //   const currentEmails = getValues(type);
  //   if (trimmedEmail && !currentEmails.includes(trimmedEmail) && isValidEmail(trimmedEmail)) {
  //     setValue(type, [...currentEmails, trimmedEmail]);
  //     setValue(`${type}Input`, '');
  //   }
  // };

  const handleSendEmail = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.preventDefault();
    }
    if (!emailData) return;
    try {
      const originalEmail = emailData.latest;
      const userEmail = session?.activeConnection?.email?.toLowerCase();

      if (!userEmail) {
        throw new Error('Active connection email not found');
      }

      if (!originalEmail) {
        throw new Error('Original email not found');
      }

      const subject =
        mode === 'forward'
          ? `Fwd: ${originalEmail.subject || ''}`
          : originalEmail.subject?.startsWith('Re:')
            ? originalEmail.subject
            : `Re: ${originalEmail?.subject || ''}`;

      // Convert email strings to Sender objects
      const toRecipients: Sender[] = toEmails.map((email) => ({
        email,
        name: email.split('@')[0] || 'User',
      }));

      const ccRecipients: Sender[] | undefined = showCc
        ? ccEmails.map((email) => ({
            email,
            name: email.split('@')[0] || 'User',
          }))
        : undefined;

      const bccRecipients: Sender[] | undefined = showBcc
        ? bccEmails.map((email) => ({
            email,
            name: email.split('@')[0] || 'User',
          }))
        : undefined;

      const messageId = originalEmail.messageId;
      const threadId = originalEmail.threadId;
      const formattedMessage = getValues('messageContent');
      const originalDate = new Date(originalEmail.receivedOn || '').toLocaleString();
      const quotedMessage = originalEmail.decodedBody;

      const replyBody = constructReplyBody(
        formattedMessage,
        originalDate,
        originalEmail.sender,
        toRecipients,
        quotedMessage,
      );

      const inReplyTo = messageId;
      const existingRefs = originalEmail.references?.split(' ') || [];
      const references = [...existingRefs, originalEmail?.inReplyTo, cleanEmailAddress(messageId)]
        .filter(Boolean)
        .join(' ');

      await sendEmail({
        to: toRecipients,
        cc: ccRecipients,
        bcc: bccRecipients,
        subject,
        message: replyBody,
        attachments,
        headers: {
          'In-Reply-To': inReplyTo ?? '',
          References: references,
          'Thread-Id': threadId ?? '',
        },
        threadId,
      }).then(() => mutate());

      if (ccRecipients && bccRecipients) {
        posthog.capture('Reply Email Sent with CC and BCC');
      } else if (ccRecipients) {
        posthog.capture('Reply Email Sent with CC');
      } else if (bccRecipients) {
        posthog.capture('Reply Email Sent with BCC');
      } else {
        posthog.capture('Reply Email Sent');
      }

      reset();
      setComposerIsOpen(false);
      toast.success(t('pages.createEmail.emailSentSuccessfully'));
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error(t('pages.createEmail.failedToSendEmail'));
    }
  };

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    await handleSendEmail();
  };

  const handleAttachment = (files: File[]) => {
    if (files) {
      composerDispatch({ type: 'SET_UPLOADING', payload: true });
      try {
        setAttachments([...attachments, ...files]);
      } finally {
        composerDispatch({ type: 'SET_UPLOADING', payload: false });
      }
    }
  };

  const handleAttachmentEvent = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      composerDispatch({ type: 'SET_UPLOADING', payload: true });
      try {
        setAttachments([...attachments, ...Array.from(e.target.files)]);
      } finally {
        composerDispatch({ type: 'SET_UPLOADING', payload: false });
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.target || !(e.target as HTMLElement).closest('.ProseMirror')) {
      e.preventDefault();
      e.stopPropagation();
      composerDispatch({ type: 'SET_DRAGGING', payload: true });
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.target || !(e.target as HTMLElement).closest('.ProseMirror')) {
      e.preventDefault();
      e.stopPropagation();
      composerDispatch({ type: 'SET_DRAGGING', payload: false });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!e.target || !(e.target as HTMLElement).closest('.ProseMirror')) {
      e.preventDefault();
      e.stopPropagation();
      composerDispatch({ type: 'SET_DRAGGING', payload: false });

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        setAttachments([...attachments, ...Array.from(e.dataTransfer.files)]);
        // Open the composer if it's not already open
        if (!composerIsOpen) {
          setComposerIsOpen(true);
        }
      }
    }
  };

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const CloseButton = ({ onClick }: { onClick: (e: React.MouseEvent) => void }) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        composerDispatch({ type: 'SET_EDITOR_FOCUSED', payload: false });
        onClick(e);
      }}
    >
      <X className="h-4 w-4" />
    </Button>
  );

  const toggleComposer = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Force blur any focused elements
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setMail((prev) => ({
      ...prev,
      replyComposerOpen: false,
      replyAllComposerOpen: false,
      forwardComposerOpen: false,
    }));
    setIsEditingRecipients(false);
    setShowCc(false);
    setShowBcc(false);
    reset();
  };

  useEffect(() => {
    if (composerIsOpen) {
      // Give the editor time to render before focusing
      const timer = setTimeout(() => {
        // Focus the editor - Novel editor typically has a ProseMirror element
        const editorElement = document.querySelector('.ProseMirror');
        if (editorElement instanceof HTMLElement) {
          editorElement.focus();
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [composerIsOpen]);

  // Add these state variables near the top of your ReplyCompose component
  const [isResizing, setIsResizing] = useState(false);
  const [editorHeight, setEditorHeight] = useState(150); // Default height
  const resizeStartY = useRef(0);
  const startHeight = useRef(0);

  // Update your handleMouseMove function to use these state variables
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        e.preventDefault();
        const deltaY = resizeStartY.current - e.clientY;
        let newHeight = Math.max(100, Math.min(500, startHeight.current + deltaY));
        setEditorHeight(newHeight);
      }
    },
    [isResizing],
  );

  // Add a function to handle starting the resize
  const handleResizeStart = (e: React.MouseEvent) => {
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    startHeight.current = editorHeight;
  };

  // Handle keyboard shortcuts for sending email
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Check for Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (isFormValid) {
        handleSubmit(onSubmit)();
      }
    }
  };

  // Update onChange handler in Editor component
  const handleEditorChange = (content: string) => {
    setValue('messageContent', content);
  };

  // Check if the message is empty
  const isMessageEmpty =
    !getValues('messageContent') ||
    getValues('messageContent') ===
      JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [],
          },
        ],
      });

  // Check if form is valid for submission
  const isFormValid = !isMessageEmpty || attachments.length > 0;

  const handleAIButtonClick = async () => {
    if (!emailData) return;
    aiDispatch({ type: 'SET_LOADING', payload: true });
    try {
      // Extract relevant information from the email thread for context
      const latestEmail = emailData.latest;
      if (!latestEmail) return;
      const originalSender = latestEmail?.sender?.name || 'the recipient';

      // Create a summary of the thread content for context
      const threadContent = (
        await Promise.all(
          emailData.messages.map(async (email) => {
            const body = await extractTextFromHTML(email.decodedBody || 'No content');
            return `
            <email>
              <from>${email.sender?.name || 'Unknown'} &lt;${email.sender?.email || 'unknown@email.com'}&gt;</from>
              <subject>${email.subject || 'No Subject'}</subject>
              <date>${new Date(email.receivedOn || '').toLocaleString()}</date>
              <body>${body}</body>
            </email>`;
          }),
        )
      ).join('\n\n');

      const suggestion = await generateAIResponse(threadContent, originalSender);
      aiDispatch({ type: 'SET_SUGGESTION', payload: suggestion });
      composerDispatch({
        type: 'SET_EDITOR_INITIAL_VALUE',
        payload: createAIJsonContent(suggestion),
      });
      composerDispatch({ type: 'INCREMENT_EDITOR_KEY' });
      aiDispatch({ type: 'SET_SHOW_OPTIONS', payload: true });

      // Add this: Focus the editor after AI content is set
      setTimeout(() => {
        const editorElement = document.querySelector('.ProseMirror');
        if (editorElement instanceof HTMLElement) {
          editorElement.focus();
        }
      }, 100); // Small delay to ensure content is rendered
    } catch (error: any) {
      console.error('Error generating AI response:', error);

      let errorMessage = 'Failed to generate AI response. Please try again or compose manually.';

      if (error.message) {
        if (error.message.includes('Groq API')) {
          errorMessage = 'AI service is currently unavailable. Please try again later.';
        } else if (error.message.includes('key is not configured')) {
          errorMessage = 'AI service is not properly configured. Please contact support.';
        }
      }

      toast.error(errorMessage);
    } finally {
      aiDispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const acceptAISuggestion = () => {
    if (aiState.suggestion) {
      const jsonContent = createAIJsonContent(aiState.suggestion);
      const htmlContent = convertJSONToHTML(jsonContent);

      setValue('messageContent', htmlContent);

      composerDispatch({ type: 'SET_EDITOR_INITIAL_VALUE', payload: undefined });
      aiDispatch({ type: 'RESET' });
    }
  };

  const rejectAISuggestion = () => {
    composerDispatch({ type: 'SET_EDITOR_INITIAL_VALUE', payload: undefined });
    composerDispatch({ type: 'INCREMENT_EDITOR_KEY' });
    aiDispatch({ type: 'RESET' });
  };

  // Create a ref for the send button
  const sendButtonRef = useRef<HTMLButtonElement>(null);

  // Update the Editor's onCommandEnter prop
  const handleCommandEnter = () => {
    // Programmatically click the send button
    sendButtonRef.current?.click();
  };

  // Add a handler for tab key acceptance
  const handleTabAccept = useCallback(() => {
    if (aiState.showOptions && aiState.suggestion) {
      acceptAISuggestion();
      return true; // Return true to indicate we handled the tab
    }
    return false; // Return false to allow normal tab behavior
  }, [aiState.showOptions, aiState.suggestion]);

  // Helper function to initialize recipients based on mode
  const initializeRecipients = useCallback(() => {
    if (!emailData || !emailData.messages.length) return { to: [], cc: [] };

    const latestEmail = emailData.latest;
    if (!latestEmail) return { to: [], cc: [] };

    const userEmail = session?.activeConnection?.email?.toLowerCase();
    const to: string[] = [];
    const cc: string[] = [];

    if (mode === 'forward') {
      return { to: [], cc: [] };
    }

    if (mode === 'reply') {
      // Add reply-to or sender email to To
      const replyEmail = latestEmail.replyTo || latestEmail.sender?.email;
      if (replyEmail) {
        to.push(replyEmail);
      }
    } else if (mode === 'replyAll') {
      // Add original sender to To if not current user
      if (latestEmail.sender?.email && latestEmail.sender.email.toLowerCase() !== userEmail) {
        to.push(latestEmail.sender.email);
      }

      // Add all original recipients to CC except current user and primary recipient
      if (latestEmail.to) {
        latestEmail.to.forEach((recipient) => {
          if (
            recipient.email &&
            recipient.email.toLowerCase() !== userEmail &&
            recipient.email.toLowerCase() !== to[0]?.toLowerCase()
          ) {
            cc.push(recipient.email);
          }
        });
      }

      // Add CC recipients if they exist
      if (latestEmail.cc) {
        latestEmail.cc.forEach((recipient) => {
          if (
            recipient.email &&
            recipient.email.toLowerCase() !== userEmail &&
            recipient.email.toLowerCase() !== to[0]?.toLowerCase() &&
            !cc.includes(recipient.email)
          ) {
            cc.push(recipient.email);
          }
        });
      }

      // If there are CC recipients, show the CC field
      if (cc.length > 0) {
        setShowCc(true);
      }
    }

    return { to, cc };
  }, [emailData, mode, session?.activeConnection?.email]);

  // Initialize recipients when composer opens
  useEffect(() => {
    if (composerIsOpen) {
      const { to, cc } = initializeRecipients();
      setValue('to', to);
      setValue('cc', cc);
    }
  }, [composerIsOpen, initializeRecipients, setValue]);

  // Modify renderHeaderContent to show recipient fields
  const renderHeaderContent = () => {
    if (!emailData) return null;

    const latestEmail = emailData.latest;
    if (!latestEmail) return null;

    const icon =
      mode === 'forward' ? (
        <Forward className="h-4 w-4" />
      ) : mode === 'replyAll' ? (
        <ReplyAll className="h-4 w-4" />
      ) : (
        <Reply className="h-4 w-4" />
      );

    if (isEditingRecipients || mode === 'forward') {
      return (
        <div className="flex-1 space-y-2">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon}
              <span className="text-sm font-medium">
                {mode === 'forward' ? 'Forward' : 'Recipients'}
              </span>
            </div>
          </div>

          <RecipientInput
            type="to"
            value={toEmails}
            onRemove={(index) => {
              const newEmails = toEmails.filter((_, i) => i !== index);
              setValue('to', newEmails);
            }}
            placeholder={t('pages.createEmail.example')}
          />

          {showCc && (
            <RecipientInput
              type="cc"
              value={ccEmails}
              onRemove={(index) => {
                const newEmails = ccEmails.filter((_, i) => i !== index);
                setValue('cc', newEmails);
              }}
              placeholder="Add Cc recipients"
              inputRef={ccInputRef}
            />
          )}

          {showBcc && (
            <RecipientInput
              type="bcc"
              value={bccEmails}
              onRemove={(index) => {
                const newEmails = bccEmails.filter((_, i) => i !== index);
                setValue('bcc', newEmails);
              }}
              placeholder="Add Bcc recipients"
              inputRef={bccInputRef}
            />
          )}
        </div>
      );
    }

    // Show compact view with all recipients
    const allRecipients = [...toEmails, ...(showCc ? ccEmails : []), ...(showBcc ? bccEmails : [])];
    const recipientDisplay = allRecipients.join(', ');

    return (
      <div
        className="hover:bg-accent/50 flex flex-1 cursor-pointer items-center gap-2 rounded px-2 py-1"
        onClick={() => setIsEditingRecipients(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsEditingRecipients(true);
          }
        }}
      >
        {icon}
        <p className="truncate" title={recipientDisplay}>
          {recipientDisplay || t('common.mailDisplay.to')}
        </p>
      </div>
    );
  };

  // Extract recipient input component for reusability
  const RecipientInput = ({
    type,
    value,
    onRemove,
    placeholder,
    inputRef,
  }: {
    type: 'to' | 'cc' | 'bcc';
    value: string[];
    onRemove: (index: number) => void;
    placeholder: string;
    inputRef?: React.RefObject<HTMLInputElement | null>;
  }) => {
    const { ref, ...rest } = register(`${type}Input` as 'toInput' | 'ccInput' | 'bccInput', {
      validate: (value: string) => {
        if (value && !isValidEmail(value)) {
          return 'Invalid email format';
        }
        return true;
      },
    });

    const handleAddEmail = (type: 'to' | 'cc' | 'bcc', value: string) => {
      const trimmedEmail = value.trim().replace(/,$/, '');
      const currentEmails = getValues(type);
      if (trimmedEmail && !currentEmails.includes(trimmedEmail) && isValidEmail(trimmedEmail)) {
        setValue(type, [...currentEmails, trimmedEmail]);
        setValue(`${type}Input` as 'toInput' | 'ccInput' | 'bccInput', '');
      }
    };

    return (
      <div className="flex items-center gap-2">
        <div className="text-muted-foreground flex-shrink-0 text-right text-[1rem] opacity-50">
          {type}:
        </div>
        <div className="group relative left-[2px] flex w-full flex-wrap items-center gap-1 rounded-md border border-none bg-transparent p-1 transition-all focus-within:border-none focus:outline-none">
          {value.map((email, index) => (
            <EmailTag key={index} email={email} onRemove={() => onRemove(index)} />
          ))}
          <input
            ref={(e) => {
              ref(e);
              if (inputRef) {
                (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = e;
              }
            }}
            type="email"
            className="text-md relative left-[3px] min-w-[120px] flex-1 bg-transparent placeholder:text-[#616161] placeholder:opacity-50 focus:outline-none"
            placeholder={value.length ? '' : placeholder}
            {...rest}
            onBlur={(e) => handleAddEmail('to', e.currentTarget.value)}
            onKeyDown={(e) => {
              const currentValue = e.currentTarget.value;
              if ((e.key === ',' || e.key === 'Enter' || e.key === ' ') && currentValue) {
                e.preventDefault();
                if (isValidEmail(currentValue)) {
                  const newEmails = [...value];
                  newEmails.push(currentValue);
                  setValue(type as 'to' | 'cc' | 'bcc', newEmails);
                  setValue(`${type}Input` as 'toInput' | 'ccInput' | 'bccInput', '');
                }
              } else if (e.key === 'Backspace' && !currentValue && value.length > 0) {
                e.preventDefault();
                const newEmails = value.filter((_, i) => i !== value.length - 1);
                setValue(type as 'to' | 'cc' | 'bcc', newEmails);
              }
            }}
            onPaste={(e) => {
              e.preventDefault();
              const pastedText = e.clipboardData.getData('text');
              const emails = pastedText.split(/[,\n]/).map((email) => email.trim());
              const validEmails = emails.filter(
                (email) => email && !value.includes(email) && isValidEmail(email),
              );
              if (validEmails.length > 0) {
                setValue(type as 'to' | 'cc' | 'bcc', [...value, ...validEmails]);
                setValue(`${type}Input` as 'toInput' | 'ccInput' | 'bccInput', '');
              }
            }}
          />
        </div>
      </div>
    );
  };

  // Extract email tag component
  const EmailTag = ({ email, onRemove }: { email: string; onRemove: () => void }) => (
    <div className="bg-accent flex items-center gap-1 rounded-md border px-2 text-sm font-medium">
      <span className="max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap">{email}</span>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground ml-1 rounded-full"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );

  // Add this effect near other useEffects
  useEffect(() => {
    if (!composerIsOpen) {
      // Reset form state
      reset();
      // Reset attachments
      setAttachments([]);
      // Reset AI state
      aiDispatch({ type: 'RESET' });
      // Reset editor key to force a fresh instance
      composerDispatch({ type: 'INCREMENT_EDITOR_KEY' });
    }
  }, [composerIsOpen, reset, mode]);

  // Update saveDraft function
  const saveDraft = useCallback(async () => {
    if (!emailData || !emailData.latest) return;
    if (!getValues('messageContent')) return;

    try {
      composerDispatch({ type: 'SET_LOADING', payload: true });
      const originalEmail = emailData.latest;
      const draftData = {
        to: mode === 'forward' ? getValues('to').join(', ') : originalEmail.sender.email,
        subject: originalEmail.subject?.startsWith(mode === 'forward' ? 'Fwd: ' : 'Re: ')
          ? originalEmail.subject
          : `${mode === 'forward' ? 'Fwd: ' : 'Re: '}${originalEmail.subject || ''}`,
        message: getValues('messageContent'),
        attachments: attachments,
        id: draftId,
      };

      const response = await createDraft(draftData);

      if (response?.id && response.id !== draftId) {
        setDraftId(response.id);
      }

      toast.success('Draft saved');
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Failed to save draft');
    } finally {
      composerDispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [mode, emailData, getValues, attachments, draftId, setDraftId]);

  useEffect(() => {
    if (composerIsOpen) {
      console.log('Enabling compose scope (ReplyCompose)');
      enableScope('compose');
    } else {
      console.log('Disabling compose scope (ReplyCompose)');
      disableScope('compose');
    }

    return () => {
      console.log('Cleaning up compose scope (ReplyCompose)');
      disableScope('compose');
    };
  }, [composerIsOpen, enableScope, disableScope]);

  // Simplified composer visibility check
  if (!composerIsOpen) {
    if (!emailData || emailData.messages.length === 0) return null;

    // Get the latest email in the thread
    const latestEmail = emailData.latest;
    if (!latestEmail) return null;

    // Get all unique participants (excluding current user)
    const userEmail = session?.activeConnection?.email?.toLowerCase();
    const allParticipants = new Set<string>();

    // Add recipients from 'to' field
    latestEmail.to.forEach((recipient) => {
      if (recipient.email.toLowerCase() !== userEmail) {
        allParticipants.add(recipient.email.toLowerCase());
      }
    });

    // Add recipients from 'cc' field if exists
    if (latestEmail.cc) {
      latestEmail.cc.forEach((recipient) => {
        if (recipient.email.toLowerCase() !== userEmail) {
          allParticipants.add(recipient.email.toLowerCase());
        }
      });
    }

    // Add sender if not current user
    if (latestEmail.sender.email.toLowerCase() !== userEmail) {
      allParticipants.add(latestEmail.sender.email.toLowerCase());
    }

    // Show Reply All only if there are more than one participant (excluding current user)
    const showReplyAll = allParticipants.size > 1;

    return (
      <div className="bg-offsetLight dark:bg-offsetDark flex w-full gap-2 px-2">
        <Button
          onClick={() => {
            setMail((prev) => ({
              ...prev,
              replyComposerOpen: true,
              forwardComposerOpen: false,
              mode: 'reply',
            }));
          }}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md"
          variant="outline"
        >
          <Reply className="h-4 w-4" />
          <span>{t('common.threadDisplay.reply')}</span>
        </Button>
        {showReplyAll && (
          <Button
            onClick={() => {
              setMail((prev) => ({
                ...prev,
                replyComposerOpen: false,
                forwardComposerOpen: false,
                replyAllComposerOpen: true,
                mode: 'replyAll',
              }));
            }}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md"
            variant="outline"
          >
            <ReplyAll className="h-4 w-4" />
            <span>{t('common.threadDisplay.replyAll')}</span>
          </Button>
        )}
        <Button
          onClick={() => {
            setMail((prev) => ({
              ...prev,
              replyComposerOpen: false,
              forwardComposerOpen: true,
              mode: 'forward',
            }));
          }}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md"
          variant="outline"
        >
          <Forward className="h-4 w-4" />
          <span>{t('common.threadDisplay.forward')}</span>
        </Button>
      </div>
    );
  }
  if (!emailData) return null;
  return (
    <div className="bg-offsetLight dark:bg-offsetDark w-full px-2">
      <form
        ref={composerRef}
        className={cn(
          'border-border ring-offset-background relative z-20 flex flex-col rounded-[10px] border px-2 py-2 transition-all duration-300 ease-in-out',
          composerState.isEditorFocused ? 'ring-2 ring-[#3D3D3D] ring-offset-1' : '',
        )}
        style={{
          minHeight: '150px',
          maxHeight: '800px',
          overflow: 'hidden',
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={handleKeyDown}
      >
        {/* Drag overlay */}
        {composerState.isDragging && <DragOverlay />}

        {/* Header */}
        <div className="text-muted-foreground flex flex-shrink-0 items-start justify-between text-sm">
          {renderHeaderContent()}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowCc(!showCc);
                if (showCc) {
                  setValue('cc', []);
                }
                setIsEditingRecipients(true);
                setTimeout(() => {
                  ccInputRef.current?.focus();
                }, 0);
              }}
              className="text-xs"
            >
              {showCc ? 'Remove Cc' : 'Add Cc'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowBcc(!showBcc);
                if (showBcc) {
                  setValue('bcc', []);
                }
                setIsEditingRecipients(true);
                setTimeout(() => {
                  bccInputRef.current?.focus();
                }, 0);
              }}
              className="text-xs"
            >
              {showBcc ? 'Remove Bcc' : 'Add Bcc'}
            </Button>
            <CloseButton onClick={toggleComposer} />
          </div>
        </div>

        {/* Editor container with fixed menu and growing content */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="w-full overflow-auto">
            <Editor
              onAttachmentsChange={handleAttachment}
              key={composerState.editorKey}
              onChange={handleEditorChange}
              initialValue={composerState.editorInitialValue}
              onCommandEnter={handleCommandEnter}
              onTab={handleTabAccept}
              className={cn(
                'max-w-[600px] md:max-w-[100vw]',
                aiState.showOptions
                  ? 'rounded-md border border-dotted border-blue-200 bg-blue-50/30 p-1 dark:border-blue-800 dark:bg-blue-950/30'
                  : 'border border-transparent p-1',
                composerState.isLoading ? 'cursor-not-allowed opacity-50' : '',
              )}
              placeholder={
                aiState.showOptions
                  ? 'AI-generated reply (you can edit)'
                  : 'Type your reply here...'
              }
              onFocus={() => {
                composerDispatch({ type: 'SET_EDITOR_FOCUSED', payload: true });
              }}
              onBlur={() => {
                composerDispatch({ type: 'SET_EDITOR_FOCUSED', payload: false });
              }}
              myInfo={{
                name: session?.user.name,
                email: session?.user.email,
              }}
              senderInfo={{
                name: emailData.latest?.sender?.name,
                email: emailData.latest?.sender?.email,
              }}
            />
          </div>
        </div>

        {aiState.showOptions && (
          <div className="text-muted-foreground ml-2 mt-1 flex-shrink-0 text-xs">
            Press <kbd className="bg-muted rounded px-1 py-0.5">Tab</kbd> to accept
          </div>
        )}

        <div className="mt-auto flex flex-shrink-0 items-center justify-between">
          <div className="flex items-center gap-2">
            {!aiState.showOptions ? (
              <Button
                variant="outline"
                className="group relative w-40 overflow-hidden transition-all duration-200"
                onClick={(e) => {
                  e.preventDefault();
                  void handleAIButtonClick();
                }}
                disabled={aiState.isLoading}
              >
                {aiState.isLoading ? (
                  <div className="absolute left-[9px] h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                ) : (
                  <Sparkles className="absolute left-[9px] h-6 w-6" />
                )}
                <span className="whitespace-nowrap pl-5">
                  {aiState.isLoading ? 'Generating...' : 'Generate Email'}
                </span>
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  className="h-9 w-20 border bg-black px-12 text-white hover:bg-transparent dark:bg-white dark:text-black"
                  onClick={(e) => {
                    e.preventDefault();
                    acceptAISuggestion();
                  }}
                >
                  <Check className="h-5 w-5" />
                  Accept
                </Button>
                <Button
                  variant="ghost"
                  className="w-20 text-black/50 hover:bg-transparent dark:text-white/50"
                  onClick={(e) => {
                    e.preventDefault();
                    rejectAISuggestion();
                  }}
                >
                  <XIcon className="h-5 w-5" />
                  Reject
                </Button>
              </div>
            )}
            {/* Conditionally render the Popover only if attachments exist */}
            {attachments.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    <span>
                      {attachments.length}{' '}
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
                              <p className="text-xs font-medium">
                                {truncateFileName(file.name, 20)}
                              </p>
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
            )}
            {/* The Plus button is always visible, wrapped in a label for better click handling */}
            <div className="-pb-1.5 relative">
              <Input
                type="file"
                id="reply-attachment-input"
                className="absolute h-full w-full cursor-pointer opacity-0"
                onChange={handleAttachmentEvent}
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              />
              <Button
                variant="ghost"
                className="hover:bg-muted -ml-1 h-8 w-8 cursor-pointer rounded-full transition-transform"
                tabIndex={-1}
              >
                <Plus className="h-4 w-4 cursor-pointer" />
              </Button>
            </div>
          </div>
          <div className="mr-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              disabled={composerState.isLoading || !getValues('messageContent')}
              onClick={(e) => {
                e.preventDefault();
                void saveDraft();
              }}
            >
              {t('common.replyCompose.saveDraft')}
            </Button>
            <Button
              ref={sendButtonRef}
              size="sm"
              className={cn(
                'relative h-8 w-8 rounded-full',
                composerState.isLoading && 'cursor-not-allowed',
              )}
              onClick={handleSendEmail}
              disabled={composerState.isLoading}
              type="button"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

// Extract smaller components
const DragOverlay = () => {
  const t = useTranslations();
  return (
    <div className="bg-background/80 border-primary/30 absolute inset-0 z-50 m-4 flex items-center justify-center rounded-2xl border-2 border-dashed backdrop-blur-sm">
      <div className="text-muted-foreground flex flex-col items-center gap-2">
        <Paperclip className="text-muted-foreground h-12 w-12" />
        <p className="text-lg font-medium">{t('common.replyCompose.dropFiles')}</p>
      </div>
    </div>
  );
};
