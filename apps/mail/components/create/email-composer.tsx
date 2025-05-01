import {
  CurvedArrow,
  MediumStack,
  ShortStack,
  LongStack,
  Smile,
  X,
  Sparkles,
} from '../icons/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TextEffect } from '@/components/motion-primitives/text-effect';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import useComposeEditor from '@/hooks/use-compose-editor';
import { Loader, Check, X as XIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Command, Paperclip, Plus } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { aiCompose } from '@/actions/ai-composer';
import { useThread } from '@/hooks/use-threads';
import { useSession } from '@/lib/auth-client';
import { createDraft } from '@/actions/drafts';
import { Input } from '@/components/ui/input';
import { EditorContent } from '@tiptap/react';
import { useForm } from 'react-hook-form';
import { useRef, useState } from 'react';
import { useQueryState } from 'nuqs';
import pluralize from 'pluralize';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { z } from 'zod';

interface EmailComposerProps {
  threadContent?: {
    from: string;
    to: string[];
    body: string;
  }[];
  initialTo?: string[];
  initialCc?: string[];
  initialBcc?: string[];
  initialSubject?: string;
  initialMessage?: string;
  initialAttachments?: File[];
  onSendEmail: (data: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    message: string;
    attachments: File[];
  }) => Promise<void>;
  onClose?: () => void;
  className?: string;
}

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const schema = z.object({
  to: z.array(z.string().email()).min(1),
  subject: z.string().min(1),
  message: z.string().min(1),
  attachments: z.array(z.any()).optional(),
  headers: z.any().optional(),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  threadId: z.string().optional(),
  fromEmail: z.string().optional(),
});

export function EmailComposer({
  threadContent = [],
  initialTo = [],
  initialCc = [],
  initialBcc = [],
  initialSubject = '',
  initialMessage = '',
  initialAttachments = [],
  onSendEmail,
  onClose,
  className,
}: EmailComposerProps) {
  const [showCc, setShowCc] = useState(initialCc.length > 0);
  const [showBcc, setShowBcc] = useState(initialBcc.length > 0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [messageLength, setMessageLength] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toInputRef = useRef<HTMLInputElement>(null);
  const [threadId] = useQueryState('threadId');
  const [mode] = useQueryState('mode');
  const [isComposeOpen] = useQueryState('isComposeOpen');
  const { data: emailData } = useThread(threadId ?? null);
  const { data: session } = useSession();
  const [draftId] = useQueryState('draftId');
  // const { data: draft } = useDraft(draftId ?? null);
  const [aiGeneratedMessage, setAiGeneratedMessage] = useState<string | null>(null);
  const [aiIsLoading, setAiIsLoading] = useState(false);

  useEffect(() => {
    if (isComposeOpen === 'true' && toInputRef.current) {
      toInputRef.current.focus();
    }
  }, [isComposeOpen]);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      to: initialTo,
      cc: initialCc,
      bcc: initialBcc,
      subject: initialSubject,
      message: initialMessage,
      attachments: initialAttachments,
    },
  });

  useEffect(() => {
    // Don't populate from threadId if we're in compose mode
    if (isComposeOpen === 'true') return;

    if (!emailData?.latest || !mode || !session?.activeConnection?.email) return;

    const userEmail = session.activeConnection.email.toLowerCase();
    const latestEmail = emailData.latest;
    const senderEmail = latestEmail.sender.email.toLowerCase();

    // Reset states
    form.reset();
    setShowCc(false);
    setShowBcc(false);

    // Set subject based on mode
    const subject =
      mode === 'forward'
        ? `Fwd: ${latestEmail.subject || ''}`
        : latestEmail.subject?.startsWith('Re:')
          ? latestEmail.subject
          : `Re: ${latestEmail.subject || ''}`;
    form.setValue('subject', subject);

    if (mode === 'reply') {
      // Reply to sender
      form.setValue('to', [latestEmail.sender.email]);
    } else if (mode === 'replyAll') {
      const to: string[] = [];
      const cc: string[] = [];

      // Add original sender if not current user
      if (senderEmail !== userEmail) {
        to.push(latestEmail.sender.email);
      }

      // Add original recipients from To field
      latestEmail.to?.forEach((recipient) => {
        const recipientEmail = recipient.email.toLowerCase();
        if (recipientEmail !== userEmail && recipientEmail !== senderEmail) {
          to.push(recipient.email);
        }
      });

      // Add CC recipients
      latestEmail.cc?.forEach((recipient) => {
        const recipientEmail = recipient.email.toLowerCase();
        if (recipientEmail !== userEmail && !to.includes(recipient.email)) {
          cc.push(recipient.email);
        }
      });

      // Add BCC recipients
      latestEmail.bcc?.forEach((recipient) => {
        const recipientEmail = recipient.email.toLowerCase();
        if (
          recipientEmail !== userEmail &&
          !to.includes(recipient.email) &&
          !cc.includes(recipient.email)
        ) {
          form.setValue('bcc', [...(bccEmails || []), recipient.email]);
          setShowBcc(true);
        }
      });

      form.setValue('to', to);
      if (cc.length > 0) {
        form.setValue('cc', cc);
        setShowCc(true);
      }
    }
    // For forward, we start with empty recipients
  }, [mode, emailData?.latest, session?.activeConnection?.email]);

  const { watch, setValue, getValues } = form;
  const toEmails = watch('to');
  const ccEmails = watch('cc');
  const bccEmails = watch('bcc');
  const subjectInput = watch('subject');
  const attachments = watch('attachments');

  const handleAttachment = (files: File[]) => {
    if (files && files.length > 0) {
      setValue('attachments', [...(attachments ?? []), ...files]);
      setHasUnsavedChanges(true);
    }
  };

  const removeAttachment = (index: number) => {
    setValue(
      'attachments',
      (attachments || []).filter((_, i) => i !== index),
    );
    setHasUnsavedChanges(true);
  };

  const editor = useComposeEditor({
    initialValue: initialMessage,
    isReadOnly: isLoading,
    onLengthChange: (length) => {
      setHasUnsavedChanges(true);
      setMessageLength(length);
    },
    onModEnter: () => {
      void handleSend();

      return true;
    },
    onAttachmentsChange: (files) => {
      handleAttachment(files);
    },
    placeholder: 'Start your email here',
  });

  const handleSend = async () => {
    try {
      setIsLoading(true);
      setAiGeneratedMessage(null);
      const values = getValues();
      await onSendEmail({
        to: values.to,
        cc: showCc ? values.cc : undefined,
        bcc: showBcc ? values.bcc : undefined,
        subject: values.subject,
        message: editor.getHTML(),
        attachments: values.attachments || [],
      });
      setHasUnsavedChanges(false);
      editor.commands.clearContent(true);
      form.reset();
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAiGenerate = async () => {
    try {
      setIsLoading(true);
      setAiIsLoading(true);
      const values = getValues();

      const result = await aiCompose({
        prompt: editor.getText(),
        emailSubject: values.subject,
        to: values.to,
        cc: values.cc,
        threadMessages: threadContent,
      });

      setAiGeneratedMessage(result.newBody);
      toast.success('Email generated successfully');
    } catch (error) {
      console.error('Error generating AI email:', error);
      toast.error('Failed to generate email');
    } finally {
      setIsLoading(false);
      setAiIsLoading(false);
    }
  };

  // It needs to be done this way so that react doesn't catch on to the state change
  // and we can still refresh to get the latest draft for the reply.
  const setDraftIdQueryParam = (draftId: string | null) => {
    const url = new URL(window.location.href);

    // mutate only one key
    draftId == null ? url.searchParams.delete('draftId') : url.searchParams.set('draftId', draftId);

    // keep Next’s internal state intact and update its mirrors
    const nextState = {
      ...window.history.state, // preserves __NA / _N etc.
      as: url.pathname + url.search,
      url: url.pathname + url.search,
    };

    window.history.replaceState(nextState, '', url);
  };

  const saveDraft = async () => {
    const values = getValues();

    if (!hasUnsavedChanges) return;
    console.log('DRAFT HTML', editor.getHTML());
    const messageText = editor.getHTML();
    console.log(values, messageText);
    if (!values.to.length || !values.subject.length || !messageText.length) return;

    try {
      setIsLoading(true);
      const draftData = {
        to: values.to.join(', '),
        cc: values.cc?.join(', '),
        bcc: values.bcc?.join(', '),
        subject: values.subject,
        message: messageText,
        attachments: values.attachments,
        id: draftId,
      };

      const response = await createDraft(draftData);

      if (response?.id && response.id !== draftId) {
        setDraftIdQueryParam(response.id);
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Failed to save draft');
    } finally {
      setIsLoading(false);
      setHasUnsavedChanges(false);
    }
  };

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const autoSaveTimer = setTimeout(() => {
      console.log('timeout set');
      saveDraft();
    }, 3000);

    return () => clearTimeout(autoSaveTimer);
  }, [hasUnsavedChanges, saveDraft]);

  return (
    <div
      className={cn(
        'w-full max-w-[750px] overflow-hidden rounded-2xl bg-[#FAFAFA] p-0 py-0 shadow-sm dark:bg-[#1A1A1A]',
        className,
      )}
    >
      <div className="border-b border-[#E7E7E7] pb-2 dark:border-[#252525]">
        <div className="flex justify-between px-3 pt-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-[#8C8C8C]">To:</p>
            <div className="flex flex-wrap items-center gap-2">
              {toEmails.map((email, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 rounded-full border border-[#DBDBDB] px-1 py-0.5 pr-2 dark:border-[#2B2B2B]"
                >
                  <span className="flex gap-1 py-0.5 text-sm text-black dark:text-white">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="rounded-full bg-[#F5F5F5] text-xs font-bold text-[#6D6D6D] dark:bg-[#373737] dark:text-[#9B9B9B]">
                        {email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {email}
                  </span>
                  <button
                    onClick={() => {
                      setValue(
                        'to',
                        toEmails.filter((_, i) => i !== index),
                      );
                      setHasUnsavedChanges(true);
                    }}
                    className="text-white/50 hover:text-white/90"
                  >
                    <X className="mt-0.5 h-3.5 w-3.5 fill-black dark:fill-[#9A9A9A]" />
                  </button>
                </div>
              ))}
              <input
                ref={toInputRef}
                className="h-6 flex-1 bg-transparent text-sm font-normal leading-normal text-black placeholder:text-[#797979] focus:outline-none dark:text-white"
                placeholder="Enter email"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    e.preventDefault();
                    if (isValidEmail(e.currentTarget.value.trim())) {
                      setValue('to', [...toEmails, e.currentTarget.value.trim()]);
                      e.currentTarget.value = '';
                      setHasUnsavedChanges(true);
                    } else {
                      toast.error('Please enter a valid email address');
                    }
                  } else if (
                    (e.key === ' ' && e.currentTarget.value.trim()) ||
                    (e.key === 'Tab' && e.currentTarget.value.trim())
                  ) {
                    e.preventDefault();
                    if (isValidEmail(e.currentTarget.value.trim())) {
                      setValue('to', [...toEmails, e.currentTarget.value.trim()]);
                      e.currentTarget.value = '';
                      setHasUnsavedChanges(true);
                    } else {
                      toast.error('Please enter a valid email address');
                    }
                  } else if (
                    e.key === 'Backspace' &&
                    !e.currentTarget.value &&
                    toEmails.length > 0
                  ) {
                    setValue('to', toEmails.slice(0, -1));
                    setHasUnsavedChanges(true);
                  }
                }}
                onBlur={(e) => {
                  if (e.currentTarget.value.trim()) {
                    if (isValidEmail(e.currentTarget.value.trim())) {
                      setValue('to', [...toEmails, e.currentTarget.value.trim()]);
                      e.currentTarget.value = '';
                      setHasUnsavedChanges(true);
                    } else {
                      toast.error('Please enter a valid email address');
                    }
                  }
                }}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              tabIndex={-1}
              className="flex h-full items-center gap-2 text-sm font-medium text-[#8C8C8C] hover:text-[#A8A8A8]"
              onClick={() => setShowCc(!showCc)}
            >
              <span>Cc</span>
            </button>
            <button
              tabIndex={-1}
              className="flex h-full items-center gap-2 text-sm font-medium text-[#8C8C8C] hover:text-[#A8A8A8]"
              onClick={() => setShowBcc(!showBcc)}
            >
              <span>Bcc</span>
            </button>
            {onClose && (
              <button
                tabIndex={-1}
                className="flex h-full items-center gap-2 text-sm font-medium text-[#8C8C8C] hover:text-[#A8A8A8]"
                onClick={onClose}
              >
                <X className="h-3.5 w-3.5 fill-[#9A9A9A]" />
              </button>
            )}
          </div>
        </div>

        <div className={`flex flex-col gap-2 ${showCc || showBcc ? 'pt-2' : ''}`}>
          {/* CC Section */}
          {showCc && (
            <div className="flex items-center gap-2 px-3">
              <p className="text-sm font-medium text-[#8C8C8C]">Cc:</p>
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {ccEmails?.map((email, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1 rounded-full border border-[#DBDBDB] px-2 py-0.5 dark:border-[#2B2B2B]"
                  >
                    <span className="flex gap-1 py-0.5 text-sm text-black dark:text-white">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="rounded-full bg-[#F5F5F5] text-xs font-bold text-[#6D6D6D] dark:bg-[#373737] dark:text-[#9B9B9B]">
                          {email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {email}
                    </span>
                    <button
                      onClick={() => {
                        setValue(
                          'cc',
                          ccEmails.filter((_, i) => i !== index),
                        );
                        setHasUnsavedChanges(true);
                      }}
                      className="text-white/50 hover:text-white/90"
                    >
                      <X className="mt-0.5 h-3.5 w-3.5 fill-black dark:fill-[#9A9A9A]" />
                    </button>
                  </div>
                ))}
                <input
                  className="h-6 flex-1 bg-transparent text-sm font-normal leading-normal text-black placeholder:text-[#797979] focus:outline-none dark:text-white"
                  placeholder="Enter email"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      e.preventDefault();
                      if (isValidEmail(e.currentTarget.value.trim())) {
                        setValue('cc', [...(ccEmails || []), e.currentTarget.value.trim()]);
                        e.currentTarget.value = '';
                        setHasUnsavedChanges(true);
                      } else {
                        toast.error('Please enter a valid email address');
                      }
                    } else if (e.key === ' ' && e.currentTarget.value.trim()) {
                      e.preventDefault();
                      if (isValidEmail(e.currentTarget.value.trim())) {
                        setValue('cc', [...(ccEmails || []), e.currentTarget.value.trim()]);
                        e.currentTarget.value = '';
                        setHasUnsavedChanges(true);
                      } else {
                        toast.error('Please enter a valid email address');
                      }
                    } else if (
                      e.key === 'Backspace' &&
                      !e.currentTarget.value &&
                      ccEmails?.length
                    ) {
                      setValue('cc', ccEmails.slice(0, -1));
                      setHasUnsavedChanges(true);
                    }
                  }}
                  onBlur={(e) => {
                    if (e.currentTarget.value.trim()) {
                      if (isValidEmail(e.currentTarget.value.trim())) {
                        setValue('cc', [...(ccEmails || []), e.currentTarget.value.trim()]);
                        e.currentTarget.value = '';
                        setHasUnsavedChanges(true);
                      } else {
                        toast.error('Please enter a valid email address');
                      }
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* BCC Section */}
          {showBcc && (
            <div className="flex items-center gap-2 px-3">
              <p className="text-sm font-medium text-[#8C8C8C]">Bcc:</p>
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {bccEmails?.map((email, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1 rounded-full border border-[#DBDBDB] px-2 py-0.5 dark:border-[#2B2B2B]"
                  >
                    <span className="flex gap-1 py-0.5 text-sm text-black dark:text-white">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="rounded-full bg-[#F5F5F5] text-xs font-bold text-[#6D6D6D] dark:bg-[#373737] dark:text-[#9B9B9B]">
                          {email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {email}
                    </span>
                    <button
                      onClick={() => {
                        setValue(
                          'bcc',
                          bccEmails.filter((_, i) => i !== index),
                        );
                        setHasUnsavedChanges(true);
                      }}
                      className="text-white/50 hover:text-white/90"
                    >
                      <X className="mt-0.5 h-3.5 w-3.5 fill-black dark:fill-[#9A9A9A]" />
                    </button>
                  </div>
                ))}
                <input
                  className="h-6 flex-1 bg-transparent text-sm font-normal leading-normal text-black placeholder:text-[#797979] focus:outline-none dark:text-white"
                  placeholder="Enter email"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      e.preventDefault();
                      if (isValidEmail(e.currentTarget.value.trim())) {
                        setValue('bcc', [...(bccEmails || []), e.currentTarget.value.trim()]);
                        e.currentTarget.value = '';
                        setHasUnsavedChanges(true);
                      } else {
                        toast.error('Please enter a valid email address');
                      }
                    } else if (e.key === ' ' && e.currentTarget.value.trim()) {
                      e.preventDefault();
                      if (isValidEmail(e.currentTarget.value.trim())) {
                        setValue('bcc', [...(bccEmails || []), e.currentTarget.value.trim()]);
                        e.currentTarget.value = '';
                        setHasUnsavedChanges(true);
                      } else {
                        toast.error('Please enter a valid email address');
                      }
                    } else if (
                      e.key === 'Backspace' &&
                      !e.currentTarget.value &&
                      bccEmails?.length
                    ) {
                      setValue('bcc', bccEmails.slice(0, -1));
                      setHasUnsavedChanges(true);
                    }
                  }}
                  onBlur={(e) => {
                    if (e.currentTarget.value.trim()) {
                      if (isValidEmail(e.currentTarget.value.trim())) {
                        setValue('bcc', [...(bccEmails || []), e.currentTarget.value.trim()]);
                        e.currentTarget.value = '';
                        setHasUnsavedChanges(true);
                      } else {
                        toast.error('Please enter a valid email address');
                      }
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subject */}
      <div className="flex items-center gap-2 p-3">
        <p className="text-sm font-medium text-[#8C8C8C]">Subject:</p>
        <input
          className="h-4 w-full bg-transparent text-sm font-normal leading-normal text-black placeholder:text-[#797979] focus:outline-none dark:text-white/90"
          placeholder="Re: Design review feedback"
          value={subjectInput}
          onChange={(e) => {
            setValue('subject', e.target.value);
            setHasUnsavedChanges(true);
          }}
        />
      </div>

      {/* Message Content */}
      <div className="relative -bottom-1 flex flex-col items-start justify-start gap-2 self-stretch border-t bg-[#FFFFFF] px-3 py-3 outline-white/5 dark:bg-[#202020]">
        <div className="flex flex-col gap-2.5 self-stretch">
          <EditorContent editor={editor} />
        </div>

        {/* Bottom Actions */}
        <div className="inline-flex items-center justify-between self-stretch">
          <div className="flex items-center justify-start gap-2">
            <div className="flex items-center justify-start gap-2">
              <button
                className="flex h-7 cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-md bg-black pl-1.5 pr-1 dark:bg-white"
                onClick={handleSend}
                disabled={
                  isLoading || !toEmails.length || !editor.getHTML().trim() || !subjectInput.trim()
                }
              >
                <div className="flex items-center justify-center gap-2.5 pl-0.5">
                  <div className="text-center text-sm leading-none text-white dark:text-black">
                    <span className="hidden md:block">Send email</span>
                    <span className="block md:hidden">Send</span>
                  </div>
                </div>
                <div className="flex h-5 items-center justify-center gap-1 rounded-sm bg-white/10 px-1 dark:bg-black/10">
                  <Command className="h-3.5 w-3.5 text-white dark:text-black" />
                  <CurvedArrow className="mt-1.5 h-4 w-4 fill-white dark:fill-black" />
                </div>
              </button>

              <button
                className="flex h-7 items-center gap-0.5 overflow-hidden rounded-md border bg-white/5 px-1.5 shadow-sm hover:bg-white/10 dark:border-none"
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus className="h-3 w-3 fill-[#9A9A9A]" />
                <span className="hidden px-0.5 text-sm md:block">Add files</span>
              </button>

              <Input
                type="file"
                id="attachment-input"
                className="hidden"
                onChange={(event) => {
                  const fileList = event.target.files;
                  if (fileList) {
                    handleAttachment(Array.from(fileList));
                  }
                }}
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                ref={fileInputRef}
              />

              {attachments && attachments.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-sm hover:bg-white/10">
                      <Paperclip className="h-3 w-3 text-[#9A9A9A]" />
                      <span>{pluralize('file', attachments.length, true)}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 bg-[#202020] p-3" align="start">
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-white/90">Attachments</h4>
                      <div className="max-h-[200px] space-y-2 overflow-y-auto">
                        {attachments.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between gap-2 rounded-md bg-white/5 p-2"
                          >
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="text-sm text-white/90">{file.name}</p>
                                <p className="text-xs text-[#9A9A9A]">
                                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => removeAttachment(index)}
                              className="rounded-sm p-1 hover:bg-white/10"
                            >
                              <X className="h-4 w-4 fill-[#9A9A9A]" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          <div className="flex items-start justify-start gap-2">
            <div className="relative">
              <AnimatePresence>
                {aiGeneratedMessage !== null ? (
                  <ContentPreview
                    content={aiGeneratedMessage}
                    onAccept={() => {
                      editor.commands.setContent({
                        type: 'doc',
                        content: aiGeneratedMessage.split(/\r?\n/).map((line) => {
                          return {
                            type: 'paragraph',
                            content: line.trim().length === 0 ? [] : [{ type: 'text', text: line }],
                          };
                        }),
                      });
                      setAiGeneratedMessage(null);
                    }}
                    onReject={() => {
                      setAiGeneratedMessage(null);
                    }}
                  />
                ) : null}
              </AnimatePresence>
              <button
                className="flex h-7 cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-md border border-[#8B5CF6] pl-1.5 pr-2 dark:bg-[#252525]"
                onClick={async () => {
                  if (!toEmails.length || !subjectInput.trim()) {
                    toast.error('Please enter a recipient and subject');
                    return;
                  }
                  setAiGeneratedMessage(null);
                  await handleAiGenerate();
                }}
                disabled={isLoading || aiIsLoading}
              >
                <div className="flex items-center justify-center gap-2.5 pl-0.5">
                  <div className="flex h-5 items-center justify-center gap-1 rounded-sm">
                    {aiIsLoading ? (
                      <Loader className="h-3.5 w-3.5 animate-spin fill-black dark:fill-white" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 fill-black dark:fill-white" />
                    )}
                  </div>
                  <div className="text-center text-sm leading-none text-black dark:text-white">
                    Generate
                  </div>
                </div>
              </button>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  disabled
                  className="flex h-7 items-center gap-0.5 overflow-hidden rounded-md bg-white/5 px-1.5 shadow-sm hover:bg-white/10"
                >
                  <Smile className="h-3 w-3 fill-[#9A9A9A]" />
                  <span className="px-0.5 text-sm">Casual</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Coming soon...</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  disabled
                  className="flex h-7 items-center gap-0.5 overflow-hidden rounded-md bg-white/5 px-1.5 shadow-sm hover:bg-white/10"
                >
                  {messageLength < 50 && <ShortStack className="h-3 w-3 fill-[#9A9A9A]" />}
                  {messageLength >= 50 && messageLength < 200 && (
                    <MediumStack className="h-3 w-3 fill-[#9A9A9A]" />
                  )}
                  {messageLength >= 200 && <LongStack className="h-3 w-3 fill-[#9A9A9A]" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Coming soon...</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}

const animations = {
  container: {
    initial: { width: 32, opacity: 0 },
    animate: (width: number) => ({
      width: width < 640 ? '200px' : '400px',
      opacity: 1,
      transition: {
        width: { type: 'spring', stiffness: 250, damping: 35 },
        opacity: { duration: 0.4 },
      },
    }),
    exit: {
      width: 32,
      opacity: 0,
      transition: {
        width: { type: 'spring', stiffness: 250, damping: 35 },
        opacity: { duration: 0.4 },
      },
    },
  },
  content: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { delay: 0.15, duration: 0.4 } },
    exit: { opacity: 0, transition: { duration: 0.3 } },
  },
  input: {
    initial: { y: 10, opacity: 0 },
    animate: { y: 0, opacity: 1, transition: { delay: 0.3, duration: 0.4 } },
    exit: { y: 10, opacity: 0, transition: { duration: 0.3 } },
  },
  button: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1, transition: { delay: 0.4, duration: 0.3 } },
    exit: { opacity: 0, scale: 0.8, transition: { duration: 0.2 } },
  },
  card: {
    initial: { opacity: 0, y: 10, scale: 0.95 },
    animate: { opacity: 1, y: -10, scale: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.2 } },
  },
};

const ContentPreview = ({
  content,
  onAccept,
  onReject,
}: {
  content: string;
  onAccept?: (value: string) => void | Promise<void>;
  onReject?: () => void | Promise<void>;
}) => (
  <motion.div
    variants={animations.card}
    initial="initial"
    animate="animate"
    exit="exit"
    className="absolute bottom-full right-0 z-30 w-[400px] overflow-hidden rounded-xl border bg-white shadow-md dark:bg-black"
  >
    <div
      className="max-h-60 min-h-[150px] overflow-y-auto rounded-md p-1 p-3 text-sm"
      style={{
        scrollbarGutter: 'stable',
      }}
    >
      {content.split('\n').map((line, i) => {
        return (
          <TextEffect per="char" preset="blur" as="div" className="whitespace-pre-wrap" key={i}>
            {line}
          </TextEffect>
        );
      })}
    </div>
    <div className="flex justify-end gap-2 p-2">
      <button
        className="flex h-7 items-center gap-0.5 overflow-hidden rounded-md border bg-red-700 px-1.5 text-sm shadow-sm hover:bg-red-800 dark:border-none"
        onClick={async () => {
          if (onReject) {
            await onReject();
          }
        }}
      >
        <div className="flex h-5 items-center justify-center gap-1 rounded-sm">
          <XIcon className="h-3.5 w-3.5" />
        </div>
        <span>Reject</span>
      </button>
      <button
        className="flex h-7 items-center gap-0.5 overflow-hidden rounded-md border bg-green-700 px-1.5 text-sm shadow-sm hover:bg-green-800 dark:border-none"
        onClick={async () => {
          if (onAccept) {
            await onAccept(content);
          }
        }}
      >
        <div className="flex h-5 items-center justify-center gap-1 rounded-sm">
          <Check className="h-3.5 w-3.5" />
        </div>
        <span>Accept</span>
      </button>
    </div>
  </motion.div>
);
