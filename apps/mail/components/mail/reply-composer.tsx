'use client';

import {
  type Dispatch,
  type SetStateAction,
  useRef,
  useState,
  useEffect,
  useCallback,
  useReducer,
} from 'react';
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
import {
  cleanEmailAddress,
  truncateFileName,
  cn,
  convertJSONToHTML,
  createAIJsonContent,
  constructReplyBody,
} from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UploadedFileIcon } from '@/components/create/uploaded-file-icon';
import { generateAIResponse } from '@/actions/ai-reply';
import { Separator } from '@/components/ui/separator';
import Editor from '@/components/create/editor';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';
import { useTranslations } from 'next-intl';
import { sendEmail } from '@/actions/send';
import { useForm } from 'react-hook-form';
import type { JSONContent } from 'novel';
import { toast } from 'sonner';
import type { z } from 'zod';
import { useSettings } from '@/hooks/use-settings';
import { useMail } from '@/components/mail/use-mail';
import { useThread } from '@/hooks/use-threads';
import { useQueryState } from 'nuqs';
import { Sender } from '@/types';

import { createDraft } from '@/actions/drafts';

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
  mode?: 'reply' | 'forward';
}

type FormData = {
  messageContent: string;
  to: string;
};

export default function ReplyCompose({ mode = 'reply' }: ReplyComposeProps) {
  const [threadId] = useQueryState('threadId');
  const { data: emailData } = useThread(threadId);
  const [attachments, setAttachments] = useState<File[]>([]);
  const { data: session } = useSession();
  const [mail, setMail] = useMail();
  const [toInput, setToInput] = useState('');
  const [toEmails, setToEmails] = useState<string[]>([]);
  const [includeSignature, setIncludeSignature] = useState(true);
  const { settings } = useSettings();
  const [draftId, setDraftId] = useQueryState('draftId');

  // Use global state instead of local state
  const composerIsOpen = mode === 'reply' ? mail.replyComposerOpen : mail.forwardComposerOpen;
  const setComposerIsOpen = (value: boolean) => {
    setMail((prev: typeof mail) => ({
      ...prev,
      replyComposerOpen: mode === 'reply' ? value : prev.replyComposerOpen,
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

  // Handle keyboard shortcuts for sending email
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Check for Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (isFormValid) {
        void handleSendEmail(e as unknown as React.MouseEvent<HTMLButtonElement>);
      }
    }
  };

  const handleAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      composerDispatch({ type: 'SET_UPLOADING', payload: true });
      try {
        await new Promise((resolve) => setTimeout(resolve, 500));
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

  const handleAddEmail = (email: string) => {
    const trimmedEmail = email.trim().replace(/,$/, '');

    if (!trimmedEmail) return;

    if (toEmails.includes(trimmedEmail)) {
      setToInput('');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      toast.error(`Invalid email format: ${trimmedEmail}`);
      return;
    }

    setToEmails([...toEmails, trimmedEmail]);
    setToInput('');
    form.setValue('to', toEmails.join(', '));
  };

  const form = useForm<FormData>({
    defaultValues: {
      messageContent: '',
      to: '',
    },
  });

  // Add a loading state
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSendEmail = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!emailData) return;
    setIsSubmitting(true);
    try {
      const originalEmail = emailData[0];
      const userEmail = session?.activeConnection?.email?.toLowerCase();

      if (!userEmail) {
        throw new Error('Active connection email not found');
      }

      if (!originalEmail) {
        throw new Error('Original email not found');
      }

      // Handle subject based on mode
      const subject =
        mode === 'forward'
          ? `Fwd: ${originalEmail.subject || ''}`
          : originalEmail.subject?.startsWith('Re:')
            ? originalEmail.subject
            : `Re: ${originalEmail?.subject || ''}`;

      const recipients: Sender[] =
        mode === 'forward'
          ? toEmails.map((email) => ({ email, name: 'User' }))
          : [
            {
              email: cleanEmailAddress(originalEmail.sender.email),
              name: originalEmail.sender.name ? originalEmail.sender.name : ''
            }
          ]


      const cc: Sender[] | null = originalEmail.cc ? originalEmail.cc.map((to) => ({
        email: cleanEmailAddress(to.email),
        name: to.name ? to.name : ''
      })) : null

      if (!recipients) {
        throw new Error('No valid recipients found');
      }

      const messageId = originalEmail.messageId;
      const threadId = originalEmail.threadId;
      const formattedMessage = form.getValues('messageContent');
      const originalDate = new Date(originalEmail.receivedOn || '').toLocaleString();
      const quotedMessage = originalEmail.decodedBody;

      const replyBody = constructReplyBody(
        formattedMessage,
        originalDate,
        originalEmail.sender,
        recipients,
        quotedMessage,
      );

      const inReplyTo = messageId;
      const existingRefs = originalEmail.references?.split(' ') || [];
      const references = [...existingRefs, originalEmail?.inReplyTo, cleanEmailAddress(messageId)]
        .filter(Boolean)
        .join(' ');

      await sendEmail({
        to: recipients,
        cc: cc ?? undefined,
        subject,
        message: replyBody,
        attachments,
        headers: {
          'In-Reply-To': inReplyTo ?? '',
          References: references,
          'Thread-Id': threadId ?? '',
        },
      });

      form.reset();
      setComposerIsOpen(false);
      toast.success(t('pages.createEmail.emailSentSuccessfully'));
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error(t('pages.createEmail.failedToSendEmail'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleComposer = () => {
    setComposerIsOpen(!composerIsOpen);
    if (!composerIsOpen) {
      // Focus will be handled by the useEffect below
    }
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

  // Check if the message is empty
  const isMessageEmpty =
    !form.getValues('messageContent') ||
    form.getValues('messageContent') ===
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
      const latestEmail = emailData[emailData.length - 1];
      const originalSender = latestEmail?.sender?.name || 'the recipient';

      // Create a summary of the thread content for context
      const threadContent = emailData
        .map((email) => {
          return `
From: ${email.sender?.name || 'Unknown'} <${email.sender?.email || 'unknown@email.com'}>
Subject: ${email.subject || 'No Subject'}
Date: ${new Date(email.receivedOn || '').toLocaleString()}

${email.decodedBody || 'No content'}
          `;
        })
        .join('\n---\n');

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

      form.setValue('messageContent', htmlContent);

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

  // Helper function to render the header content based on mode
  const renderHeaderContent = () => {
    if (!emailData) return;
    if (mode === 'forward') {
      return (
        <div className="flex items-center gap-2">
          <Forward className="h-4 w-4" />
          <p className="truncate">Forward email</p>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Reply className="h-4 w-4" />
        <p className="truncate"> ({emailData[emailData.length - 1]?.sender?.email})</p>
      </div>
    );
  };

  // Extract recipient input component for reusability
  const RecipientInput = () => (
    <div className="ml-1 flex items-center">
      <div className="text-muted-foreground flex-shrink-0 text-right text-[1rem] font-[600] opacity-50">
        {t('common.mailDisplay.to')}
      </div>
      <div className="group relative left-[2px] flex w-full flex-wrap items-center rounded-md border border-none bg-transparent p-1 transition-all focus-within:border-none focus:outline-none">
        {toEmails.map((email, index) => (
          <EmailTag
            key={index}
            email={email}
            onRemove={() => {
              setToEmails((emails) => emails.filter((_, i) => i !== index));
              form.setValue('to', toEmails.join(', '));
            }}
          />
        ))}
        <input
          type="email"
          className="text-md relative left-[3px] min-w-[120px] flex-1 bg-transparent placeholder:text-[#616161] placeholder:opacity-50 focus:outline-none"
          placeholder={toEmails.length ? '' : t('pages.createEmail.example')}
          value={toInput}
          onChange={(e) => setToInput(e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            const pastedText = e.clipboardData.getData('text');
            const emails = pastedText.split(/[,\n]/).map(email => email.trim());
            emails.forEach(email => {
              if (email && !toEmails.includes(email) && isValidEmail(email)) {
                setToEmails(prev => [...prev, email]);
              }
            });
          }}
          onKeyDown={(e) => {
            if ((e.key === ',' || e.key === 'Enter' || e.key === ' ') && toInput.trim()) {
              e.preventDefault();
              handleAddEmail(toInput);
            } else if (e.key === 'Backspace' && !toInput && toEmails.length > 0) {
              setToEmails((emails) => emails.filter((_, i) => i !== emails.length - 1));
            }
          }}
        />
      </div>
    </div>
  );

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
      form.reset();
      // Reset attachments
      setAttachments([]);
      // Reset AI state
      aiDispatch({ type: 'RESET' });
      // Reset to emails if in forward mode
      if (mode === 'forward') {
        setToEmails([]);
        setToInput('');
      }
      // Reset editor key to force a fresh instance
      composerDispatch({ type: 'INCREMENT_EDITOR_KEY' });
    }
  }, [composerIsOpen, form, mode]);

  // Add saveDraft function
  const saveDraft = useCallback(async () => {
    if (!emailData || !emailData[0]) return;
    if (!form.getValues('messageContent')) return;

    try {
      composerDispatch({ type: 'SET_LOADING', payload: true });
      const originalEmail = emailData[0];
      const draftData = {
        to: mode === 'forward' ? toEmails.join(', ') : originalEmail.sender.email,
        subject: originalEmail.subject?.startsWith(mode === 'forward' ? 'Fwd: ' : 'Re: ')
          ? originalEmail.subject
          : `${mode === 'forward' ? 'Fwd: ' : 'Re: '}${originalEmail.subject || ''}`,
        message: form.getValues('messageContent'),
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
  }, [mode, toEmails, emailData, form, attachments, draftId, setDraftId]);

  // Update onChange handler in Editor component
  const handleEditorChange = (content: string) => {
    form.setValue('messageContent', content);
  };

  // Simplified composer visibility check
  if (!composerIsOpen) {
    if (mode === 'reply') {
      return (
        <div className="bg-offsetLight dark:bg-offsetDark w-full px-2">
          <Button
            onClick={toggleComposer}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md"
            variant="outline"
          >
            <ReplyAll className="h-4 w-4" />
            <span>
              {t('common.replyCompose.replyTo')} All
            </span>
          </Button>
        </div>
      );
    }
    return null;
  }
  if (!emailData) return;
  return (
    <div className="bg-offsetLight dark:bg-offsetDark w-full px-2">
      <form
        ref={composerRef}
        className={cn(
          'border-border ring-offset-background relative z-20 flex flex-col space-y-2.5 rounded-[10px] border px-2 py-2 transition-all duration-300 ease-in-out',
          composerState.isEditorFocused ? 'ring-2 ring-[#3D3D3D] ring-offset-1' : '',
        )}
        style={{
          minHeight: '150px',
          maxHeight: '800px',
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onSubmit={(e) => e.preventDefault()}
        onKeyDown={handleKeyDown}
      >
        {/* Drag overlay */}
        {composerState.isDragging && <DragOverlay />}

        {/* Header */}
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          {renderHeaderContent()}
          <CloseButton onClick={toggleComposer} />
        </div>

        {/* Recipient input for forward mode */}
        {mode === 'forward' && <RecipientInput />}

        {/* Editor container with fixed menu and growing content */}
        <div className="flex flex-grow flex-col">
          <div className="w-full">
            <Editor
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
                name: emailData[0]?.sender?.name,
                email: emailData[0]?.sender?.email,
              }}
            />
            <div
              className="h-2 w-full cursor-ns-resize hover:bg-gray-200 dark:hover:bg-gray-700"
              onMouseDown={handleResizeStart}
            />
          </div>
        </div>

        {aiState.showOptions && (
          <div className="text-muted-foreground ml-2 mt-1 text-xs">
            Press <kbd className="bg-muted rounded px-1 py-0.5">Tab</kbd> to accept
          </div>
        )}

        <div className="mt-auto flex items-center justify-between">
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
            <input
              type="file"
              id="attachment-input"
              className="hidden"
              onChange={handleAttachment}
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            />
          </div>
          <div className="mr-2 flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8" 
              disabled={composerState.isLoading || !form.getValues('messageContent')}
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
              className={cn('relative h-8 w-8 rounded-full', composerState.isLoading && 'cursor-not-allowed')}
              onClick={async (e) => {
                e.preventDefault();
                await handleSendEmail(e);
              }}
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

const CloseButton = ({ onClick }: { onClick: (e: React.MouseEvent) => void }) => (
  <Button
    variant="ghost"
    size="icon"
    className="h-6 w-6"
    onClick={(e) => {
      e.preventDefault();
      onClick(e);
    }}
  >
    <X className="h-4 w-4" />
  </Button>
);
