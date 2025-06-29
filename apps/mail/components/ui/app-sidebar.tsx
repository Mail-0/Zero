import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
} from '@/components/ui/sidebar';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { SquarePenIcon, type SquarePenIconHandle } from '../icons/animated/square-pen';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from './input-otp';
import { navigationConfig, bottomNavItems } from '@/config/navigation';
import { useSession, authClient } from '@/lib/auth-client';
import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSidebar } from '@/components/ui/sidebar';
import { CreateEmail } from '../create/create-email';
import { PencilCompose, X } from '../icons/icons';
import { useBilling } from '@/hooks/use-billing';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { useAIFullScreen } from './ai-sidebar';
import { useStats } from '@/hooks/use-stats';
import { useLocation } from 'react-router';
import { useForm } from 'react-hook-form';
import { m } from '@/paraglide/messages';
import { FOLDERS } from '@/lib/utils';
import { NavUser } from './nav-user';
import { NavMain } from './nav-main';
import { useQueryState } from 'nuqs';
import { Input } from './input';
import { toast } from 'sonner';
import { z } from 'zod';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { isPro, isLoading } = useBilling();
  const [showUpgrade, setShowUpgrade] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hideUpgradeCard') !== 'true';
    }
    return true;
  });
  const [, setPricingDialog] = useQueryState('pricingDialog');

  const { isFullScreen } = useAIFullScreen();

  const { data: stats } = useStats();

  const location = useLocation();
  const { data: session, isPending: isSessionPending } = useSession();
  const { currentSection, navItems } = useMemo(() => {
    // Find which section we're in based on the pathname
    const section = Object.entries(navigationConfig).find(([, config]) =>
      location.pathname.startsWith(config.path),
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
  }, [location.pathname, stats]);

  const showComposeButton = currentSection === 'mail';
  const { state } = useSidebar();

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
              <div>
                <ComposeButton />
              </div>
            )}
          </SidebarHeader>
          <SidebarContent
            className={`scrollbar scrollbar-w-1 scrollbar-thumb-accent/40 scrollbar-track-transparent hover:scrollbar-thumb-accent scrollbar-thumb-rounded-full overflow-x-hidden py-0 pt-0 ${state !== 'collapsed' ? 'mt-5 md:px-4' : 'px-2'}`}
          >
            <div className="flex-1 py-0">
              <NavMain items={navItems} />
            </div>
          </SidebarContent>

          {!isLoading && !isPro && showUpgrade && state !== 'collapsed' && (
            <div className="relative top-3 mx-3 mb-4 rounded-lg border bg-white px-4 py-4 backdrop-blur-sm dark:bg-[#1C1C1C]">
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 h-6 w-6 rounded-full hover:bg-white/10 [&>svg]:h-2.5 [&>svg]:w-2.5"
                onClick={() => {
                  setShowUpgrade(false);
                  localStorage.setItem('hideUpgradeCard', 'true');
                }}
              >
                <X className="h-2.5 w-2.5 fill-black dark:fill-white/50" />
              </Button>
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-black dark:text-white/90">
                      Get Zero Pro
                    </h3>
                  </div>
                  <p className="text-[13px] leading-snug text-black dark:text-white/50">
                    Get unlimited AI chats, auto-labeling, writing assistant, and more.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPricingDialog('true')}
                className="mt-3 inline-flex h-7 w-full items-center justify-center gap-0.5 overflow-hidden rounded-lg bg-[#8B5CF6] px-2"
              >
                <div className="flex items-center justify-center gap-2.5 px-0.5">
                  <div className="justify-start text-sm leading-none text-white">
                    Start 7 day free trial
                  </div>
                </div>
              </button>
            </div>
          )}

          <SidebarFooter className={`px-0 pb-0 ${state === 'collapsed' ? 'md:px-2' : 'md:px-4'}`}>
            <NavMain items={bottomNavItems} />
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
      await setDialogOpen(null);
    } else {
      await setDialogOpen('true');
    }
    await Promise.all([setDraftId(null), setTo(null), setActiveReplyId(null), setMode(null)]);
  };
  return (
    <Dialog open={!!dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTitle></DialogTitle>
      <DialogDescription></DialogDescription>

      <DialogTrigger asChild>
        <button className="relative mb-1.5 inline-flex h-8 w-full items-center justify-center gap-1 self-stretch overflow-hidden rounded-lg border border-gray-200 bg-white text-black dark:border-none dark:bg-[#2C2C2C] dark:text-white">
          {state === 'collapsed' && !isMobile ? (
            <PencilCompose className="fill-iconLight dark:fill-iconDark mt-0.5 text-black" />
          ) : (
            <div className="flex items-center justify-center gap-2.5 pl-0.5 pr-1">
              <PencilCompose className="fill-iconLight dark:fill-iconDark" />
              <div className="justify-start text-sm leading-none">
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
