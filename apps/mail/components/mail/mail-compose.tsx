import {
  X,
  Paperclip,
  Image as ImageIcon,
  Link2,
  Bold,
  Italic,
  List,
  ListOrdered,
  FileIcon,
  Send,
} from "lucide-react";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { compressText, decompressText, truncateFileName } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useOpenComposeModal } from "@/hooks/use-open-compose-modal";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { TooltipPortal } from "@radix-ui/react-tooltip";
import { Separator } from "@/components/ui/separator";
import { DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendEmail } from "@/actions/send";
import { useQueryState } from "nuqs";
import { Badge } from "../ui/badge";
import Image from "next/image";
import { toast } from "sonner";
import * as React from "react";

interface MailComposeProps {
  onClose: () => void;
  replyTo?: {
    email: string;
    subject: string;
  };
}

export function MailCompose({ onClose, replyTo }: MailComposeProps) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const [attachments, setAttachments] = React.useState<File[]>([]);
  const [toInput, setToInput] = React.useState(replyTo?.email || "");
  const [showSuggestions, setShowSuggestions] = React.useState(false);

  const [subject, setSubject] = useQueryState("subject", {
    defaultValue: "",
    parse: (value) => decompressText(value),
    serialize: (value) => compressText(value),
  });

  const [messageContent, setMessageContent] = useQueryState("body", {
    defaultValue: "",
    parse: (value) => decompressText(value),
    serialize: (value) => compressText(value),
  });

  const { isOpen } = useOpenComposeModal();

  // TODO: get past emails from driver/provider
  const pastEmails = [
    "alice@example.com",
    "bob@example.com",
    "carol@example.com",
    "david@example.com",
    "eve@example.com",
  ];

  React.useEffect(() => {
    if (!isOpen) {
      setMessageContent(null);
      setSubject(null);
    }
  }, [isOpen, setMessageContent, setSubject]);

  const filteredSuggestions = toInput
    ? pastEmails.filter((email) => email.toLowerCase().includes(toInput.toLowerCase()))
    : [];

  const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments([...attachments, ...Array.from(e.target.files)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const insertFormat = (format: string) => {
    if (!editorRef.current) return;
    document.execCommand("styleWithCSS", false, "true");

    switch (format) {
      case "bold":
        document.execCommand("bold", false);
        break;
      case "italic":
        document.execCommand("italic", false);
        break;
      case "list":
        document.execCommand("insertUnorderedList", false);
        break;
      case "ordered-list":
        document.execCommand("insertOrderedList", false);
        break;
      case "link":
        const url = prompt("Enter URL:");
        if (url) document.execCommand("createLink", false, url);
        break;
    }
    editorRef.current.focus();
  };

  const MAX_VISIBLE_ATTACHMENTS = 3;
  const hasHiddenAttachments = React.useMemo(
    () => attachments.length > MAX_VISIBLE_ATTACHMENTS,
    [attachments],
  );

  const handleSendEmail = async () => {
    try {
      await sendEmail({
        to: toInput,
        subject: subject,
        message: messageContent,
        attachments: attachments,
      });
      onClose();
      toast.success("Email sent successfully!");
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Failed to send email. Please try again.");
    }
  };

  const renderAttachments = React.useCallback(() => {
    if (attachments.length === 0) return null;

    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {attachments.slice(0, MAX_VISIBLE_ATTACHMENTS).map((file, index) => (
          <Tooltip key={index}>
            <TooltipTrigger asChild>
              <Badge variant="secondary">
                {truncateFileName(file.name)}
                <Button
                  variant="ghost"
                  size="icon"
                  className="-mr-1 ml-2 h-5 w-5 rounded-full p-0"
                  onClick={(e) => {
                    e.preventDefault();
                    removeAttachment(index);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </Badge>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent className="w-64 p-0" sideOffset={6}>
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
            </TooltipPortal>
          </Tooltip>
        ))}

        {hasHiddenAttachments && (
          <Popover>
            <PopoverTrigger asChild>
              <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                +{attachments.length - MAX_VISIBLE_ATTACHMENTS} more...
              </Badge>
            </PopoverTrigger>
            <PopoverContent
              className="w-80 touch-auto"
              align="start"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <div className="space-y-2">
                <div className="px-1">
                  <h4 className="font-medium leading-none">Attachments</h4>
                  <p className="text-sm text-muted-foreground">
                    {attachments.length} files attached
                  </p>
                </div>
                <Separator />
                <div
                  className="h-[200px] touch-auto overflow-y-auto overscroll-contain px-1 py-1"
                  onWheel={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  style={{
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  <div className="space-y-1">
                    {attachments.map((file, index) => (
                      <Tooltip key={index}>
                        <TooltipTrigger asChild>
                          <div
                            key={index}
                            className="flex items-center justify-between rounded-md p-2 hover:bg-muted"
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <Paperclip className="h-4 w-4 flex-shrink-0" />
                              <span className="truncate text-sm">
                                {truncateFileName(file.name)}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                removeAttachment(index);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
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
                            <p className="text-sm font-medium">{file.name}</p>
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
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    );
    // TODO: FIX
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments, hasHiddenAttachments]);

  return (
    <>
      <DialogTitle className="sr-only">Compose Email</DialogTitle>
      <TooltipProvider>
        <Card className="h-full w-full border-none shadow-none">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold tracking-tight">New Message</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <div className="relative">
                <Input
                  tabIndex={1}
                  placeholder="To"
                  value={toInput}
                  onChange={(e) => {
                    setToInput(e.target.value);
                    setShowSuggestions(true);
                  }}
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-auto rounded-md border border-input bg-background shadow-lg">
                    {filteredSuggestions.map((email, index) => (
                      <li
                        key={index}
                        onClick={() => {
                          setToInput(email);
                          setShowSuggestions(false);
                        }}
                        className="cursor-pointer p-2 hover:bg-muted"
                      >
                        {email}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Input
                placeholder="Subject"
                defaultValue={subject || ""}
                onChange={(e) => setSubject(e.target.value)}
                tabIndex={2}
              />

              <div className="flex justify-end">
                <ToggleGroup type="multiple">
                  <ToggleGroupItem tabIndex={3} value="bold" onClick={() => insertFormat("bold")}>
                    <Bold className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    tabIndex={4}
                    value="italic"
                    onClick={() => insertFormat("italic")}
                  >
                    <Italic className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem tabIndex={5} value="list" onClick={() => insertFormat("list")}>
                    <List className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    tabIndex={6}
                    value="ordered-list"
                    onClick={() => insertFormat("ordered-list")}
                  >
                    <ListOrdered className="h-4 w-4" />
                  </ToggleGroupItem>
                  <Button
                    variant="ghost"
                    size="icon"
                    tabIndex={7}
                    onClick={() => insertFormat("link")}
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    tabIndex={8}
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            insertFormat(`![${file.name}](${reader.result})`);
                          };
                          reader.readAsDataURL(file);
                        }
                      };
                      input.click();
                    }}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                </ToggleGroup>
              </div>

              <div
                ref={editorRef}
                contentEditable
                className="min-h-[300px] w-full resize-none overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                role="textbox"
                aria-multiline="true"
                tabIndex={9}
                style={{
                  overflowWrap: "break-word",
                  wordWrap: "break-word",
                  whiteSpace: "pre-wrap",
                  maxWidth: "100%",
                }}
                onInput={() => {
                  setMessageContent(editorRef.current?.innerHTML || "");
                }}
              />

              {renderAttachments()}
              <div className="mt-4 flex justify-between">
                <label>
                  <Button
                    tabIndex={10}
                    variant="outline"
                    onClick={(e) => {
                      e.preventDefault();
                      const fileInput = e.currentTarget.nextElementSibling as HTMLInputElement;
                      fileInput?.click();
                    }}
                  >
                    <Paperclip className="mr-2 h-4 w-4" />
                    Attach files
                  </Button>
                  <Input type="file" className="hidden" multiple onChange={handleAttachment} />
                </label>
                <div className="flex gap-2">
                  <Button tabIndex={12} onClick={handleSendEmail}>
                    Send
                    <Send className="ml-2 h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TooltipProvider>
    </>
  );
}
