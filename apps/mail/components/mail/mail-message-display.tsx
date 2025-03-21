import {
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogClose,
} from '../ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useConnections } from "@/hooks/use-connections";
import {BellOff, Check, ChevronDown, LoaderCircleIcon, Lock} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { handleUnsubscribe } from '@/lib/email-utils.client';
import { useSession } from "@/lib/auth-client";
import { MailIframe } from "./mail-iframe";
import { useTranslations } from 'next-intl';
import { type ParsedMessage } from "@/types";
import { Button } from "../ui/button";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useSummary } from "@/hooks/use-summary";
import { TextShimmer } from "../ui/text-shimmer";

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
  demo?: boolean;
};

const MailMessageDisplay = ({ emailData, isMuted, demo }: Props) => {
  const { data: session } = useSession();
  const { data: connections } = useConnections();
  const [selectedAttachment, setSelectedAttachment] = useState<null | {
    id: string;
    name: string;
    type: string;
    url: string;
  }>(null);
  const [openDetailsPopover, setOpenDetailsPopover] = useState<boolean>(false);
  const { data } = useSummary(emailData.id);
  const t = useTranslations();

  const activeAccount = useMemo(() => {
    if (!session) return null;
    return connections?.find((connection) => connection.id === session?.connectionId);
  }, [session, connections]);

  // Extract sender's email from active account or session
  const senderMail = activeAccount?.email || session?.user?.email || '';

  // Clean the email address by removing angle brackets if present
  const cleanRecipientEmail = emailData?.sender?.email?.replace(/[<>]/g, '') || '';

  // Check if the current user is the sender of the email
  const isCurrentUser = cleanRecipientEmail === senderMail;

  const [unsubscribed, setUnsubscribed] = useState(false);
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);

  const _handleUnsubscribe = async () => {
    setIsUnsubscribing(true);
    try {
      await handleUnsubscribe({
        emailData,
      });
      setIsUnsubscribing(false);
      setUnsubscribed(true);
    } catch (e) {
      setIsUnsubscribing(false);
      setUnsubscribed(false);
    }
  };

  return (
    <div className={cn("relative flex-1 overflow-hidden")}>
      <div className="relative h-full overflow-y-auto">
        <div className="flex flex-col gap-4 p-4 pb-2 transition-all duration-200">
          <div className={cn(
            "flex items-start gap-4",
            isCurrentUser ? "flex-row-reverse" : "flex-row"
          )}>
            {!isCurrentUser && (
              <Avatar className="rounded-md flex-shrink-0">
                <AvatarImage alt={emailData?.sender?.name} className="rounded-md" />
                <AvatarFallback className={cn(
                  "rounded-md",
                demo && "compose-gradient-animated text-black font-bold"
              )}>
                {emailData?.sender?.name
                  ?.split(" ")
                  .map((chunk) => chunk[0]?.toUpperCase())
                  .filter((char) => char?.match(/[A-Z]/))
                  .slice(0, 2)
                  .join("")}
                </AvatarFallback>
              </Avatar>
            )}
            <div className={cn(
              "flex flex-col max-w-[70%]",
              isCurrentUser ? "items-end" : "items-start"
            )}>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold">{emailData?.sender?.name}</span>
                <span className="text-muted-foreground flex grow-0 items-center gap-2 text-sm">
                  {emailData?.sender?.email}
                  {!!emailData.listUnsubscribe && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="xs"
                            variant="secondary"
                            disabled={unsubscribed || isUnsubscribing}
                          >
                            {unsubscribed && <Check className="h-4 w-4" />}
                            {isUnsubscribing && (
                              <LoaderCircleIcon className="h-4 w-4 animate-spin" />
                            )}
                            {unsubscribed
                              ? t('common.mailDisplay.unsubscribed')
                              : t('common.mailDisplay.unsubscribe')}
                          </Button>
                        </DialogTrigger>

                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t('common.mailDisplay.unsubscribe')}</DialogTitle>
                            <DialogDescription className="break-words">
                              {t('common.mailDisplay.unsubscribeDescription')}
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter className="gap-2">
                            <DialogClose asChild>
                              <Button disabled={isUnsubscribing} variant="outline">
                                {t('common.mailDisplay.cancel')}
                              </Button>
                            </DialogClose>
                            <DialogClose asChild>
                              <Button disabled={isUnsubscribing} onClick={_handleUnsubscribe}>
                                {t('common.mailDisplay.unsubscribe')}
                              </Button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  {isMuted && <BellOff className="h-4 w-4" />}
                </span>
              </div>
              <div className="rounded-lg p-4 border">
                {emailData?.decodedBody ? (
                  <MailIframe html={emailData?.decodedBody} />
                ) : (
                  <div className="flex h-[100px] w-full items-center justify-center">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-secondary" />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 mt-1 w-full">
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
                    className="w-[420px] rounded-lg p-3 shadow-lg border"
                    onBlur={() => setOpenDetailsPopover(false)}
                  >
                    <div className="space-y-1 text-sm">
                      <div className="flex">
                        <span className="w-24 text-end text-gray-500">From:</span>
                        <div className="ml-3">
                          <span className="pr-1 font-bold text-muted-foreground">
                            {emailData?.sender?.name}
                          </span>
                          <span className="text-muted-foreground">
                            {emailData?.sender?.email}
                          </span>
                        </div>
                      </div>
                      <div className="flex">
                        <span className="w-24 text-end text-gray-500">To:</span>
                        <span className="ml-3 text-muted-foreground">
                          {emailData?.sender?.email}
                        </span>
                      </div>
                      <div className="flex">
                        <span className="w-24 text-end text-gray-500">Date:</span>
                        <span className="ml-3 text-muted-foreground">
                          {format(new Date(emailData?.receivedOn), "PPpp")}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-24 text-end text-gray-500">Security:</span>
                        <div className="ml-3 flex items-center gap-1 text-muted-foreground">
                          <Lock className="h-4 w-4 text-green-600" /> Standard encryption (TLS)
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {data && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button size={"icon"} variant="ghost" className="rounded-md">
                        <Image src="/ai.svg" alt="logo" className="h-6 w-6" width={100} height={100} />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="rounded-lg border p-3 shadow-lg relative -left-24">
                      <StreamingText text={data.content} />
                    </PopoverContent>
                  </Popover>
                )}
                <time className="text-xs text-muted-foreground">
                  {format(new Date(emailData?.receivedOn), "PPp")}
                </time>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MailMessageDisplay;