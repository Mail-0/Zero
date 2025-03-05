"use client";

import { SquarePenIcon, SquarePenIconHandle } from "../icons/animated/square-pen";
import { Sidebar, SidebarContent, SidebarHeader } from "@/components/ui/sidebar";
import { useOpenComposeModal } from "@/hooks/use-open-compose-modal";
import { navigationConfig } from "@/config/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import React, { useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useAISidebar } from "./ai-sidebar";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import { Button } from "./button";
import Image from "next/image";
import { useStats } from "@/hooks/use-stats";
import { FOLDERS } from "@/lib/utils";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: stats } = useStats();

  const pathname = usePathname();

  const { currentSection, navItems } = useMemo(() => {
    // Find which section we're in based on the pathname
    const section = Object.entries(navigationConfig).find(([, config]) =>
      pathname.startsWith(config.path),
    );

    const currentSection = section?.[0] || "mail";
    if (navigationConfig[currentSection]) {
      const items = [...navigationConfig[currentSection].sections];

      if (currentSection === "mail" && stats && stats.length) {
        if (items[0]?.items[0]) {
          items[0].items[0].badge = stats.find((stat) => stat.label?.toLowerCase() === FOLDERS.INBOX)?.count ?? 0;
        }
        if (items[0]?.items[3]) {
          items[0].items[3].badge = stats.find((stat) => stat.label?.toLowerCase() === FOLDERS.SENT)?.count ?? 0;
        }
      }

      return { currentSection, navItems: items };
    } else {
      return {
        currentSection: "",
        navItems: [],
      };
    }
  }, [pathname, stats]);

  const showComposeButton = currentSection === "mail";

  const { toggleOpen: toggleAISidebar } = useAISidebar();

  return (
    <Sidebar collapsible="icon" {...props} className="flex flex-col items-center pl-1.5 bg-offsetWhite dark:bg-offsetDark">
      <div className="flex w-full flex-col">
        <SidebarHeader className="flex flex-col gap-2 p-2">
          <NavUser />
          <AnimatePresence mode="wait">
            {showComposeButton && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <ComposeButton />
              </motion.div>
            )}
          </AnimatePresence>
        </SidebarHeader>
        <SidebarContent className="py-0 pt-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSection}
              initial={{ opacity: 0, x: currentSection === "mail" ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: currentSection === "mail" ? 20 : -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 py-0"
            >
              <NavMain items={navItems} />
            </motion.div>
          </AnimatePresence>
        </SidebarContent>
      </div>

      <div
        className="mb-4 ml-2 mt-auto cursor-pointer pl-1.5"
        onClick={toggleAISidebar}
        title="Open AI Assistant (Cmd+S)"
      >
        <div>
          <Image
            src="/ai.svg"
            alt="Mail0 Logo"
            width={28}
            height={28}
            className="hidden transition-transform duration-300 hover:rotate-90 dark:block"
          />
          <Image
            src="/ai.svg"
            alt="Mail0 Logo"
            width={28}
            height={28}
            className="transition-transform duration-300 hover:rotate-90 dark:hidden"
          />
        </div>
      </div>
    </Sidebar>
  );
}

function ComposeButton() {
  const iconRef = useRef<SquarePenIconHandle>(null);
  const { open } = useOpenComposeModal();
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const router = useRouter();

  return (
    <Button
      onClick={() => router.push("/mail/create")}
      className="bg-secondary bg-subtleWhite text-primary hover:bg-subtleWhite dark:bg-subtleBlack dark:hover:bg-subtleBlack relative isolate mt-1 h-8 w-[calc(100%)] overflow-hidden whitespace-nowrap shadow-inner"
      onMouseEnter={() => () => iconRef.current?.startAnimation?.()}
      onMouseLeave={() => () => iconRef.current?.stopAnimation?.()}
    >
      {state === "collapsed" && !isMobile ? (
        <SquarePenIcon ref={iconRef} className="size-4" />
      ) : (
        <>
          <span className="text-center text-sm">Create Email</span>
        </>
      )}
    </Button>
  );
}
