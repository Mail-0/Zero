"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlignVerticalSpaceAround,
  ArchiveX,
  BellOff,
  Check,
  ListFilter,
  SearchIcon,
  X,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useState, useCallback, useMemo, useEffect, ReactNode } from "react";
import { ThreadDisplay } from "@/components/mail/thread-display";
import { useMediaQuery } from "../../hooks/use-media-query";
import { useSearchValue } from "@/hooks/use-search-value";
import { MailList } from "@/components/mail/mail-list";
import { useMail } from "@/components/mail/use-mail";
import { SidebarToggle } from "../ui/sidebar-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { type Mail } from "@/components/mail/data";
import { useSearchParams } from "next/navigation";
import { useThreads } from "@/hooks/use-threads";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { SearchBar } from "./search-bar";

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
  }, [session?.user, isPending, router]);

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

  const { data: threadsResponse, isLoading } = useThreads(folder, labels, searchValue.value);
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [isTransitioning, setIsTransitioning] = useState(true);

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

  useEffect(() => {
    if (!isLoading) {
      const timeout = setTimeout(() => {
        setIsTransitioning(false);
      }, 300);

      return () => clearTimeout(timeout);
    } else {
      setIsTransitioning(true);
    }
  }, [isLoading]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setMail((mail) => ({ ...mail, selected: null }));
  }, [setMail]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="rounded-inherit flex">
        <ResizablePanelGroup
          direction="horizontal"
          autoSaveId="mail-panel-layout"
          className="rounded-inherit gap-1.5 overflow-hidden rounded-tl-md"
        >
          <ResizablePanel
            className="border-none !bg-transparent"
            defaultSize={isMobile ? 100 : 25}
            minSize={isMobile ? 100 : 25}
          >
            <div className="flex-1 flex-col overflow-y-auto border bg-card shadow-sm md:flex md:rounded-2xl md:shadow-sm">
              <div className="sticky top-0 z-10 flex items-center justify-between gap-1.5 p-2">
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
                                className="ml-1.5 h-8 w-fit px-2 text-muted-foreground"
                                onClick={() => setMail({ ...mail, bulkSelected: [] })}
                              >
                                <X />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Clear Selection</TooltipContent>
                          </Tooltip>
                        </div>
                        <BulkSelectActions />
                      </>
                    ) : (
                      <>
                        <h1 className="flex-1 text-center text-sm font-medium">Inbox</h1>
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
                {mail.bulkSelected.length === 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="md:h-fit md:px-2">
                        <ListFilter className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setFilterValue("all")}>
                        All mail {filterValue === "all" && <Check />}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setFilterValue("unread")}>
                        Unread {filterValue === "unread" && <Check />}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <div className="h-[calc(100svh-(8px+8px+14px+44px-2px))] overflow-scroll p-2 pt-0">
                {isLoading || isTransitioning ? (
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
                className="shadow-sm md:flex md:rounded-2xl md:border md:shadow-sm"
                defaultSize={75}
                minSize={25}
              >
                <div className="hidden h-[calc(100vh-(12px+14px))] flex-1 md:block">
                  <ThreadDisplay mail={mail.selected} onClose={handleClose} />
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>

        {/* Mobile Drawer */}
        {isMobile && (
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerContent className="h-[calc(100vh-3rem)] bg-card p-0">
              <DrawerHeader className="sr-only">
                <DrawerTitle>Email Details</DrawerTitle>
              </DrawerHeader>
              <div className="flex h-full flex-col overflow-hidden">
                <ThreadDisplay mail={mail.selected} onClose={handleClose} isMobile={true} />
              </div>
            </DrawerContent>
          </Drawer>
        )}
      </div>
    </TooltipProvider>
  );
}

function BulkSelectActions() {
  return (
    <div className="flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" className="md:h-fit md:px-2">
            <BellOff />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Mute</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" className="md:h-fit md:px-2">
            <ArchiveX />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Move to Junk</TooltipContent>
      </Tooltip>
    </div>
  );
}
