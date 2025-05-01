'use client';

import { SidebarToggle } from '@/components/ui/sidebar-toggle';
import { AppSidebar } from '@/components/ui/app-sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';

export function SettingsLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full md:py-2 dark:bg-[#141414]">
      <AppSidebar className="hidden lg:flex" />
      <div className="w-full flex-1">
        <div className="bg-panelLight dark:bg-panelDark h-[calc(100dvh-)] max-w-full flex-1 flex-col overflow-y-auto overflow-x-hidden border border-[#E7E7E7] shadow-inner md:mr-1 md:flex md:rounded-2xl md:shadow-sm dark:border-[#252525]">
          <div className="sticky top-0 z-[15] flex items-center justify-between gap-1.5 border-b border-[#E7E7E7] p-2 px-[20px] transition-colors md:min-h-14 dark:border-[#252525]">
            <SidebarToggle className="h-fit px-2" />
          </div>
          <ScrollArea className="h-[calc(100vh-4.5rem)] overflow-hidden pt-0">
            <div className="p-4">{children}</div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
