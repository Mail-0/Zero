'use client';

import { ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { AppSidebar } from '@/components/ui/app-sidebar';
import { SidebarToggle } from '@/components/ui/sidebar-toggle';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';

export function SettingsLayoutContent({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();

  return (
    <div className="flex h-full w-full">
      <AppSidebar className="hidden lg:flex" />
      <div className="flex-1 bg-white dark:bg-black md:py-3 md:pr-2">
        <ResizablePanelGroup
          direction="horizontal"
          autoSaveId="settings-panel-layout"
          className="rounded-inherit h-full gap-1.5 overflow-hidden"
        >
          <ResizablePanel
            className="border-none !bg-transparent"
            defaultSize={isMobile ? 100 : 35}
            minSize={isMobile ? 100 : 35}
          >
            <div className="h-full md:shadow-s bg-offsetLight dark:bg-offsetDark flex flex-col overflow-y-auto shadow-inner md:rounded-2xl md:border">
              <div className="sticky top-0 z-10 flex items-center justify-between gap-1.5 border-b p-2">
                <SidebarToggle className="h-fit px-2" />
              </div>
              <ScrollArea className="h-[calc(100dvh-56px)] p-2 pt-0 md:h-[calc(100dvh-(8px+8px+14px+44px))]">
                <div className="p-2 md:p-3 md:pt-5">{children}</div>
              </ScrollArea>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}