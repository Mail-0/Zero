import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from '@/components/ui/sidebar';
import { navigationConfig, bottomNavItems } from '@/config/navigation';
// import { toast } from 'sonner';
import { CustomerCompanyPanel } from '../mail/customer-company-panel';
import type { FakeEmail } from '@/lib/fake-organised-data';
import { useLocation, useParams } from 'react-router';
// import { useTRPC } from '@/providers/query-provider';
import { useSidebar } from '@/components/ui/sidebar';
import { CreateEmail } from '../create/create-email';
// import { useBilling } from '@/hooks/use-billing'; // Commented out - not currently used
import { useIsMobile } from '@/hooks/use-mobile';
import { useSession } from '@/lib/auth-client';
// import { useMutation } from '@tanstack/react-query';
import { PencilCompose } from '../icons/icons';
import { useAIFullScreen } from './ai-sidebar';
import { m } from '@/paraglide/messages';
import React, { useMemo } from 'react';
// import { Video } from 'lucide-react';
import { NavUser } from './nav-user';
import { NavMain } from './nav-main';
import { useQueryState } from 'nuqs';
import { cn } from '@/lib/utils';

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  organisedEmail?: FakeEmail | null;
}

export function AppSidebar({ organisedEmail, ...props }: AppSidebarProps) {
  // const { isPro, isLoading } = useBilling(); // Commented out - not currently used
  const { isFullScreen } = useAIFullScreen();
  const location = useLocation();
  const { data: session } = useSession();
  const params = useParams<{ folder: string }>();
  const isOrganisedView = params?.folder === 'organised';

  const { currentSection, navItems } = useMemo(() => {
    // Find which section we're in based on the pathname
    const section = Object.entries(navigationConfig).find(([, config]) =>
      location.pathname.startsWith(config.path),
    );

    const currentSection = section?.[0] || 'mail';
    if (navigationConfig[currentSection]) {
      const items = [...navigationConfig[currentSection].sections];

      // For mail section, remove navigation items since they're now in the horizontal row
      const filteredItems = currentSection === 'mail' ? [] : items;

      return { currentSection, navItems: filteredItems };
    } else {
      return {
        currentSection: '',
        navItems: [],
      };
    }
  }, [location.pathname]);

  const showComposeButton = currentSection === 'mail' && !isOrganisedView;
  const { state } = useSidebar();

  //   const handleCreateMeet = async () => {
  //     try {
  //       const {
  //         data: { id },
  //       } = await createMeet();
  //       navigator.clipboard.writeText(`https://meet.0.email/${id}`);
  //       toast.success('Meeting linked copied to clipboard');
  //     } catch (error) {
  //       console.error(error);
  //       toast.error('Failed to create meeting');
  //     }
  //   };

  return (
    <div>
      {!isFullScreen && (
        <Sidebar
          collapsible="icon"
          {...props}
          className={`bg-sidebar dark:bg-sidebar flex h-screen select-none flex-col items-center ${state === 'collapsed' ? '' : ''} pb-2`}
        >
          <SidebarHeader
            className={`relative top-2.5 flex flex-col gap-2 ${state === 'collapsed' ? 'px-2' : 'md:px-4'}`}
          >
            {session && <NavUser />}

            {showComposeButton && (
              <div className="flex gap-1">
                <div className={cn('w-full')}>
                  <ComposeButton />
                </div>
                {/* {isPro ? (
                  <button
                    onClick={handleCreateMeet}
                    className="hover:bg-muted-foreground/10 inline-flex h-8 w-[20%] items-center justify-center gap-1 overflow-hidden rounded-lg border bg-white px-1.5 dark:border-none dark:bg-[#313131]"
                  >
                    <Video className="text-muted-foreground h-4 w-4" />
                  </button>
                ) : null} */}
              </div>
            )}
          </SidebarHeader>
          <SidebarContent
            className={`scrollbar scrollbar-w-1 scrollbar-thumb-accent/40 scrollbar-track-transparent hover:scrollbar-thumb-accent scrollbar-thumb-rounded-full overflow-x-hidden py-0 pt-0 ${state !== 'collapsed' ? (isOrganisedView ? 'mt-5' : 'mt-5 md:px-4') : 'px-2'}`}
          >
            {isOrganisedView && state !== 'collapsed' ? (
              <div className="flex-1 px-4 py-0">
                <CustomerCompanyPanel email={organisedEmail || null} />
              </div>
            ) : (
              <div className="flex-1 py-0">
                <NavMain items={navItems} />
              </div>
            )}
          </SidebarContent>

          <SidebarFooter className={`px-0 pb-0 ${state === 'collapsed' ? 'md:px-2' : 'md:px-4'}`}>
            {!isOrganisedView || state === 'collapsed' ? <NavMain items={bottomNavItems} /> : null}
          </SidebarFooter>
        </Sidebar>
      )}
    </div>
  );
}

function ComposeButton() {
  const { state } = useSidebar();
  const isMobile = useIsMobile();

  const [dialogOpen, setDialogOpen] = useQueryState('isComposeOpen');
  const [, setDraftId] = useQueryState('draftId');
  const [, setTo] = useQueryState('to');
  const [, setActiveReplyId] = useQueryState('activeReplyId');
  const [, setMode] = useQueryState('mode');

  const handleOpenChange = async (open: boolean) => {
    if (!open) {
      setDialogOpen(null);
    } else {
      setDialogOpen('true');
    }
    setDraftId(null);
    setTo(null);
    setActiveReplyId(null);
    setMode(null);
  };
  return (
    <Dialog open={!!dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTitle></DialogTitle>
      <DialogDescription></DialogDescription>

      <DialogTrigger asChild>
        <button
          type="button"
          className="relative mb-1.5 inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1 self-stretch overflow-hidden rounded-lg border border-gray-200 bg-[#006FFE] text-black transition-colors hover:bg-[#0056CC] dark:border-none dark:text-white dark:hover:bg-[#0056CC]"
        >
          {state === 'collapsed' && !isMobile ? (
            <PencilCompose className="mt-0.5 fill-white text-black" />
          ) : (
            <div className="flex items-center justify-center gap-2.5 pl-0.5 pr-1">
              <PencilCompose className="fill-white" />
              <div className="justify-start text-sm leading-none text-white">
                {m['common.commandPalette.commands.newEmail']()}
              </div>
            </div>
          )}
        </button>
      </DialogTrigger>

      <DialogContent className="h-screen w-screen max-w-none border-none bg-[#FAFAFA] p-0 shadow-none dark:bg-[#141414]">
        <CreateEmail />
      </DialogContent>
    </Dialog>
  );
}
