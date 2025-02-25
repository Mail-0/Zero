import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { ChevronDown, ChevronUp } from "lucide-react";
import { BellOff, Lock } from "lucide-react";
import { Separator } from "../ui/separator";
import { useState, useEffect } from "react";
import { MailIframe } from "./mail-iframe";
import { ParsedMessage } from "@/types";
import { Button } from "../ui/button";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Props = {
  emailData: ParsedMessage;
  isFullscreen: boolean;
  isMuted: boolean;
  isLoading: boolean;
  index: number;
};

const MailDisplay = ({ emailData, isFullscreen, isMuted, index }: Props) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const [openDetailsPopover, setOpenDetailsPopover] = useState<boolean>(false);

  useEffect(() => {
    if (index === 0) {
      setIsCollapsed(false);
    }
  }, [index]);

  return (
    <div className={cn("relative flex-1 overflow-hidden")}>
      <div className="relative h-full overflow-y-auto">
        <div className="flex flex-col gap-4 p-4 py-5 transition-all duration-200">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <Avatar>
                <AvatarImage alt={emailData?.sender?.name} />
                <AvatarFallback>
                  {emailData?.sender?.name
                    .split(" ")
                    .map((chunk) => chunk[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-start gap-2">
                  <span className="font-semibold">{emailData?.sender?.name}</span>
                  <span className="flex grow-0 items-center gap-2 text-sm text-muted-foreground">
                    <span>{emailData?.sender?.email}</span>
                    {isMuted && <BellOff className="h-4 w-4" />}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <time className="text-xs text-muted-foreground">
                    {format(new Date(emailData?.receivedOn), "PPp")}
                  </time>
                  <Popover open={openDetailsPopover} onOpenChange={setOpenDetailsPopover}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-xs underline"
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
                          <span className="w-24 text-end text-gray-500">Cc:</span>
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
                        <div className="flex">
                          <span className="w-24 text-end text-gray-500">Mailed-By:</span>
                          <span className="ml-3 text-muted-foreground">
                            {emailData?.sender?.email}
                          </span>
                        </div>
                        <div className="flex">
                          <span className="w-24 text-end text-gray-500">Signed-By:</span>
                          <span className="ml-3 text-muted-foreground">
                            {emailData?.sender?.email}
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
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)}>
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </Button>
            </div>
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
            <div className="h-fit w-full p-0">
              {emailData?.decodedBody ? (
                // <p className="flex h-[500px] w-full items-center justify-center">
                //   There should be an iframe in here
                // </p>
                <MailIframe html={emailData?.decodedBody} />
              ) : (
                <div
                  className="flex h-[500px] w-full items-center justify-center"
                  style={{ minHeight: "500px" }}
                >
                  <div className="h-32 w-32 animate-pulse rounded-full bg-secondary" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MailDisplay;
