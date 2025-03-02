"use client";

import { ComponentProps, useCallback, useEffect, useRef, useState, useMemo } from "react";
import { preloadThread, useThreads } from "@/hooks/use-threads";
import { EmptyState, type FolderType } from "@/components/mail/empty-state";
import { useSearchValue } from "@/hooks/use-search-value";
import { markAsRead, markAsUnread } from "@/actions/mail";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMail } from "@/components/mail/use-mail";
import { useHotKey } from "@/hooks/use-hot-key";
import { useSession } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { InitialThread } from "@/types";
import { EmailContextMenu } from "./email-context-menu";
import { toast } from "sonner";

interface MailListProps {
  items: InitialThread[];
  isCompact?: boolean;
  folder: string;
}

const HOVER_DELAY = 300; // ms before prefetching

type MailSelectMode = "mass" | "range" | "single" | "selectAllBelow";

type ThreadProps = {
  message: InitialThread;
  selectMode: MailSelectMode;
  onSelect: (message: InitialThread) => void;
  isCompact?: boolean;
};

const Thread = ({ message: initialMessage, selectMode, onSelect, isCompact }: ThreadProps) => {
  const [message, setMessage] = useState(initialMessage);
  const [mail, setMail] = useMail();
  const { data: session } = useSession();
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isHovering = useRef<boolean>(false);
  const hasPrefetched = useRef<boolean>(false);
  const isLongPressing = useRef<boolean>(false);
  const [searchValue] = useSearchValue();
  const isMobile = useIsMobile();

  const isMailSelected = message.id === mail.selected;
  const isMailBulkSelected = mail.bulkSelected.includes(message.id);
  const isBulkSelectionMode = mail.bulkSelected.length > 0;

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

  const handleMailClick = async () => {
    if (isMobile && isBulkSelectionMode) {
      const updatedBulkSelected = mail.bulkSelected.includes(message.id)
        ? mail.bulkSelected.filter((id) => id !== message.id)
        : [...mail.bulkSelected, message.id];

      setMail({ ...mail, bulkSelected: updatedBulkSelected });
      return;
    }
    
    onSelect(message);
    if (!selectMode && !isMailSelected && message.unread) {
      try {
        setMessage((prev) => ({ ...prev, unread: false }));
        await markAsRead({ ids: [message.id] });
      } catch (error) {
        console.error("Error marking message as read:", error);
      }
    }
  };

  const handleTouchStart = () => {
    if (isMobile) {
      isLongPressing.current = false;
      longPressTimeoutRef.current = setTimeout(() => {
        isLongPressing.current = true;
        console.log('Long press detected, activating bulk selection mode');
        
        if (!mail.bulkSelected.includes(message.id)) {
          setMail({ 
            ...mail, 
            bulkSelected: [...mail.bulkSelected, message.id]
          });
        }
      }, 500);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isMobile && longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      
      if (isLongPressing.current) {
        e.preventDefault();
        isLongPressing.current = false;
      }
    }
  };

  const handleMouseEnter = () => {
    isHovering.current = true;

    // Prefetch only in single select mode
    if (selectMode === "single" && session?.user.id && !hasPrefetched.current) {
      // Clear any existing timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }

      // Set new timeout for prefetch
      hoverTimeoutRef.current = setTimeout(() => {
        if (isHovering.current) {
          const messageId = message.threadId ?? message.id;
          // Only prefetch if still hovering and hasn't been prefetched
          console.log(`🕒 Hover threshold reached for email ${messageId}, initiating prefetch...`);
          preloadThread(session.user.id, messageId, session.connectionId!);
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
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, []);

  if (isMobile) {
    return (
      <div
        onClick={handleMailClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => e.preventDefault()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        key={message.id}
        className={cn(
          "group relative flex cursor-pointer flex-col items-start overflow-clip rounded-lg border border-transparent px-4 py-3 text-left text-sm transition-all hover:bg-offsetLight hover:bg-primary/5 hover:opacity-100",
          !message.unread && "opacity-50",
          (isMailSelected || isMailBulkSelected) && "border-border bg-primary/5 opacity-100",
          isCompact && "py-2",
        )}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-1 -translate-x-2 bg-primary transition-transform ease-out",
            isMailBulkSelected && "translate-x-0",
          )}
        />
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                message.unread ? "font-bold" : "font-medium",
                "text-md flex items-baseline gap-1 group-hover:opacity-100",
              )}
            >
              <span className={cn(mail.selected && "max-w-[120px] truncate")}>
                {highlightText(message.sender.name, searchValue.highlight)}
              </span>{" "}
              {message.totalReplies !== 1 ? (
                <span className="ml-0.5 text-xs opacity-70">{message.totalReplies}</span>
              ) : null}
              {message.unread ? <span className="ml-0.5 size-2 rounded-full bg-skyBlue" /> : null}
            </p>
          </div>
          {message.receivedOn ? (
            <p
              className={cn(
                "text-xs font-normal opacity-70 transition-opacity group-hover:opacity-100",
                isMailSelected && "opacity-100",
              )}
            >
              {formatDate(message.receivedOn.split(".")[0] ?? '')}
            </p>
          ) : null}
        </div>
        <p
          className={cn(
            "mt-1 text-xs opacity-70 transition-opacity",
            mail.selected ? "line-clamp-1" : "line-clamp-2",
            isCompact && "line-clamp-1",
            isMailSelected && "opacity-100",
          )}
        >
          {highlightText(message.title, searchValue.highlight)}
        </p>
        {!isCompact && <MailLabels labels={message.tags} />}
      </div>
    );
  }

  return (
    <EmailContextMenu 
      emailId={message.id} 
      hasInboxLabel={message.tags.includes('INBOX')}
      hasSpamLabel={message.tags.includes('SPAM')}
      hasSentLabel={message.tags.includes('SENT')}
    >
      <div
        onClick={handleMailClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        key={message.id}
        className={cn(
          "group relative flex cursor-pointer flex-col items-start overflow-clip rounded-lg border border-transparent px-4 py-3 text-left text-sm transition-all hover:bg-offsetLight hover:bg-primary/5 hover:opacity-100",
          !message.unread && "opacity-50",
          (isMailSelected || isMailBulkSelected) && "border-border bg-primary/5 opacity-100",
          isCompact && "py-2",
        )}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-1 -translate-x-2 bg-primary transition-transform ease-out",
            isMailBulkSelected && "translate-x-0",
          )}
        />
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                message.unread ? "font-bold" : "font-medium",
                "text-md flex items-baseline gap-1 group-hover:opacity-100",
              )}
            >
              <span className={cn(mail.selected && "max-w-[120px] truncate")}>
                {highlightText(message.sender.name, searchValue.highlight)}
              </span>{" "}
              {message.totalReplies !== 1 ? (
                <span className="ml-0.5 text-xs opacity-70">{message.totalReplies}</span>
              ) : null}
              {message.unread ? <span className="ml-0.5 size-2 rounded-full bg-skyBlue" /> : null}
            </p>
          </div>
          {message.receivedOn ? (
            <p
              className={cn(
                "text-xs font-normal opacity-70 transition-opacity group-hover:opacity-100",
                isMailSelected && "opacity-100",
              )}
            >
              {formatDate(message.receivedOn.split(".")[0] ?? '')}
            </p>
          ) : null}
        </div>
        <p
          className={cn(
            "mt-1 text-xs opacity-70 transition-opacity",
            mail.selected ? "line-clamp-1" : "line-clamp-2",
            isCompact && "line-clamp-1",
            isMailSelected && "opacity-100",
          )}
        >
          {highlightText(message.title, searchValue.highlight)}
        </p>
        {!isCompact && <MailLabels labels={message.tags} />}
      </div>
    </EmailContextMenu>
  );
};

export function MailList({ items: initialItems, isCompact, folder }: MailListProps) {
  const [mail, setMail] = useMail();
  const { data: session } = useSession();
  const [searchValue] = useSearchValue();
  const [items, setItems] = useState(initialItems);
  const [pageToken, setPageToken] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const { data, error } = useThreads(folder, undefined, searchValue.value, 20, pageToken);

  useEffect(() => {
    if (error) {
      console.error("Error loading more emails:", error);
      setIsLoading(false);
      setHasMore(false);
    }
  }, [error]);

  useEffect(() => {
    setItems(initialItems);
    setPageToken(undefined);
    setHasMore(true);
  }, [initialItems]);

  useEffect(() => {
    if (data?.threads) {
      setItems((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const uniqueNewItems = data.threads.filter((item) => !existingIds.has(item.id));
        console.log(`Adding ${uniqueNewItems.length} new unique items`);
        return [...prev, ...uniqueNewItems];
      });
      setIsLoading(false);
      if (!data.nextPageToken) {
        setHasMore(false);
      }
    }
  }, [data]);

  const displayItems = useMemo(() => {
    if (folder.toLowerCase() === 'inbox') {
      return items.filter(item => !item.tags.includes('SENT'));
    }
    if (folder.toLowerCase() === 'sent') {
      return items.filter(item => item.tags.includes('SENT'));
    }
    return items;
  }, [items, folder]);

  const parentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemHeight = isCompact ? 64 : 96;

  const virtualizer = useVirtualizer({
    count: displayItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => itemHeight,
  });

  const virtualItems = virtualizer.getVirtualItems();

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!hasMore || isLoading) return;

      const target = e.target as HTMLDivElement;
      const { scrollTop, scrollHeight, clientHeight } = target;
      const scrolledToBottom = scrollHeight - (scrollTop + clientHeight) < itemHeight * 2;

      if (scrolledToBottom) {
        console.log("Loading more items...");
        setIsLoading(true);
        if (data?.nextPageToken) setPageToken(data.nextPageToken.toString());
      }
    },
    [hasMore, isLoading, data?.nextPageToken, itemHeight],
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

  useHotKey("Meta+Shift+u", async () => {
    resetSelectMode();
    const res = await markAsUnread({ ids: mail.bulkSelected });
    if (res.success) {
      toast.success("Marked as unread");
      setMail((prev) => ({
        ...prev,
        bulkSelected: [],
      }));
    } else toast.error("Failed to mark as unread");
  });

  useHotKey("Control+Shift+u", async () => {
    resetSelectMode();
    const res = await markAsUnread({ ids: mail.bulkSelected });
    if (res.success) {
      toast.success("Marked as unread");
      setMail((prev) => ({
        ...prev,
        bulkSelected: [],
      }));
    } else toast.error("Failed to mark as unread");
  });

  useHotKey("Meta+Shift+i", async () => {
    resetSelectMode();
    const res = await markAsRead({ ids: mail.bulkSelected });
    if (res.success) {
      toast.success("Marked as read");
      setMail((prev) => ({
        ...prev,
        bulkSelected: [],
      }));
    } else toast.error("Failed to mark as read");
  });

  useHotKey("Control+Shift+i", async () => {
    resetSelectMode();
    const res = await markAsRead({ ids: mail.bulkSelected });
    if (res.success) {
      toast.success("Marked as read");
      setMail((prev) => ({
        ...prev,
        bulkSelected: [],
      }));
    } else toast.error("Failed to mark as read");
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

  useHotKey("Meta+a", async (event) => {
    // @ts-expect-error
    event.preventDefault();
    resetSelectMode();
    selectAll();
  });

  useHotKey("Control+a", async (event) => {
    // @ts-expect-error
    event.preventDefault();
    resetSelectMode();
    selectAll();
  });

  useHotKey("Meta+n", async (event) => {
    // @ts-expect-error
    event.preventDefault();
    resetSelectMode();
    selectAll();
  });

  useHotKey("Control+n", async (event) => {
    // @ts-expect-error
    event.preventDefault();
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

  const handleMailClick = (message: InitialThread) => {
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
  };

  const isEmpty = items.length === 0;
  const isFiltering = searchValue.value.trim().length > 0;

  if (isEmpty && session) {
    if (isFiltering) {
      return <EmptyState folder="search" className="min-h-[90vh] md:min-h-[90vh]" />;
    }
    return <EmptyState folder={folder as FolderType} className="min-h-[90vh] md:min-h-[90vh]" />;
  }

  return (
    <ScrollArea ref={scrollRef} className="h-full pb-2" type="scroll" onScrollCapture={handleScroll}>
      <div
        ref={parentRef}
        className={cn(
          "relative min-h-[calc(100vh-4rem)] w-full",
          selectMode === "range" && "select-none",
        )}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        <div
          style={{ transform: `translateY(${virtualItems[0]?.start ?? 0}px)` }}
          className="absolute left-0 top-0 w-full p-[8px]"
        >
          {virtualItems.map(({ index, key }) => {
            const item = items[index];
            return item ? (
              <div className="mb-2" data-index={index} key={key} ref={virtualizer.measureElement} >
                <Thread
                  message={item}
                  selectMode={selectMode}
                  onSelect={handleMailClick}
                  isCompact={isCompact}
                />
              </div>
            ) : null;
          })}
          {hasMore && (
            <div className="w-full pt-2 text-center">
              {isLoading ? (
                <div className="text-center">
                  <div className="mx-auto h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
                </div>
              ) : (
                <div className="h-4" />
              )}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

function MailLabels({ labels }: { labels: string[] }) {
  if (!labels.length) return null;

  const visibleLabels = labels.filter(
    (label) => !["unread", "inbox"].includes(label.toLowerCase()),
  );

  if (!visibleLabels.length) return null;

  return (
    // TODO: When clicking on a label, apply filter to show only messages with that label.
    <div className={cn("mt-1.5 flex select-none items-center gap-2")}>
      {visibleLabels.map((label) => (
        <Badge key={label} className="rounded-full" variant={getDefaultBadgeStyle(label)}>
          <p className="text-xs font-medium lowercase">
            {label.replace(/^category_/i, "").replace(/_/g, " ")}
          </p>
        </Badge>
      ))}
    </div>
  );
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
