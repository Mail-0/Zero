"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { AlignVerticalSpaceAround, ArchiveX, BellOff, SearchIcon, X, Archive, BanIcon, InboxIcon } from "lucide-react";
import { useState, useCallback, useMemo, useEffect, ReactNode } from "react";
import { ThreadDisplay } from "@/components/mail/thread-display";
import { useMediaQuery } from "../../hooks/use-media-query";
import { useSearchValue } from "@/hooks/use-search-value";
import { MailList } from "@/components/mail/mail-list";
import { useMail } from "@/components/mail/use-mail";
import { SidebarToggle } from "../ui/sidebar-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { type Mail } from "@/components/mail/data";
import { useSearchParams, useParams } from "next/navigation";
import { useThreads } from "@/hooks/use-threads";
import { Button } from "@/components/ui/button";
import { useHotKey } from "@/hooks/use-hot-key";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { SearchBar } from "./search-bar";
import { cn } from "@/lib/utils";
import { useMailMutation } from "@/hooks/use-mail-mutation";
import { toast } from "sonner";

interface MailProps {
  accounts: {
    label: string;
    email: string;
    icon: ReactNode;
  }[];
  folder: string;
  defaultLayout: number[] | undefined;
  defaultCollapsed?: boolean;
  navCollapsedSize: number;
  muted?: boolean;
}

export function Mail({ folder }: MailProps) {
  const [searchMode, setSearchMode] = useState(false);
  const [searchValue] = useSearchValue();
  const [mail, setMail] = useMail();
  const [isCompact, setIsCompact] = useState(false);
  const searchParams = useSearchParams();
  const [isMobile, setIsMobile] = useState(false);
  const [filterValue, setFilterValue] = useState<"all" | "unread">("all");
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!session?.user && !isPending) {
      router.push("/login");
    }
  }, [session?.user, isPending]);

  const labels = useMemo(() => {
    if (filterValue === "all") {
      if (searchParams.has("category")) {
        return [`CATEGORY_${searchParams.get("category")!.toUpperCase()}`];
      }
      return undefined;
    }
    if (filterValue) {
      if (searchParams.has("category")) {
        return [
          filterValue.toUpperCase(),
          `CATEGORY_${searchParams.get("category")!.toUpperCase()}`,
        ];
      }
      return [filterValue.toUpperCase()];
    }
    return undefined;
  }, [filterValue, searchParams]);

  const {
    data: threadsResponse,
    isLoading,
    isValidating,
  } = useThreads(searchValue.folder || folder, labels, searchValue.value);
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Check if we're on mobile on mount and when window resizes
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768); // 768px is the 'md' breakpoint
    };

    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);

    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  useEffect(() => {
    if (mail.selected) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [mail.selected]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setMail((mail) => ({ ...mail, selected: null }));
  }, [setMail]);

  useHotKey("/", () => {
    setSearchMode(true);
  });

  useHotKey("Esc", (event) => {
    // @ts-expect-error
    event.preventDefault();
    if (searchMode) {
      setSearchMode(false);
    }
  });

  return (
    <TooltipProvider delayDuration={0}>
      <div className="rounded-inherit flex">
        <ResizablePanelGroup
          direction="horizontal"
          autoSaveId="mail-panel-layout"
          className="rounded-inherit gap-1.5 overflow-hidden"
        >
          <ResizablePanel
            className={cn(
              "border-none !bg-transparent",
              mail?.selected ? "md:hidden lg:block" : "", // Hide on md, but show again on lg and up
            )}
            defaultSize={isMobile ? 100 : 25}
            minSize={isMobile ? 100 : 25}
          >
            <div className="bg-offsetLight dark:bg-offsetDark flex-1 flex-col overflow-y-auto shadow-inner md:flex md:rounded-2xl md:border md:shadow-sm">
              <div
                className={cn(
                  "sticky top-0 z-10 flex items-center justify-between gap-1.5 border-b-2 p-2 transition-colors",
                  isValidating ? "border-b-green-500" : "border-b-transparent",
                )}
              >
                <SidebarToggle className="h-fit px-2" />
                <Button
                  variant="ghost"
                  className="md:h-fit md:px-2"
                  onClick={() => setIsCompact(!isCompact)}
                >
                  <AlignVerticalSpaceAround />
                </Button>
                {searchMode && (
                  <div className="flex flex-1 items-center justify-center gap-1.5">
                    <SearchBar />
                    <Button
                      variant="ghost"
                      className="md:h-fit md:px-2"
                      onClick={() => setSearchMode(false)}
                    >
                      <X />
                    </Button>
                  </div>
                )}
                {!searchMode && (
                  <>
                    {mail.bulkSelected.length > 0 ? (
                      <>
                        <div className="flex flex-1 items-center justify-center">
                          <span className="text-sm font-medium tabular-nums">
                            {mail.bulkSelected.length} selected
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground ml-1.5 h-8 w-fit px-2"
                                onClick={() => setMail({ ...mail, bulkSelected: [] })}
                              >
                                <X />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Clear Selection</TooltipContent>
                          </Tooltip>
                        </div>
                        <BulkSelectActions selected={mail.bulkSelected} setSelected={(selected) => setMail({ ...mail, bulkSelected: selected })} />
                      </>
                    ) : (
                      <>
                        <h1 className="flex-1 text-center text-sm font-medium capitalize">
                          {folder}
                        </h1>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="ghost"
                            className="md:h-fit md:px-2"
                            onClick={() => setSearchMode(true)}
                          >
                            <SearchIcon />
                          </Button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
              <div className="h-[calc(100dvh-56px)] overflow-hidden pt-0 md:h-[calc(100dvh-(8px+8px+14px+44px))]">
                {isLoading ? (
                  <div className="flex flex-col">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="flex flex-col px-4 py-3">
                        <div className="flex w-full items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-24" />
                          </div>
                          <Skeleton className="h-3 w-12" />
                        </div>
                        <Skeleton className="mt-2 h-3 w-32" />
                        <Skeleton className="mt-2 h-3 w-full" />
                        <div className="mt-2 flex gap-2">
                          <Skeleton className="h-4 w-16 rounded-full" />
                          <Skeleton className="h-4 w-16 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <MailList
                    items={threadsResponse?.threads || []}
                    isCompact={isCompact}
                    folder={folder}
                  />
                )}
              </div>
            </div>
          </ResizablePanel>

          {isDesktop && mail.selected && (
            <>
              <ResizableHandle className="opacity-0" />
              <ResizablePanel
                className="shadow-sm md:flex md:rounded-2xl md:border md:shadow-sm bg-offsetLight dark:bg-offsetDark"
                defaultSize={75}
                minSize={25}
              >
                <div className="hidden h-[calc(100vh-(12px+14px))] flex-1 md:block relative top-2">
                  <ThreadDisplay mail={mail.selected} onClose={handleClose} />
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>

        {/* Mobile Drawer */}
        {isMobile && (
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerContent className="bg-offsetLight dark:bg-offsetDark h-[calc(100vh-3rem)] overflow-hidden p-0">
              <DrawerHeader className="sr-only">
                <DrawerTitle>Email Details</DrawerTitle>
              </DrawerHeader>
              <div className="flex h-full flex-col overflow-hidden">
                <div className="flex-1 overflow-hidden">
                  <ThreadDisplay mail={mail.selected} onClose={handleClose} isMobile={true} />
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        )}
      </div>
    </TooltipProvider>
  );
}

interface BulkSelectActionsProps {
  selected: string[];
  setSelected: (selected: string[]) => void;
}

function BulkSelectActions({ selected, setSelected }: BulkSelectActionsProps) {
  const params = useParams();
  const currentFolder = typeof params?.folder === 'string' ? params.folder : 'inbox';
  
  const { archiveMultiple, moveToSpamMultiple, moveToInboxMultiple } = useMailMutation(currentFolder);
  const [isProcessing, setIsProcessing] = useState(false);
  const { data } = useThreads(currentFolder);
  
  const hasSentEmails = useMemo(() => {
    if (!data?.threads) return false;
    
    return selected.some(selectedId => {
      const thread = data.threads.find(thread => thread.id === selectedId);
      return thread?.tags?.includes('SENT');
    });
  }, [selected, data]);

  const handleArchive = async () => {
    if (selected.length === 0) return;
    
    setIsProcessing(true);
    console.log(`BulkSelectActions: Archiving ${selected.length} items`, selected);
    
    try {
      const success = await archiveMultiple(selected);
      
      if (success) {
        toast.success(`${selected.length} ${selected.length === 1 ? 'item' : 'items'} archived`);
        setSelected([]);
      } else {
        toast.error("Unable to archive some items. Items with SPAM label cannot be archived.");
      }
    } catch (error) {
      console.error('Error archiving items:', error);
      toast.error('Error archiving selected items');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMoveToSpam = async () => {
    if (selected.length === 0) return;
    
    setIsProcessing(true);
    console.log(`BulkSelectActions: Moving ${selected.length} items to spam`, selected);
    
    try {
      const success = await moveToSpamMultiple(selected);
      
      if (success) {
        toast.success(`${selected.length} ${selected.length === 1 ? 'item' : 'items'} marked as spam`);
        setSelected([]);
      } else {
        toast.error("Unable to mark some items as spam. Only items in inbox can be marked as spam.");
      }
    } catch (error) {
      console.error('Error marking items as spam:', error);
      toast.error('Error marking selected items as spam');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMoveToInbox = async () => {
    if (selected.length === 0) return;
    
    setIsProcessing(true);
    console.log(`BulkSelectActions: Moving ${selected.length} items to inbox`, selected);
    
    try {
      const success = await moveToInboxMultiple(selected);
      
      if (success) {
        toast.success(`${selected.length} ${selected.length === 1 ? 'item' : 'items'} moved to inbox`);
        setSelected([]);
      } else {
        toast.error("Failed to move some items to inbox");
      }
    } catch (error) {
      console.error('Error moving items to inbox:', error);
      toast.error('Error moving selected items to inbox');
    } finally {
      setIsProcessing(false);
    }
  };

  const isSpamFolder = currentFolder === 'spam';
  const isArchiveFolder = currentFolder === 'archive';

  if (isArchiveFolder) {
    return (
      <div className="flex items-center gap-2 ml-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleMoveToInbox}
          title="Move to inbox"
          disabled={isProcessing}
        >
          <InboxIcon className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 ml-1">
      {!isSpamFolder && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleArchive}
          title="Archive"
          disabled={isProcessing}
        >
          <Archive className="h-4 w-4" />
        </Button>
      )}
      {!isSpamFolder && !isArchiveFolder && !hasSentEmails && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleMoveToSpam}
          title="Mark as spam"
          disabled={isProcessing}
        >
          <ArchiveX className="h-4 w-4" />
        </Button>
      )}
      {isSpamFolder && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleMoveToInbox}
          title="Move to inbox"
          disabled={isProcessing}
        >
          <InboxIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
