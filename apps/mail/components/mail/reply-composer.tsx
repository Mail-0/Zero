import { type Dispatch, type SetStateAction, useRef, useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UploadedFileIcon } from '@/components/create/uploaded-file-icon';
import { ArrowUp, Paperclip, Reply, X, Plus } from 'lucide-react';
import { cleanEmailAddress, truncateFileName } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import Editor from '@/components/create/editor';
import { Button } from '@/components/ui/button';
import type { ParsedMessage } from '@/types';
import { useTranslations } from 'next-intl';
import { sendEmail } from '@/actions/send';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ReplyComposeProps {
  emailData: ParsedMessage[];
  isOpen?: boolean;
  setIsOpen?: Dispatch<SetStateAction<boolean>>;
}

export default function ReplyCompose({ emailData, isOpen, setIsOpen }: ReplyComposeProps) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const t = useTranslations();

  // Use external state if provided, otherwise use internal state
  const composerIsOpen = isOpen !== undefined ? isOpen : isComposerOpen;
  const setComposerIsOpen = (value: boolean) => {
    if (setIsOpen) {
      setIsOpen(value);
    } else {
      setIsComposerOpen(value);
    }
  };

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
      setIsUploading(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, 500));
        setAttachments([...attachments, ...Array.from(e.target.files)]);
      } finally {
        setIsUploading(false);
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
        setAttachments([...attachments, ...Array.from(e.dataTransfer.files)]);
        // Open the composer if it's not already open
        if (!composerIsOpen) {
          setComposerIsOpen(true);
        }
      }
    }
  };

  const constructReplyBody = (
    formattedMessage: string,
    originalDate: string,
    originalSender: { name?: string; email?: string } | undefined,
    cleanedToEmail: string,
    quotedMessage?: string,
  ) => {
    return `
      <div style="font-family: Arial, sans-serif;">
        <div style="margin-bottom: 20px;">
          ${formattedMessage}
        </div>
        <div style="padding-left: 1em; margin-top: 1em; border-left: 2px solid #ccc; color: #666;">
          <div style="margin-bottom: 1em;">
            On ${originalDate}, ${originalSender?.name ? `${originalSender.name} ` : ''}${originalSender?.email ? `&lt;${cleanedToEmail}&gt;` : ''} wrote:
          </div>
          <div style="white-space: pre-wrap;">
            ${quotedMessage}
          </div>
        </div>
      </div>
    `;
  };

  const handleSendEmail = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      const originalSubject = emailData[0]?.subject || '';
      const subject = originalSubject.startsWith('Re:')
        ? originalSubject
        : `Re: ${originalSubject}`;

      const originalSender = emailData[0]?.sender;
      const cleanedToEmail = cleanEmailAddress(emailData[emailData.length - 1]?.sender?.email);
      const originalDate = new Date(emailData[0]?.receivedOn || '').toLocaleString();
      const quotedMessage = emailData[0]?.decodedBody;
      const messageId = emailData[0]?.messageId;
      const threadId = emailData[0]?.threadId;

      const formattedMessage = messageContent;

      const replyBody = constructReplyBody(
        formattedMessage,
        originalDate,
        originalSender,
        cleanedToEmail,
        quotedMessage,
      );

      const inReplyTo = messageId;

      const existingRefs = emailData[0]?.references?.split(' ') || [];
      const references = [...existingRefs, emailData[0]?.inReplyTo, cleanEmailAddress(messageId)]
        .filter(Boolean)
        .join(' ');

      await sendEmail({
        to: cleanedToEmail,
        subject,
        message: replyBody,
        attachments,
        headers: {
          'In-Reply-To': inReplyTo ?? '',
          References: references,
          'Thread-Id': threadId ?? '',
        },
      });

      setMessageContent('');
      setComposerIsOpen(false);
      toast.success(t('pages.createEmail.emailSentSuccessfully'));
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error(t('pages.createEmail.failedToSendEmail'));
    }
  };

  const toggleComposer = () => {
    setComposerIsOpen(!composerIsOpen);
    if (!composerIsOpen) {
      // Focus will be handled by the useEffect below
    }
  };

  // Add a useEffect to focus the editor when the composer opens
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

  // Check if the message is empty
  const isMessageEmpty =
    !messageContent ||
    messageContent ===
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

  if (!composerIsOpen) {
    return (
      <div className="bg-offsetLight dark:bg-offsetDark w-full p-2">
        <Button
          onClick={toggleComposer}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-md"
          variant="outline"
        >
          <Reply className="h-4 w-4" />
          <span>
            {t('common.replyCompose.replyTo')}{' '}
            {emailData[emailData.length - 1]?.sender?.name || t('common.replyCompose.thisEmail')}
          </span>
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-offsetLight dark:bg-offsetDark w-full p-2">
      <form
        className={cn(
          'border-border ring-offset-background flex h-[300px] flex-col space-y-2.5 rounded-[10px] border px-2 py-2 transition-shadow duration-300 ease-in-out',
          isEditorFocused ? 'ring-2 ring-[#3D3D3D] ring-offset-1' : '',
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onSubmit={(e) => {
          // Prevent default form submission
          e.preventDefault();
        }}
        onKeyDown={handleKeyDown}
      >
        {isDragging && (
          <div className="bg-background/80 border-primary/30 absolute inset-0 z-50 m-4 flex items-center justify-center rounded-2xl border-2 border-dashed backdrop-blur-sm">
            <div className="text-muted-foreground flex flex-col items-center gap-2">
              <Paperclip className="text-muted-foreground h-12 w-12" />
              <p className="text-lg font-medium">{t('common.replyCompose.dropFiles')}</p>
            </div>
          </div>
        )}

        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Reply className="h-4 w-4" />
            <p className="truncate">
              {emailData[emailData.length - 1]?.sender?.name} (
              {emailData[emailData.length - 1]?.sender?.email})
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.preventDefault();
              toggleComposer();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="w-full flex-grow overflow-hidden p-1">
          <div
            className="h-full w-full overflow-y-auto"
            onDragOver={(e) => e.stopPropagation()}
            onDragLeave={(e) => e.stopPropagation()}
            onDrop={(e) => e.stopPropagation()}
          >
            <Editor
              onChange={(content) => {
                setMessageContent(content);
              }}
              className="sm:max-w-[600px] md:max-w-[2050px]"
              initialValue={{
                type: 'doc',
                content: [
                  {
                    type: 'paragraph',
                    content: [],
                  },
                ],
              }}
              placeholder="Type your reply here..."
              onFocus={() => {
                setIsEditorFocused(true);
              }}
              onBlur={() => {
                console.log('Editor blurred');
                setIsEditorFocused(false);
              }}
            />
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="group relative w-9 overflow-hidden transition-all duration-200 hover:w-32"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('attachment-input')?.click();
              }}
            >
              <Plus className="absolute left-[9px] h-6 w-6" />
              <span className="whitespace-nowrap pl-7 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {t('common.replyCompose.attachments')}
              </span>
            </Button>

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
            <Button variant="ghost" size="sm" className="h-8">
              {t('common.replyCompose.saveDraft')}
            </Button>
            <Button
              size="sm"
              className="group relative h-8 w-9 overflow-hidden transition-all duration-200 hover:w-24"
              onClick={async (e) => {
                e.preventDefault();
                await handleSendEmail(e);
              }}
              disabled={!isFormValid}
              type="button"
            >
              <span className="whitespace-nowrap pr-7 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {t('common.replyCompose.send')}
              </span>
              <ArrowUp className="absolute right-2.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
