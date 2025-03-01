import {
  Archive,
  ArchiveX,
  Forward,
  MoreVertical,
  Reply,
  ReplyAll,
  X,
  Copy,
  Maximize2,
  Minimize2,
  Check,
  Inbox,
} from "lucide-react";
import { DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";

import { MailDisplaySkeleton, MailHeaderSkeleton } from "./mail-skeleton";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useThread } from "@/hooks/use-threads";
import ReplyCompose from "./reply-composer";
import MailDisplay from "./mail-display";
import { useMail } from "./use-mail";
import { cn } from "@/lib/utils";
import React from "react";
import { useMailMutation } from "@/hooks/use-mail-mutation";
import { toast } from "sonner";
import { useParams } from "next/navigation";

interface ThreadDisplayProps {
  mail: string | null;
  onClose?: () => void;
  isMobile?: boolean;
}

export function ThreadDisplay({ mail, onClose, isMobile }: ThreadDisplayProps) {
  const [, setMail] = useMail();
  const { data: emailData, isLoading } = useThread(mail ?? "");
  const [isMuted, setIsMuted] = useState(false);
  const params = useParams();
  const currentFolder = typeof params?.folder === 'string' ? params.folder : 'inbox';
  const { archiveMail, moveToSpam, moveToInbox } = useMailMutation(currentFolder);

  const [copySuccess, setCopySuccess] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (emailData?.[0]) {
      setIsMuted(emailData[0].unread ?? false);
    }
  }, [emailData]);

  const handleClose = useCallback(() => {
    onClose?.();
    setMail((m) => ({ ...m, selected: null }));
  }, [onClose, setMail]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [handleClose]);

  const handleCopy = async () => {
    if (emailData) {
      try {
        await navigator.clipboard.writeText(JSON.stringify(emailData, null, 2));
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000); // Reset after 2 seconds
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    }
  };

  const handleArchive = async () => {
    if (!mail || !emailData || !emailData[0]) return;
    
    if (emailData[0].tags.includes('SPAM')) {
      toast.error("Cannot archive emails with SPAM label");
      return;
    }
    
    try {
      const mailId = mail.startsWith('thread:') ? mail : `thread:${emailData[0].threadId}`;
      console.log(`Thread: Archiving email: ${mailId}`);
      
      const success = await archiveMail(mailId);
      if (success) {
        toast.success("Email archived");
        handleClose();
      } else {
        throw new Error("Failed to archive email");
      }
    } catch (error) {
      console.error("Error archiving email:", error);
      toast.error("Error archiving email");
    }
  };

  const handleMoveToSpam = async () => {
    if (!mail || !emailData || !emailData[0]) return;
    
    if (!emailData[0].tags.includes('INBOX')) {
      toast.error("Can only mark emails as spam from inbox");
      return;
    }
    
    try {
      const mailId = mail.startsWith('thread:') ? mail : `thread:${emailData[0].threadId}`;
      console.log(`Thread: Moving email to spam: ${mailId}`);
      
      const success = await moveToSpam(mailId);
      if (success) {
        toast.success("Email marked as spam");
        handleClose();
      } else {
        throw new Error("Failed to mark email as spam");
      }
    } catch (error) {
      console.error("Error marking email as spam:", error);
      toast.error("Error marking email as spam");
    }
  };

  const handleMoveToInbox = async () => {
    if (!mail || !emailData || !emailData[0]) return;
    
    try {
      const mailId = mail.startsWith('thread:') ? mail : `thread:${emailData[0].threadId}`;
      console.log(`Thread: Moving email to inbox: ${mailId}`);
      
      const success = await moveToInbox(mailId);
      if (success) {
        toast.success("Email moved to inbox");
        handleClose();
      } else {
        throw new Error("Failed to move email to inbox");
      }
    } catch (error) {
      console.error("Error moving email to inbox:", error);
      toast.error("Error moving email to inbox");
    }
  };

  const canArchive = emailData && emailData[0] && !emailData[0].tags.includes('SPAM');
  
  const canMarkAsSpam = emailData && emailData[0] && emailData[0].tags.includes('INBOX');
  
  const isArchiveFolder = currentFolder === 'archive';
  const isSpamFolder = currentFolder === 'spam';

  if (!emailData)
    return (
      <div className="flex h-screen flex-col">
        <div
          className={cn(
            "relative flex h-full flex-col bg-background transition-all duration-300",
            isMobile ? "" : "rounded-r-lg",
            isFullscreen ? "fixed inset-0 z-50 bg-background" : "",
          )}
        >
          <MailHeaderSkeleton isFullscreen={isFullscreen} />
          <div className="h-full space-y-4 overflow-hidden">
            <MailDisplaySkeleton isFullscreen={isFullscreen} />
          </div>
        </div>
      </div>
    );

  return (
    <div
      className={cn(
        "flex flex-col",
        isFullscreen ? "h-screen" : isMobile ? "h-full" : "h-[calc(100vh-2rem)]",
      )}
    >
      <div
        className={cn(
          "relative flex flex-col overflow-hidden bg-offsetLight transition-all duration-300 dark:bg-offsetDark",
          isMobile ? "h-full" : "h-full",
          !isMobile && !isFullscreen && "rounded-r-lg",
          isFullscreen ? "fixed inset-0 z-50" : "",
        )}
      >
        <div className="flex flex-shrink-0 items-center border-b p-2">
          <div className="flex flex-1 items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="md:h-fit md:px-2"
                  disabled={!emailData}
                  onClick={handleClose}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="md:h-fit md:px-2"
                  disabled={!emailData}
                  onClick={() => setIsFullscreen(!isFullscreen)}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                  <span className="sr-only">
                    {isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="md:h-fit md:px-2"
                  disabled={!emailData}
                  onClick={handleCopy}
                >
                  {copySuccess ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span className="sr-only">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span className="sr-only">Copy email data</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{copySuccess ? "Copied!" : "Copy email data"}</TooltipContent>
            </Tooltip>
            {!isArchiveFolder && !isSpamFolder && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="md:h-fit md:px-2" 
                    disabled={!emailData || !canArchive}
                    onClick={handleArchive}
                  >
                    <Archive className="h-4 w-4" />
                    <span className="sr-only">Archive</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Archive</TooltipContent>
              </Tooltip>
            )}
            {(isArchiveFolder || isSpamFolder) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="md:h-fit md:px-2" 
                    disabled={!emailData}
                    onClick={handleMoveToInbox}
                  >
                    <Inbox className="h-4 w-4" />
                    <span className="sr-only">Move to inbox</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Move to inbox</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" className="md:h-fit md:px-2" disabled={!emailData}>
                  <Reply className="h-4 w-4" />
                  <span className="sr-only">Reply</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reply</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="md:h-fit md:px-2" disabled={!emailData}>
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">More</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isSpamFolder ? (
                  <DropdownMenuItem onClick={handleMoveToInbox}>
                    <Inbox className="mr-2 h-4 w-4" /> Not spam
                  </DropdownMenuItem>
                ) : isArchiveFolder ? (
                  <DropdownMenuItem onClick={handleMoveToInbox}>
                    <Inbox className="mr-2 h-4 w-4" /> Move to inbox
                  </DropdownMenuItem>
                ) : canMarkAsSpam ? (
                  <DropdownMenuItem onClick={handleMoveToSpam}>
                    <ArchiveX className="mr-2 h-4 w-4" /> Move to spam
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem>
                  <ReplyAll className="mr-2 h-4 w-4" /> Reply all
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Forward className="mr-2 h-4 w-4" /> Forward
                </DropdownMenuItem>
                <DropdownMenuItem>Mark as unread</DropdownMenuItem>
                <DropdownMenuItem>Add label</DropdownMenuItem>
                <DropdownMenuItem>Mute thread</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ScrollArea className="flex-1" type="scroll">
            <div className="pb-4">
              {[...(emailData || [])].reverse().map((message, index) => (
                <div
                  key={message.id}
                  className={cn(
                    "transition-all duration-200",
                    index > 0 && "border-t border-border",
                  )}
                >
                  <MailDisplay
                    emailData={message}
                    isFullscreen={isFullscreen}
                    isMuted={isMuted}
                    isLoading={isLoading}
                    index={index}
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="flex-shrink-0">
            <ReplyCompose emailData={emailData} />
          </div>
        </div>
      </div>
    </div>
  );
}

<style jsx global>{`
  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
`}</style>;
