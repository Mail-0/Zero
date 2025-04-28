import {
  CurvedArrow,
  Lightning,
  MediumStack,
  ShortStack,
  LongStack,
  Smile,
  X,
  Sparkles,
} from '../icons/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, MinusCircle, Paperclip, Plus, PlusCircle } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { generateAIEmailBody } from '@/actions/ai';
import { useThread } from '@/hooks/use-threads';
import { useSession } from '@/lib/auth-client';
import { Input } from '@/components/ui/input';
import { useDraft } from '@/hooks/use-drafts';
import { useForm } from 'react-hook-form';
import { useMemo, useState } from 'react';
import { ISendEmail } from '@/types';
import { useQueryState } from 'nuqs';
import { JSONContent } from 'novel';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import * as React from 'react';
import Editor from './editor';
import { z } from 'zod';

interface AIBodyResponse {
  content: string;
  jsonContent: JSONContent;
  type: 'email' | 'question' | 'system';
}

interface EmailComposerProps {
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
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [messageLength, setMessageLength] = useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [threadId] = useQueryState('threadId');
  const [mode] = useQueryState('mode');
  const [isComposeOpen] = useQueryState('isComposeOpen');
  const { data: emailData } = useThread(threadId ?? null);
  const { data: session } = useSession();
  const [draftId] = useQueryState('draftId');
  const { data: draft } = useDraft(draftId ?? null);

  React.useEffect(() => {
    if (draft) {
      if (draft.to) form.setValue('to', draft.to);
      // TODO: Fix this
      if (draft.content) form.setValue('message', draft.content);
      if (draft.subject) form.setValue('subject', draft.subject);
    }
  }, [draft]);

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

  React.useEffect(() => {
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
  const messageContent = watch('message');
  const attachments = watch('attachments');

  const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setValue('attachments', [...(attachments || []), ...Array.from(files)]);
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

  // Helper function to create JSONContent from text
  const createJsonContentFromText = (text: string): JSONContent => ({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  });

  // Add state for editor content
  const [editorContent, setEditorContent] = React.useState<JSONContent>(
    createJsonContentFromText(messageContent || ''),
  );

  // Update editorContent when messageContent changes
  React.useEffect(() => {
    setEditorContent(createJsonContentFromText(messageContent || ''));
  }, [messageContent]);

  const handleSend = async () => {
    try {
      setIsLoading(true);
      const values = getValues();
      await onSendEmail({
        to: values.to,
        cc: showCc ? values.cc : undefined,
        bcc: showBcc ? values.bcc : undefined,
        subject: values.subject,
        message: values.message,
        attachments: values.attachments || [],
      });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAIGenerate = async () => {
    try {
      setIsLoading(true);
      const values = getValues();
      const result = await generateAIEmailBody({
        prompt: values.message, // Use the current message as the prompt
        currentContent: '',
        subject: values.subject,
        to: values.to,
        userContext: {
          name: session?.user?.name,
          email: session?.user?.email,
        },
      });

      if (result.type === 'system') {
        toast.error(result.content || 'Failed to generate email');
        return;
      }

      if (result.type === 'question') {
        // Keep the AI compose mode active if we got a question back
        setValue('message', '');
        toast.info("Please answer the AI's question to continue");
      } else {
        // If we got email content, set it and exit AI compose mode
        setValue('message', result.content);
        // Update the editor content with the jsonContent
        setEditorContent(result.jsonContent || createJsonContentFromText(result.content));
        toast.success('Email generated successfully');
      }
      setHasUnsavedChanges(true);
    } catch (error) {
      console.error('Error generating AI email:', error);
      toast.error('Failed to generate email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateReply = async () => {};

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
                    e.key === 'Backspace' &&
                    !e.currentTarget.value &&
                    toEmails.length > 0
                  ) {
                    setValue('to', toEmails.slice(0, -1));
                    setHasUnsavedChanges(true);
                  }
                }}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              className="flex h-full items-center gap-2 text-sm font-medium text-[#8C8C8C] hover:text-[#A8A8A8]"
              onClick={() => setShowCc(!showCc)}
            >
              <span>Cc</span>
            </button>
            <button
              className="flex h-full items-center gap-2 text-sm font-medium text-[#8C8C8C] hover:text-[#A8A8A8]"
              onClick={() => setShowBcc(!showBcc)}
            >
              <span>Bcc</span>
            </button>
            {onClose && (
              <button
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
                    } else if (
                      e.key === 'Backspace' &&
                      !e.currentTarget.value &&
                      ccEmails?.length
                    ) {
                      setValue('cc', ccEmails.slice(0, -1));
                      setHasUnsavedChanges(true);
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
                    } else if (
                      e.key === 'Backspace' &&
                      !e.currentTarget.value &&
                      bccEmails?.length
                    ) {
                      setValue('bcc', bccEmails.slice(0, -1));
                      setHasUnsavedChanges(true);
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
          <Editor
            initialValue={editorContent}
            onChange={(content) => {
              // Extract plain text from the HTML content
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = content;
              const plainText = tempDiv.textContent || tempDiv.innerText || '';

              setValue('message', plainText);
              setMessageLength(plainText.length);
              setHasUnsavedChanges(true);
            }}
            className="w-full cursor-text"
            placeholder={'Start writing your email...'}
            onCommandEnter={handleSend}
          />
        </div>

        {/* Bottom Actions */}
        <div className="inline-flex items-center justify-between self-stretch">
          <div className="flex items-center justify-start gap-2">
            <div className="flex items-center justify-start gap-2">
              <button
                className="flex h-7 cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-md bg-black pl-1.5 pr-1 dark:bg-white"
                onClick={handleSend}
                disabled={
                  isLoading || !toEmails.length || !messageContent.trim() || !subjectInput.trim()
                }
              >
                <div className="flex items-center justify-center gap-2.5 pl-0.5">
                  <div className="text-center text-sm leading-none text-white dark:text-black">
                    {'Send email'}
                  </div>
                </div>
                <div className="flex h-5 items-center justify-center gap-1 rounded-sm bg-white/10 px-1 dark:bg-black/10">
                  <Command className="h-3.5 w-3.5 text-white dark:text-black" />
                  <CurvedArrow className="mt-1.5 h-4 w-4 fill-white dark:fill-black" />
                </div>
              </button>

              <button
                className="flex h-7 cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-md border border-[#8B5CF6] pl-1.5 pr-2 dark:bg-[#252525]"
                onClick={handleGenerateReply}
                disabled={isLoading || !toEmails.length || !subjectInput.trim()}
              >
                <div className="flex items-center justify-center gap-2.5 pl-0.5">
                  <div className="flex h-5 items-center justify-center gap-1 rounded-sm">
                    <Sparkles className="h-3.5 w-3.5 fill-black dark:fill-white" />
                  </div>
                  <div className="text-center text-sm leading-none text-black dark:text-white">
                    Generate
                  </div>
                </div>
              </button>

              <button
                className="flex h-7 items-center gap-0.5 overflow-hidden rounded-md border bg-white/5 px-1.5 shadow-sm hover:bg-white/10 dark:border-none"
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus className="h-3 w-3 fill-[#9A9A9A]" />
                <span className="px-0.5 text-sm">Add files</span>
              </button>

              <Input
                type="file"
                id="attachment-input"
                className="hidden"
                onChange={handleAttachment}
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                ref={fileInputRef}
              />

              {attachments && attachments.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="ml-2 flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-sm hover:bg-white/10">
                      <Paperclip className="h-3 w-3 text-[#9A9A9A]" />
                      <span>{attachments.length} files</span>
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
            <button className="flex h-7 items-center gap-0.5 overflow-hidden rounded-md bg-white/5 px-1.5 shadow-sm hover:bg-white/10">
              <Smile className="h-3 w-3 fill-[#9A9A9A]" />
              <span className="px-0.5 text-sm">Casual</span>
            </button>
            <button className="flex h-7 items-center gap-0.5 overflow-hidden rounded-md bg-white/5 px-1.5 shadow-sm hover:bg-white/10">
              {messageLength < 50 && <ShortStack className="h-3 w-3 fill-[#9A9A9A]" />}
              {messageLength >= 50 && messageLength < 200 && (
                <MediumStack className="h-3 w-3 fill-[#9A9A9A]" />
              )}
              {messageLength >= 200 && <LongStack className="h-3 w-3 fill-[#9A9A9A]" />}
              <span className="px-0.5 text-sm">
                {messageLength < 50
                  ? 'short-length'
                  : messageLength < 200
                    ? 'medium-length'
                    : 'long-length'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
