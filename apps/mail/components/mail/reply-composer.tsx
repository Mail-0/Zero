import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUp, FileIcon, Paperclip, Reply, Send, X, Plus } from "lucide-react";
import { cleanEmailAddress, truncateFileName } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import Editor from "@/components/create/editor";
import { Button } from "@/components/ui/button";
import { sendEmail } from "@/actions/send";
import { useRef, useState } from "react";
import { ParsedMessage } from "@/types";
import { Badge } from "../ui/badge";
import { JSONContent } from "novel";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

export default function ReplyCompose({ emailData }: { emailData: ParsedMessage[] }) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [messageContent, setMessageContent] = useState("");
  const [isTextAreaFocused, setIsTextAreaFocused] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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

  const handleFocus = () => setIsTextAreaFocused(true);
  const handleBlur = () => setIsTextAreaFocused(false);

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
      
      if (e.dataTransfer.files) {
        setAttachments([...attachments, ...Array.from(e.dataTransfer.files)]);
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
            On ${originalDate}, ${originalSender?.name ? `${originalSender.name} ` : ""}${originalSender?.email ? `&lt;${cleanedToEmail}&gt;` : ""} wrote:
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
      const originalSubject = emailData[0]?.subject || "";
      const subject = originalSubject.startsWith("Re:")
        ? originalSubject
        : `Re: ${originalSubject}`;

      const originalSender = emailData[0]?.sender;
      const cleanedToEmail = cleanEmailAddress(emailData[emailData.length - 1]?.sender?.email);
      const originalDate = new Date(emailData[0]?.receivedOn || "").toLocaleString();
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

      const existingRefs = emailData[0]?.references?.split(" ") || [];
      const references = [...existingRefs, emailData[0]?.inReplyTo, cleanEmailAddress(messageId)]
        .filter(Boolean)
        .join(" ");

      await sendEmail({
        to: cleanedToEmail,
        subject,
        message: replyBody,
        attachments,
        headers: {
          "In-Reply-To": inReplyTo ?? "",
          References: references,
          "Thread-Id": threadId ?? "",
        },
      });

      setMessageContent("");
      setIsComposerOpen(false);
      toast.success("Email sent successfully!");
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Failed to send email. Please try again.");
    }
  };

  const toggleComposer = () => {
    setIsComposerOpen(!isComposerOpen);
    if (!isComposerOpen) {
      setTimeout(() => {
        editorRef.current?.focus();
      }, 0);
    }
  };

  // Check if the message is empty
  const isMessageEmpty = !messageContent || messageContent === JSON.stringify({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [],
      },
    ],
  });

  // Check if form is valid for submission
  const isFormValid = !isMessageEmpty || attachments.length > 0;

  if (!isComposerOpen) {
    return (
      <div className="bg-offsetLight dark:bg-offsetDark w-full p-2">
        <Button
          onClick={toggleComposer}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-md"
          variant="outline"
        >
          <Reply className="h-4 w-4" />
          <span>Reply to {emailData[emailData.length - 1]?.sender?.name || "this email"}</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-offsetLight dark:bg-offsetDark w-full p-2">
      <form
        className={cn(
          "border-border flex h-[300px] flex-col space-y-2.5 rounded-[10px] border px-2 py-4 relative",
          isTextAreaFocused ? "ring-2 ring-[#3D3D3D]" : "",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onSubmit={(e) => {
          // Prevent default form submission
          e.preventDefault();
        }}
      >
        {isDragging && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center border-2 border-dashed border-primary/30 rounded-2xl m-4">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Paperclip className="h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">Drop files to attach</p>
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
            className=" h-full w-full"
            onDragOver={(e) => e.stopPropagation()}
            onDragLeave={(e) => e.stopPropagation()}
            onDrop={(e) => e.stopPropagation()}
          >
            <Editor
              onChange={(content) => {
                setMessageContent(content);
              }}
              initialValue={{
                type: "doc",
                content: [
                  {
                    type: "paragraph",
                    content: [],
                  },
                ],
              }}
              placeholder="Type your reply here..."
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
                document.getElementById("attachment-input")?.click();
              }}
            >
              <Plus className="absolute left-[9px] h-6 w-6" />
              <span className="whitespace-nowrap pl-7 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                Attachments
              </span>
            </Button>
            
            {attachments.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    <span>
                      {attachments.length} attachment{attachments.length !== 1 ? "s" : ""}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 touch-auto" align="start">
                  <div className="space-y-2">
                    <div className="px-1">
                      <h4 className="font-medium leading-none">Attachments</h4>
                      <p className="text-muted-foreground text-sm">
                        {attachments.length} file{attachments.length !== 1 ? "s" : ""} attached
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
                            <div className="relative h-24 w-full overflow-hidden bg-muted">
                              {file.type.startsWith("image/") ? (
                                <Image
                                  src={URL.createObjectURL(file) || "/placeholder.svg"}
                                  alt={file.name}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <FileIcon className="text-primary h-10 w-10" />
                                </div>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1 h-6 w-6 rounded-full bg-background/80 opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={(e) => {
                                  e.preventDefault();
                                  removeAttachment(index);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
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
              Save draft
            </Button>
            <Button 
              size="sm" 
              className="group relative h-8 w-9 overflow-hidden transition-all duration-200 hover:w-24"
              onClick={(e) => {
                e.preventDefault();
                handleSendEmail(e);
              }}
              disabled={!isFormValid}
              type="button"
            >
              <ArrowUp className="absolute left-2.5 h-4 w-4" />
              <span className="whitespace-nowrap pl-7 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                Send
              </span>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
