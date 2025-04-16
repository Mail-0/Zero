'use client';

import { SquarePenIcon, type SquarePenIconHandle } from '../icons/animated/square-pen';
import { Sidebar, SidebarContent, SidebarHeader } from '@/components/ui/sidebar';
import { navigationConfig } from '@/config/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useSidebar } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import React, { useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useStats } from '@/hooks/use-stats';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FOLDERS } from '@/lib/utils';
import { NavMain } from './nav-main';
import { NavUser } from './nav-user';
import { Button } from './button';
import Image from 'next/image';
import Link from 'next/link';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: stats } = useStats();

  const pathname = usePathname();

  const { currentSection, navItems } = useMemo(() => {
    // Find which section we're in based on the pathname
    const section = Object.entries(navigationConfig).find(([, config]) =>
      pathname.startsWith(config.path),
    );

    const currentSection = section?.[0] || 'mail';
    if (navigationConfig[currentSection]) {
      const items = [...navigationConfig[currentSection].sections];

      if (currentSection === 'mail' && stats && stats.length) {
        if (items[0]?.items[0]) {
          items[0].items[0].badge =
            stats.find((stat) => stat.label?.toLowerCase() === FOLDERS.INBOX)?.count ?? 0;
        }
        if (items[0]?.items[3]) {
          items[0].items[3].badge =
            stats.find((stat) => stat.label?.toLowerCase() === FOLDERS.SENT)?.count ?? 0;
        }
      }

      return { currentSection, navItems: items };
    } else {
      return {
        currentSection: '',
        navItems: [],
      };
    }
  }, [pathname, stats]);

  const showComposeButton = currentSection === 'mail';

  return (
    <>
      <Sidebar
        collapsible="icon"
        {...props}
        className="bg-offsetWhite dark:bg-offsetDark flex flex-col items-center"
      >
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
                initial={{ opacity: 0, x: currentSection === 'mail' ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: currentSection === 'mail' ? 20 : -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 py-0"
              >
                <NavMain items={navItems} />
              </motion.div>
            </AnimatePresence>
          </SidebarContent>
        </div>

        <div className="mb-4 mt-auto flex w-full items-center px-4">
          <Link href="/" className="relative h-6 w-6">
            <Image
              src="/black-icon.svg"
              alt="0.email Logo"
              width={24}
              height={24}
              className="object-contain dark:hidden"
            />
            <Image
              src="/white-icon.svg"
              alt="0.email Logo"
              width={24}
              height={24}
              className="hidden object-contain dark:block"
            />
          </Link>
        </div>
      </Sidebar>
    </>
  );
}

function ComposeButton() {
  const iconRef = useRef<SquarePenIconHandle>(null);
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const t = useTranslations();
  return (
    <Button
      asChild
      className="bg-secondary bg-subtleWhite text-primary hover:bg-subtleWhite dark:bg-subtleBlack dark:hover:bg-subtleBlack relative isolate mt-1 h-8 w-[calc(100%)] overflow-hidden whitespace-nowrap shadow-inner"
      onMouseEnter={() => () => iconRef.current?.startAnimation?.()}
      onMouseLeave={() => () => iconRef.current?.stopAnimation?.()}
    >
      <Link prefetch shallow href="/mail/create">
        {state === 'collapsed' && !isMobile ? (
          <SquarePenIcon ref={iconRef} className="size-4" />
        ) : (
          <>
            <span className="text-center text-sm">{t('common.actions.create')}</span>
          </>
        )}
      </Link>
    </Button>
  );
}
