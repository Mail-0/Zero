import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FileIcon, Paperclip, Reply, Send, X } from "lucide-react";
import { cleanEmailAddress, truncateFileName } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { sendEmail } from "@/actions/send";
import { useRef, useState } from "react";
import { ParsedMessage } from "@/types";
import { Badge } from "../ui/badge";
import Image from "next/image";

export default function ReplyCompose({ emailData }: { emailData: ParsedMessage[] }) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const [messageContent, setMessageContent] = useState("");

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

  return (
    <div className="relative bottom-0 left-0 right-0 z-10 mb-5 bg-card px-2 pb-2 pt-2">
      <form className="relative mb-[2px] space-y-2.5 rounded-[10px] border p-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Reply className="h-4 w-4" />
            <p className="truncate">
              {emailData[emailData.length - 1]?.sender?.name} (
              {emailData[emailData.length - 1]?.sender?.email})
            </p>
          </div>
        </div>

        <Textarea
          ref={editorRef}
          className="min-h-[40px] w-full resize-none rounded-2xl border-0 bg-transparent leading-relaxed placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0 md:text-base"
          placeholder="Write your reply..."
          spellCheck={true}
          value={messageContent}
          onChange={(e) => {
            setMessageContent(e.target.value);
          }}
        />

        {(attachments.length > 0 || isUploading) && (
          <div className="relative z-50 min-h-[32px]">
            <div className="hide-scrollbar absolute inset-x-0 flex gap-2 overflow-x-auto">
              {isUploading && (
                <Badge
                  variant="secondary"
                  className="inline-flex shrink-0 animate-pulse items-center bg-background/50 px-2 py-1.5 text-xs"
                >
                  Uploading...
                </Badge>
              )}
              {attachments.map((file, index) => (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <Badge
                      key={index}
                      variant="secondary"
                      className="inline-flex shrink-0 items-center gap-1 bg-background/50 px-2 py-1.5 text-xs"
                    >
                      <span className="max-w-[120px] truncate">{truncateFileName(file.name)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-1 h-4 w-4 hover:bg-background/80"
                        onClick={(e) => {
                          e.preventDefault();
                          removeAttachment(index);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="w-64 p-0">
                    <div className="relative h-32 w-full">
                      {file.type.startsWith("image/") ? (
                        <Image
                          src={URL.createObjectURL(file) || "/placeholder.svg"}
                          alt={file.name}
                          fill
                          className="rounded-t-md object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center p-4">
                          <FileIcon className="h-16 w-16 text-primary" />
                        </div>
                      )}
                    </div>
                    <div className="bg-secondary p-2">
                      <p className="text-sm font-medium">{truncateFileName(file.name, 30)}</p>
                      <p className="text-xs text-muted-foreground">
                        Size: {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last modified: {new Date(file.lastModified).toLocaleDateString()}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        )}

        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  className="h-8 w-8 hover:bg-background/80"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById("attachment-input")?.click();
                  }}
                >
                  <Paperclip className="h-4 w-4" />
                  <span className="sr-only">Add attachment</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Attach file</TooltipContent>
            </Tooltip>
            <input
              type="file"
              id="attachment-input"
              className="hidden"
              onChange={handleAttachment}
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8">
              Save draft
            </Button>
            <Button
              size="sm"
              className="h-8"
              onClick={async (e) => {
                e.preventDefault();
                try {
                  const originalSubject = emailData[0]?.subject || "";
                  const subject = originalSubject.startsWith("Re:")
                    ? originalSubject
                    : `Re: ${originalSubject}`;

                  const originalSender = emailData[0]?.sender;
                  const cleanedToEmail = cleanEmailAddress(
                    emailData[emailData.length - 1]?.sender?.email,
                  );
                  const originalDate = new Date(emailData[0]?.receivedOn || "").toLocaleString();
                  const quotedMessage = emailData[0]?.decodedBody;
                  const messageId = emailData[0]?.messageId;
                  const threadId = emailData[0]?.threadId;

                  const formattedMessage = messageContent
                    .split("\n")
                    .map((line) => `<div>${line || "<br/>"}</div>`)
                    .join("");

                  const replyBody = `
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

                  const inReplyTo = messageId;

                  const existingRefs = emailData[0]?.references?.split(" ") || [];
                  const references = [
                    ...existingRefs,
                    emailData[0]?.inReplyTo,
                    cleanEmailAddress(messageId),
                  ]
                    .filter(Boolean)
                    .join(" ");

                  await sendEmail({
                    to: cleanedToEmail,
                    subject,
                    message: replyBody,
                    attachments,
                    headers: {
                      "In-Reply-To": inReplyTo,
                      References: references,
                      "Thread-Id": threadId,
                    },
                  });
                } catch (error) {
                  console.error("Error sending email:", error);
                  // TODO: SHOW TOAST
                }
              }}
            >
              Send <Send className="ml-2 h-3 w-3" />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
