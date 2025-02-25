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
import { mailCount } from "@/actions/mail";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import { Button } from "./button";
import Image from "next/image";
import useSWR from "swr";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: stats } = useSWR<number[]>("mail-count", mailCount);

  const pathname = usePathname();

  const { currentSection, navItems } = useMemo(() => {
    // Find which section we're in based on the pathname
    const section = Object.entries(navigationConfig).find(([, config]) =>
      pathname.startsWith(config.path),
    );

    const currentSection = section?.[0] || "mail";
    const items = [...navigationConfig[currentSection].sections];

    if (currentSection === "mail" && stats) {
      if (items[0]?.items[0]) {
        items[0].items[0].badge = stats[0] ?? 0;
      }
      if (items[0]?.items[3]) {
        items[0].items[3].badge = stats[1] ?? 0;
      }
    }

    return { currentSection, navItems: items };
  }, [pathname, stats]);

  const showComposeButton = currentSection === "mail";

  return (
    <Sidebar collapsible="icon" {...props} className="flex flex-col items-center pl-1">
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

      <div className="mb-4 ml-1 mt-auto pl-1.5">
        <Image
          src="/black-icon.svg"
          alt="Mail0 Logo"
          width={28}
          height={28}
          className="dark:hidden"
        />
        <Image
          src="/white-icon.svg"
          alt="Mail0 Logo"
          width={28}
          height={28}
          className="hidden dark:block"
        />
      </div>
    </Sidebar>
  );
}

function ComposeButton() {
  const iconRef = useRef<SquarePenIconHandle>(null);
  const { open } = useOpenComposeModal();
  const { state } = useSidebar();
  const isMobile = useIsMobile();

  return (
    <Button
      onClick={open}
      className="relative isolate mt-1 h-8 w-[calc(100%)] overflow-hidden whitespace-nowrap bg-secondary bg-subtleWhite text-primary shadow-inner hover:bg-subtleWhite dark:bg-subtleBlack dark:hover:bg-subtleBlack"
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
