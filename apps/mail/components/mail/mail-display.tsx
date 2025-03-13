import { BellOff, ChevronDown, Download, ExternalLink, Lock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import AttachmentsAccordion from "./attachments-accordion";
import AttachmentDialog from "./attachment-dialog";
import { useSummary } from "@/hooks/use-summary";
import { TextShimmer } from "../ui/text-shimmer";
import { Separator } from "../ui/separator";
import { useEffect, useState } from "react";
import { MailIframe } from "./mail-iframe";
import { ParsedMessage } from "@/types";
import { Button } from "../ui/button";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import Image from "next/image";

const StreamingText = ({ text }: { text: string }) => {
  const [displayText, setDisplayText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    let currentIndex = 0;
    setIsComplete(false);
    setIsThinking(true);

    const thinkingTimeout = setTimeout(() => {
      setIsThinking(false);
      setDisplayText("");

      const interval = setInterval(() => {
        if (currentIndex < text.length) {
          const nextChar = text[currentIndex];
          setDisplayText((prev) => prev + nextChar);
          currentIndex++;
        } else {
          setIsComplete(true);
          clearInterval(interval);
        }
      }, 40);

      return () => clearInterval(interval);
    }, 2000);

    return () => {
      clearTimeout(thinkingTimeout);
    };
  }, [text]);

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "bg-gradient-to-r from-neutral-500 via-neutral-300 to-neutral-500 bg-[length:200%_100%] bg-clip-text text-sm leading-relaxed text-transparent",
          isComplete ? "animate-shine-slow" : "",
        )}
      >
        {isThinking ? (
          <TextShimmer duration={1}>Thinking...</TextShimmer>
        ) : (
          <span>{displayText}</span>
        )}
        {!isComplete && !isThinking && (
          <span className="animate-blink bg-primary ml-0.5 inline-block h-4 w-0.5"></span>
        )}
      </div>
    </div>
  );
};

type Props = {
  emailData: ParsedMessage;
  isFullscreen: boolean;
  isMuted: boolean;
  isLoading: boolean;
  index: number;
  demo?: boolean;
};

const MailDisplay = ({ emailData, isMuted, index, demo }: Props) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const [selectedAttachment, setSelectedAttachment] = useState<null | {
    id: string;
    name: string;
    type: string;
    url: string;
  }>(null);
  const [openDetailsPopover, setOpenDetailsPopover] = useState<boolean>(false);
  const { data } = demo
    ? {
        data: {
          content:
            "This email talks about how Zero Email is the future of email. It is a new way to send and receive emails that is more secure and private.",
        },
      }
    : useSummary(emailData.id);

  useEffect(() => {
    if (index === 0) {
      setIsCollapsed(false);
    }
  }, [index]);

  return (
    <div className={cn("relative flex-1 overflow-hidden")}>
      <div className="relative h-full overflow-y-auto">
        <div className="flex flex-col gap-4 p-4 pb-2 transition-all duration-200">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start justify-center gap-4">
              <Avatar className="rounded-md">
                <AvatarImage alt={emailData?.sender?.name} className="rounded-md" />
                <AvatarFallback
                  className={cn(
                    "rounded-md",
                    demo && "compose-gradient-animated font-bold text-black",
                  )}
                >
                  {emailData?.sender?.name
                    ?.split(" ")
                    .map((chunk) => chunk[0]?.toUpperCase())
                    .filter((char) => char?.match(/[A-Z]/))
                    .slice(0, 2)
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="relative bottom-1 flex-1">
                <div className="flex items-center justify-start gap-2">
                  <span className="font-semibold">{emailData?.sender?.name}</span>
                  <span className="text-muted-foreground flex grow-0 items-center gap-2 text-sm">
                    <span>{emailData?.sender?.email}</span>
                    {isMuted && <BellOff className="h-4 w-4" />}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <time className="text-muted-foreground text-xs">
                    {format(new Date(emailData?.receivedOn), "PPp")}
                  </time>
                  <Popover open={openDetailsPopover} onOpenChange={setOpenDetailsPopover}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-xs underline hover:bg-transparent"
                        onClick={() => setOpenDetailsPopover(true)}
                      >
                        Details
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[420px] rounded-lg border p-3 shadow-lg"
                      onBlur={() => setOpenDetailsPopover(false)}
                    >
                      <div className="space-y-1 text-sm">
                        <div className="flex">
                          <span className="w-24 text-end text-gray-500">From:</span>
                          <div className="ml-3">
                            <span className="text-muted-foreground pr-1 font-bold">
                              {emailData?.sender?.name}
                            </span>
                            <span className="text-muted-foreground">
                              {emailData?.sender?.email}
                            </span>
                          </div>
                        </div>
                        <div className="flex">
                          <span className="w-24 text-end text-gray-500">To:</span>
                          <span className="text-muted-foreground ml-3">
                            {emailData?.sender?.email}
                          </span>
                        </div>
                        <div className="flex">
                          <span className="w-24 text-end text-gray-500">Cc:</span>
                          <span className="text-muted-foreground ml-3">
                            {emailData?.sender?.email}
                          </span>
                        </div>
                        <div className="flex">
                          <span className="w-24 text-end text-gray-500">Date:</span>
                          <span className="text-muted-foreground ml-3">
                            {format(new Date(emailData?.receivedOn), "PPpp")}
                          </span>
                        </div>
                        <div className="flex">
                          <span className="w-24 text-end text-gray-500">Mailed-By:</span>
                          <span className="text-muted-foreground ml-3">
                            {emailData?.sender?.email}
                          </span>
                        </div>
                        <div className="flex">
                          <span className="w-24 text-end text-gray-500">Signed-By:</span>
                          <span className="text-muted-foreground ml-3">
                            {emailData?.sender?.email}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <span className="w-24 text-end text-gray-500">Security:</span>
                          <div className="text-muted-foreground ml-3 flex items-center gap-1">
                            <Lock className="h-4 w-4 text-green-600" /> Standard encryption (TLS)
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <p onClick={() => setIsCollapsed(!isCollapsed)} className="cursor-pointer">
                    <span
                      className={cn(
                        "relative top-0.5 inline-block transition-transform duration-300",
                        !isCollapsed && "rotate-180",
                      )}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </span>
                  </p>
                </div>
              </div>
            </div>
            {data ? (
              <div className="relative top-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size={"icon"} variant="ghost" className="rounded-md">
                      <Image
                        src="/ai.svg"
                        alt="logo"
                        className="h-6 w-6"
                        width={100}
                        height={100}
                      />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="relative -left-24 rounded-lg border p-3 shadow-lg">
                    <StreamingText text={data.content} />
                  </PopoverContent>
                </Popover>
              </div>
            ) : null}
          </div>
        </div>

        <div
          className={cn(
            "h-0 overflow-hidden transition-all duration-200",
            !isCollapsed && "h-[1px]",
          )}
        >
          <Separator />
        </div>

        <div
          className={cn(
            "grid overflow-hidden transition-all duration-200",
            isCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            {emailData?.attachments && emailData?.attachments.length > 0 ? (
              <>
                <AttachmentsAccordion
                  attachments={emailData?.attachments}
                  setSelectedAttachment={setSelectedAttachment}
                />
                <Separator />
              </>
            ) : null}

            <div className="h-fit w-full p-0">
              {emailData?.decodedBody ? (
                <MailIframe html={emailData?.decodedBody} />
              ) : (
                <div
                  className="flex h-[500px] w-full items-center justify-center"
                  style={{ minHeight: "500px" }}
                >
                  <div className="bg-secondary h-32 w-32 animate-pulse rounded-full" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AttachmentDialog
        selectedAttachment={selectedAttachment}
        setSelectedAttachment={setSelectedAttachment}
      />
    </div>
  );
};

export default MailDisplay;
