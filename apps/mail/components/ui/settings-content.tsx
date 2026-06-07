import { DoormanTopBar } from '@/components/ui/doorman-top-bar';
import { SidebarToggle } from '@/components/ui/sidebar-toggle';
import { AppSidebar } from '@/components/ui/app-sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';

export function SettingsLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      <DoormanTopBar />
      <div className="flex min-h-0 flex-1">
        <AppSidebar topBarOffset className="hidden lg:flex" />
        <div className="bg-sidebar dark:bg-sidebar flex h-full min-w-0 flex-1 flex-col md:py-1">
          <div className="bg-panelLight dark:bg-panelDark flex h-full max-w-full flex-1 flex-col overflow-hidden border border-border shadow-inner md:mr-1 md:rounded-2xl md:shadow-sm dark:border-border">
            <div className="sticky top-0 z-15 flex shrink-0 items-center justify-between gap-1.5 border-b border-border p-2 px-[20px] transition-colors md:min-h-14 dark:border-border">
              <SidebarToggle className="h-fit px-2" />
            </div>
            <ScrollArea className="min-h-0 flex-1 overflow-hidden pt-0">
              <div className="p-4">{children}</div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}
