'use client';

import { SidebarToggle } from '@/components/ui/sidebar-toggle';
import { AppSidebar } from '@/components/ui/app-sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';

export function SettingsLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full">
      <AppSidebar className="hidden lg:flex" />
      <div className="w-full flex-1 bg-white dark:bg-black">
        <div className="md:shadow-s bg-offsetLight dark:bg-offsetDark flex h-[calc(98vh+10px)] mt-1 flex-col overflow-y-auto shadow-inner md:rounded-2xl md:border">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-1.5 border-b p-2">
            <SidebarToggle className="h-fit px-2" />
          </div>
          <ScrollArea className="h-[calc(100dvh-56px)] p-2 pt-0 md:h-[calc(100dvh-(8px+8px+14px+44px))]">
            <div className="p-2 md:p-3 md:pt-5">{children}</div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
