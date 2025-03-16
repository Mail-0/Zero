"use client";

import type {
  ConditionalThreadProps,
  InitialThread,
  MailListProps,
  MailSelectMode,
  ThreadProps,
} from "@/types";
import {
  type ComponentProps,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Bell, Briefcase, Tag, User, Users } from "lucide-react";
import { EmptyState, type FolderType } from "@/components/mail/empty-state";
import { preloadThread, useThreads } from "@/hooks/use-threads";
import { cn, defaultPageSize, formatDate } from "@/lib/utils";
import { useSearchValue } from "@/hooks/use-search-value";
import { markAsRead, markAsUnread } from "@/actions/mail";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMail } from "@/components/mail/use-mail";
import { useHotKey } from "@/hooks/use-hot-key";
import { useSession } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { useParams } from "next/navigation";
import { useTheme } from "next-themes";
import items from "./demo.json";
import { toast } from "sonner";

const HOVER_DELAY = 1000; // ms before prefetching

const highlightText = (text: string, highlight: string) => {
  if (!highlight?.trim()) return text;

  const regex = new RegExp(`(${highlight})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, i) => {
    return i % 2 === 1 ? (
      <span
        key={i}
        className="ring-0.5 bg-primary/10 inline-flex items-center justify-center rounded px-1"
      >
        {part}
      </span>
    ) : (
      part
    );
  });
};

const Thread = memo(
  ({ message, selectMode, demo, onClick, sessionData }: ConditionalThreadProps) => {
    const [mail] = useMail();
    // const { data: session } = useSession();
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const isHovering = useRef<boolean>(false);
    const hasPrefetched = useRef<boolean>(false);
    const [searchValue] = useSearchValue();

    const isMailSelected = message.id === mail.selected;
    const isMailBulkSelected = mail.bulkSelected.includes(message.id);
    const handleMouseEnter = () => {
      if (demo) return;
      isHovering.current = true;

      // Prefetch only in single select mode
      if (selectMode === "single" && sessionData?.userId && !hasPrefetched.current) {
        // Clear any existing timeout
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }

        // Set new timeout for prefetch
        hoverTimeoutRef.current = setTimeout(() => {
          if (isHovering.current) {
            const messageId = message.threadId ?? message.id;
            // Only prefetch if still hovering and hasn't been prefetched
            console.log(
              `🕒 Hover threshold reached for email ${messageId}, initiating prefetch...`,
            );
            void preloadThread(sessionData.userId, messageId, sessionData.connectionId ?? "");
            hasPrefetched.current = true;
          }
        }, HOVER_DELAY);
      }
    };

    const handleMouseLeave = () => {
      isHovering.current = false;
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };

    // Reset prefetch flag when message changes
    useEffect(() => {
      hasPrefetched.current = false;
    }, [message.id]);

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
      };
    }, []);

    return (
      <div
        onClick={onClick ? onClick(message) : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        key={message.id}
        className={cn(
          "hover:bg-offsetLight hover:bg-primary/5 group relative flex cursor-pointer flex-col items-start overflow-clip rounded-lg border border-transparent px-4 py-3 text-left text-sm transition-all hover:opacity-100",
          !message.unread && "opacity-50",
          (isMailSelected || isMailBulkSelected) && "border-border bg-primary/5 opacity-100",
        )}
      >
        <div
          className={cn(
            "bg-primary absolute inset-y-0 left-0 w-1 -translate-x-2 transition-transform ease-out",
            isMailBulkSelected && "translate-x-0",
          )}
        />
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-1">
            <p
              className={cn(
                message.unread ? "font-bold" : "font-medium",
                "text-md flex items-baseline gap-1 group-hover:opacity-100",
              )}
            >
              <span className={cn(mail.selected && "max-w-[120px] truncate")}>
                {highlightText(message.sender.name, searchValue.highlight)}
              </span>{" "}
              {message.unread ? <span className="size-2 rounded bg-[#006FFE]" /> : null}
            </p>
            <MailLabels labels={message.tags} />
            <div className="flex items-center gap-1">
              {message.totalReplies > 1 ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="rounded-md border border-dotted px-[5px] py-[1px] text-xs opacity-70">
                      {message.totalReplies}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="px-1 py-0 text-xs">
                    {message.totalReplies} Replies
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          </div>
          {message.receivedOn ? (
            <p
              className={cn(
                "text-xs font-normal opacity-70 transition-opacity group-hover:opacity-100",
                isMailSelected && "opacity-100",
              )}
            >
              {formatDate(message.receivedOn.split(".")[0] || "")}
            </p>
          ) : null}
        </div>
        <p
          className={cn(
            "mt-1 line-clamp-1 text-xs opacity-70 transition-opacity",
            mail.selected ? "line-clamp-1" : "line-clamp-2",
            isMailSelected && "opacity-100",
          )}
        >
          {highlightText(message.subject, searchValue.highlight)}
        </p>
      </div>
    );
  },
);

Thread.displayName = "Thread";

export function MailListDemo({ items: filteredItems = items }) {
  return (
    <ScrollArea className="h-full pb-2" type="scroll">
      <div className={cn("relative min-h-[calc(100vh-4rem)] w-full")}>
        <div className="absolute left-0 top-0 w-full p-[8px]">
          {filteredItems.map((item) => {
            return item ? <Thread demo key={item.id} message={item} selectMode={"single"} /> : null;
          })}
        </div>
      </div>
    </ScrollArea>
  );
}

export function MailList({ isCompact }: MailListProps) {
  const { folder } = useParams<{ folder: string }>();
  const [mail, setMail] = useMail();
  const { data: session } = useSession();

  const sessionData = useMemo(
    () => ({
      userId: session?.user?.id ?? "",
      connectionId: session?.connectionId ?? null,
    }),
    [session],
  );

  const [searchValue] = useSearchValue();

  const {
    data: { threads: items, nextPageToken },
    mutate,
    optimisticUpdate,
    isValidating,
    isLoading,
    loadMore,
  } = useThreads(folder, undefined, searchValue.value, defaultPageSize);

  const parentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemHeight = isCompact ? 64 : 96;

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: useCallback(() => itemHeight, []),
    gap: 6,
  });

  const virtualItems = virtualizer.getVirtualItems();

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (isLoading || isValidating) return;

      const target = e.target as HTMLDivElement;
      const { scrollTop, scrollHeight, clientHeight } = target;
      const scrolledToBottom = scrollHeight - (scrollTop + clientHeight) < itemHeight * 2;

      if (scrolledToBottom) {
        console.log("Loading more items...");
        void loadMore();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLoading, isValidating, nextPageToken, itemHeight],
  );

  const [massSelectMode, setMassSelectMode] = useState(false);
  const [rangeSelectMode, setRangeSelectMode] = useState(false);
  const [selectAllBelowMode, setSelectAllBelowMode] = useState(false);

  const selectAll = useCallback(() => {
    // If there are already items selected, deselect them all
    if (mail.bulkSelected.length > 0) {
      setMail((prev) => ({
        ...prev,
        bulkSelected: [],
      }));
      toast.success("Deselected all emails");
    }
    // Otherwise select all items
    else if (items.length > 0) {
      const allIds = items.map((item) => item.id);
      setMail((prev) => ({
        ...prev,
        bulkSelected: allIds,
      }));
      toast.success(`Selected ${allIds.length} emails`);
    } else {
      toast.info("No emails to select");
    }
  }, [items, setMail, mail.bulkSelected]);

  const resetSelectMode = () => {
    setMassSelectMode(false);
    setRangeSelectMode(false);
    setSelectAllBelowMode(false);
  };

  useHotKey("Control", () => {
    resetSelectMode();
    setMassSelectMode(true);
  });

  useHotKey("Meta", () => {
    resetSelectMode();
    setMassSelectMode(true);
  });

  useHotKey("Shift", () => {
    resetSelectMode();
    setRangeSelectMode(true);
  });

  useHotKey("Alt+Shift", () => {
    resetSelectMode();
    setSelectAllBelowMode(true);
  });

  useHotKey("Meta+Shift+u", () => {
    resetSelectMode();
    void (async () => {
      const res = await markAsUnread({ ids: mail.bulkSelected });
      if (res.success) {
        toast.success("Marked as unread");
        setMail((prev) => ({
          ...prev,
          bulkSelected: [],
        }));
      } else toast.error("Failed to mark as unread");
    })();
  });

  useHotKey("Control+Shift+u", () => {
    resetSelectMode();
    void (async () => {
      const res = await markAsUnread({ ids: mail.bulkSelected });
      if (res.success) {
        toast.success("Marked as unread");
        setMail((prev) => ({
          ...prev,
          bulkSelected: [],
        }));
      } else toast.error("Failed to mark as unread");
    })();
  });

  useHotKey("Meta+Shift+i", () => {
    resetSelectMode();
    void (async () => {
      const res = await markAsRead({ ids: mail.bulkSelected });
      if (res.success) {
        toast.success("Marked as read");
        setMail((prev) => ({
          ...prev,
          bulkSelected: [],
        }));
      } else toast.error("Failed to mark as read");
    })();
  });

  useHotKey("Control+Shift+i", () => {
    resetSelectMode();
    void (async () => {
      const res = await markAsRead({ ids: mail.bulkSelected });
      if (res.success) {
        toast.success("Marked as read");
        setMail((prev) => ({
          ...prev,
          bulkSelected: [],
        }));
      } else toast.error("Failed to mark as read");
    })();
  });

  // useHotKey("Meta+Shift+j", async () => {
  //   resetSelectMode();
  //   const res = await markAsJunk({ ids: mail.bulkSelected });
  //   if (res.success) toast.success("Marked as junk");
  //   else toast.error("Failed to mark as junk");
  // });

  // useHotKey("Control+Shift+j", async () => {
  //   resetSelectMode();
  //   const res = await markAsJunk({ ids: mail.bulkSelected });
  //   if (res.success) toast.success("Marked as junk");
  //   else toast.error("Failed to mark as junk");
  // });

  useHotKey("Meta+a", (event) => {
    event?.preventDefault();
    resetSelectMode();
    selectAll();
  });

  useHotKey("Control+a", (event) => {
    event?.preventDefault();
    resetSelectMode();
    selectAll();
  });

  useHotKey("Meta+n", (event) => {
    event?.preventDefault();
    resetSelectMode();
    selectAll();
  });

  useHotKey("Control+n", (event) => {
    event?.preventDefault();
    resetSelectMode();
    selectAll();
  });

  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") {
        setMassSelectMode(false);
      }
      if (e.key === "Shift") {
        setRangeSelectMode(false);
      }
      if (e.key === "Alt") {
        setSelectAllBelowMode(false);
      }
    };

    const handleBlur = () => {
      setMassSelectMode(false);
      setRangeSelectMode(false);
      setSelectAllBelowMode(false);
    };

    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      setMassSelectMode(false);
      setRangeSelectMode(false);
      setSelectAllBelowMode(false);
    };
  }, []);

  const selectMode: MailSelectMode = massSelectMode
    ? "mass"
    : rangeSelectMode
      ? "range"
      : selectAllBelowMode
        ? "selectAllBelow"
        : "single";

  const handleMailClick = useCallback(
    (message: InitialThread) => () => {
      if (selectMode === "mass") {
        const updatedBulkSelected = mail.bulkSelected.includes(message.id)
          ? mail.bulkSelected.filter((id) => id !== message.id)
          : [...mail.bulkSelected, message.id];

        setMail({ ...mail, bulkSelected: updatedBulkSelected });
        return;
      }

      if (selectMode === "range") {
        const lastSelectedItem =
          mail.bulkSelected[mail.bulkSelected.length - 1] ?? mail.selected ?? message.id;

        const mailsIndex = items.map((m) => m.id);
        const startIdx = mailsIndex.indexOf(lastSelectedItem);
        const endIdx = mailsIndex.indexOf(message.id);

        if (startIdx !== -1 && endIdx !== -1) {
          const selectedRange = mailsIndex.slice(
            Math.min(startIdx, endIdx),
            Math.max(startIdx, endIdx) + 1,
          );

          setMail({ ...mail, bulkSelected: selectedRange });
        }
        return;
      }

      if (selectMode === "selectAllBelow") {
        const mailsIndex = items.map((m) => m.id);
        const startIdx = mailsIndex.indexOf(message.id);

        if (startIdx !== -1) {
          const selectedRange = mailsIndex.slice(startIdx);

          setMail({ ...mail, bulkSelected: selectedRange });
        }
        return;
      }

      if (mail.selected === message.threadId || mail.selected === message.id) {
        setMail({
          selected: null,
          bulkSelected: [],
        });
      } else {
        setMail({
          ...mail,
          selected: message.threadId ?? message.id,
          bulkSelected: [],
        });
      }
      if (message.unread) {
        optimisticUpdate(message.id, { unread: false });

        return markAsRead({ ids: [message.id] }).catch((error) => {
          console.error(error);
          optimisticUpdate(message.id, { unread: true });
        });
      }
    },
    [mail, setMail, selectMode],
  );

  const isEmpty = items.length === 0;
  const isFiltering = searchValue.value.trim().length > 0;

  if (isEmpty && session) {
    if (isFiltering) {
      return <EmptyState folder="search" className="min-h-[90vh] md:min-h-[90vh]" />;
    }
    return <EmptyState folder={folder as FolderType} className="min-h-[90vh] md:min-h-[90vh]" />;
  }

  return (
    <ScrollArea
      ref={scrollRef}
      className="h-full pb-2"
      type="scroll"
      onScrollCapture={handleScroll}
    >
      <div
        ref={parentRef}
        className={cn("w-full", selectMode === "range" && "select-none")}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: "relative",
        }}
      >
        {virtualItems.map(({ index, key, start }) => {
          const item = items[index];
          return item ? (
            <div
              key={key}
              style={{
                position: "absolute",
                transform: `translateY(${start ?? 0}px)`,
                top: 0,
                left: 0,
                width: "100%",
                padding: "8px",
              }}
            >
              <Thread
                onClick={handleMailClick}
                message={item}
                selectMode={selectMode}
                isCompact={isCompact}
                sessionData={sessionData}
              />
            </div>
          ) : null;
        })}
      </div>
      <div className="w-full pt-4 text-center">
        {isLoading || isValidating ? (
          <div className="text-center">
            <div className="mx-auto h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
          </div>
        ) : (
          <div className="h-4" />
        )}
      </div>
    </ScrollArea>
  );
}

const MailLabels = memo(
  ({ labels }: { labels: string[] }) => {
    if (!labels.length) return null;

    const visibleLabels = labels.filter(
      (label) => !["unread", "inbox"].includes(label.toLowerCase()),
    );

    if (!visibleLabels.length) return null;

    return (
      <div className={cn("flex select-none items-center gap-1")}>
        {visibleLabels.map((label) => {
          const style = getDefaultBadgeStyle(label);
          // Skip rendering if style is "secondary" (default case)
          if (style === "secondary") return null;

          return (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <Badge className="rounded-md p-1" variant={style}>
                  {getLabelIcon(label)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="px-1 py-0 text-xs" variant={style}>
                {capitalize(label.replace(/^category_/i, ""))}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  },
  (prev, next) => {
    return prev.labels === next.labels;
  },
);
MailLabels.displayName = "MailLabels";

function capitalize(str: string) {
  return str.substring(0, 1).toUpperCase() + str.substring(1).toLowerCase();
}

function getLabelIcon(label: string) {
  const normalizedLabel = label.toLowerCase().replace(/^category_/i, "");

  switch (normalizedLabel) {
    case "important":
      return <AlertTriangle className="h-3 w-3" />;
    case "promotions":
      return <Tag className="h-3 w-3 rotate-90" />;
    case "personal":
      return <User className="h-3 w-3" />;
    case "updates":
      return <Bell className="h-3 w-3" />;
    case "work":
      return <Briefcase className="h-3 w-3" />;
    case "forums":
      return <Users className="h-3 w-3" />;
    default:
      return null;
  }
}

function getDefaultBadgeStyle(label: string): ComponentProps<typeof Badge>["variant"] {
  const normalizedLabel = label.toLowerCase().replace(/^category_/i, "");

  switch (normalizedLabel) {
    case "important":
      return "important";
    case "promotions":
      return "promotions";
    case "personal":
      return "personal";
    case "updates":
      return "updates";
    case "work":
      return "default";
    case "forums":
      return "forums";
    default:
      return "secondary";
  }
}
