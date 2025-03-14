"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DraftsList } from "@/components/draft/drafts-list";
import { useSearchValue } from "@/hooks/use-search-value";
import { SearchIcon } from "../icons/animated/search";
import { useMail } from "@/components/mail/use-mail";
import { SidebarToggle } from "../ui/sidebar-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { ArchiveX, BellOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn, defaultPageSize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useHotKey } from "@/hooks/use-hot-key";
import { SearchBar } from "../mail/search-bar";
import { useDrafts } from "@/hooks/use-drafts";
import { useSession } from "@/lib/auth-client";
import { XIcon } from "../icons/animated/x";
import { useRouter } from "next/navigation";

export function DraftsLayout() {
  const [searchMode, setSearchMode] = useState(false);
  const [searchValue] = useSearchValue();
  const [mail, setMail] = useMail();
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!session?.user && !isPending) {
      router.push("/login");
    }
  }, [session?.user, isPending]);

  const { isLoading, isValidating } = useDrafts(searchValue.value, defaultPageSize);

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

  const searchIconRef = useRef<any>(null);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="rounded-inherit flex">
        <div className="bg-offsetLight dark:bg-offsetDark flex-1 flex-col overflow-y-auto shadow-inner md:flex md:rounded-2xl md:border md:shadow-sm">
          <div
            className={cn(
              "compose-gradient h-0.5 w-full transition-opacity",
              isValidating ? "opacity-50" : "opacity-0",
            )}
          />
          <div
            className={cn(
              "sticky top-0 z-10 flex items-center justify-between gap-1.5 border-b p-2 transition-colors",
            )}
          >
            <SidebarToggle className="h-fit px-2" />
            {searchMode && (
              <div className="flex flex-1 items-center justify-center gap-3">
                <SearchBar />
                <Button
                  variant="ghost"
                  className="md:h-fit md:px-2"
                  onClick={() => setSearchMode(false)}
                >
                  <XIcon className="h-4 w-4" />
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
                    <BulkSelectActions />
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        className="md:h-fit md:px-2"
                        onClick={() => setSearchMode(true)}
                        onMouseEnter={() => searchIconRef.current?.startAnimation?.()}
                        onMouseLeave={() => searchIconRef.current?.stopAnimation?.()}
                      >
                        <SearchIcon ref={searchIconRef} className="h-4 w-4" />
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
              <DraftsList isCompact={true} />
            )}
          </div>
        </div>
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
        <TooltipContent>Move to Spam</TooltipContent>
      </Tooltip>
    </div>
  );
}
