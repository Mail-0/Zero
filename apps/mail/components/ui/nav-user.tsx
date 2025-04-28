'use client';

import {
  BrainCircuitIcon,
  ChevronDown,
  HelpCircle,
  LogIn,
  LogOut,
  MoonIcon,
  Settings,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useConnections } from '@/hooks/use-connections';
import { signOut, useSession } from '@/lib/auth-client';
import { AddConnectionDialog } from '../connection/add';
import { putConnection } from '@/actions/connections';
import { useSettings } from '@/hooks/use-settings';
import { dexieStorageProvider } from '@/lib/idb';
import { SunIcon } from '../icons/animated/sun';
import { EnableBrain } from '@/actions/brain';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type IConnection } from '@/types';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';

export function NavUser() {
  const { data: session, refetch } = useSession();
  const router = useRouter();
  const { data: connections, isLoading, mutate } = useConnections();
  const [isRendered, setIsRendered] = useState(false);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const t = useTranslations();
  const { settings, isLoading: isSettingsLoading } = useSettings();

  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getSettingsHref = useCallback(() => {
    // Get the current category parameter if it exists
    const category = searchParams.get('category');

    // Construct the current path with category if present
    const currentPath = category
      ? `${pathname}?category=${encodeURIComponent(category)}`
      : pathname;

    // Return settings URL with the current path as 'from' parameter
    return `/settings/general?from=${encodeURIComponent(currentPath)}`;
  }, [pathname, searchParams]);

  const handleClearCache = useCallback(async () => {
    dexieStorageProvider().clear();
    toast.success('Cache cleared successfully');
  }, []);

  const handleEnableBrain = useCallback(async () => {
    // This takes too long, not waiting
    const enabled = await EnableBrain({});
    if (enabled) toast.success('Brain enabled successfully');
  }, []);

  const activeAccount = useMemo(() => {
    if (!session) return null;
    return connections?.find((connection) => connection.id === session?.connectionId);
  }, [session, connections]);

  // Prevents hydration error
  useEffect(() => setIsRendered(true), []);

  async function handleThemeToggle() {
    const newTheme = theme === 'dark' ? 'light' : 'dark';

    function update() {
      setTheme(newTheme);
    }

    if (document.startViewTransition && newTheme !== resolvedTheme) {
      document.documentElement.style.viewTransitionName = 'theme-transition';
      await document.startViewTransition(update).finished;
      document.documentElement.style.viewTransitionName = '';
    } else {
      update();
    }
  }

  if (!isRendered) return null;

  const handleAccountSwitch = (connection: IConnection) => async () => {
    await putConnection(connection.id);
    refetch();
    mutate();
  };

  const handleLogout = async () => {
    toast.promise(
      signOut().then(() => router.push('/login')),
      {
        loading: 'Signing out...',
        success: () => 'Signed out successfully!',
        error: 'Error signing out',
      },
    );
  };

  return (
    <DropdownMenu>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:text-sidebar-accent-foreground group mt-2 h-[32px] bg-transparent px-0 hover:bg-transparent"
            >
              {isLoading || isSettingsLoading ? (
                <>
                  <div className="bg-primary/10 size-8 animate-pulse rounded-lg" />
                </>
              ) : (
                <>
                  <Avatar
                    className={cn(
                      'size-[32px] rounded-lg',
                      settings?.hidePersonalInformation && 'blur-lg',
                    )}
                  >
                    <AvatarImage
                      className="rounded-lg"
                      src={
                        (activeAccount?.picture ?? undefined) || (session?.user.image ?? undefined)
                      }
                      alt={activeAccount?.name || session?.user.name || 'User'}
                    />
                    <AvatarFallback className="relative overflow-hidden rounded-lg">
                      <div className="absolute inset-0" />
                      {!isSettingsLoading && !settings?.hidePersonalInformation ? (
                        <span className="relative z-10">
                          {(activeAccount?.name || session?.user.name || 'User')
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)}
                        </span>
                      ) : (
                        <span className="relative z-10">??</span>
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col gap-0.5 leading-none">
                    {isSettingsLoading ? (
                      <>
                        <div className="h-[14px] w-full animate-pulse rounded-lg"></div>
                        <div className="h-[11px] w-full animate-pulse rounded-lg"></div>
                      </>
                    ) : (
                      <>
                        <span
                          className={cn(
                            'truncate font-medium tracking-tight',
                            settings?.hidePersonalInformation && 'blur-[6px]',
                          )}
                        >
                          {activeAccount?.name || session?.user.name || 'User'}
                        </span>
                        <span
                          className={cn(
                            'text-muted-foreground/70 truncate text-[11px]',
                            settings?.hidePersonalInformation && 'blur-[6px]',
                          )}
                        >
                          {activeAccount?.email || session?.user.email}
                        </span>{' '}
                      </>
                    )}
                  </div>
                  <ChevronDown className="ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </>
              )}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
        </SidebarMenuItem>
      </SidebarMenu>
      <DropdownMenuContent
        className="ml-3 w-[--radix-dropdown-menu-trigger-width] min-w-56 font-medium"
        align="end"
        side={'bottom'}
        sideOffset={8}
      >
        {session && activeAccount && (
          <>
            <div className="flex flex-col items-center p-3 text-center">
              {isSettingsLoading ? (
                <>
                  <div className="size-14 animate-pulse rounded-xl"></div>
                </>
              ) : (
                <Avatar className="border-border/50 mb-2 size-14 rounded-xl border">
                  <AvatarImage
                    className="rounded-xl"
                    src={
                      (activeAccount?.picture ?? undefined) || (session?.user.image ?? undefined)
                    }
                    alt={activeAccount?.name || session?.user.name || 'User'}
                  />
                  <AvatarFallback className="rounded-xl">
                    {!isSettingsLoading && !settings?.hidePersonalInformation ? (
                      <span>
                        {(activeAccount?.name || session?.user.name || 'User')
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </span>
                    ) : (
                      <span>??</span>
                    )}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="w-full">
                {isSettingsLoading ? (
                  <>
                    <div className="h-5 w-full animate-pulse rounded-lg"></div>
                    <div className="h-4 w-full animate-pulse rounded-lg"></div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-medium">
                      {activeAccount?.name || session?.user.name || 'User'}
                    </div>
                    <div className="text-muted-foreground text-xs">{activeAccount.email}</div>
                  </>
                )}
              </div>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <div className="space-y-1">
          {session ? (
            <>
              <p className="text-muted-foreground px-2 py-1 text-[11px] font-medium">
                {t('common.navUser.accounts')}
              </p>

              {connections
                ?.filter((connection) => connection.id !== session?.connectionId)
                .map((connection) => (
                  <DropdownMenuItem
                    key={connection.id}
                    onClick={handleAccountSwitch(connection)}
                    className="flex cursor-pointer items-center gap-3 py-1"
                  >
                    <Avatar className="size-7 rounded-lg">
                      <AvatarImage
                        className="rounded-lg"
                        src={connection.picture || undefined}
                        alt={connection.name || connection.email}
                      />
                      <AvatarFallback className="rounded-lg text-[10px]">
                        {!isSettingsLoading && !settings?.hidePersonalInformation ? (
                          <>
                            {(connection.name || connection.email)
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </>
                        ) : (
                          <>??</>
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="-space-y-0.5">
                      <p
                        className={cn(
                          'text-[12px]',
                          settings?.hidePersonalInformation && 'blur-[6px]',
                        )}
                      >
                        {connection.name || connection.email}
                      </p>
                      {connection.name && (
                        <p
                          className={cn(
                            'text-muted-foreground text-[11px]',
                            settings?.hidePersonalInformation && 'blur-[6px]',
                          )}
                        >
                          {connection.email.length > 25
                            ? `${connection.email.slice(0, 25)}...`
                            : connection.email}
                        </p>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              <AddConnectionDialog />

              <DropdownMenuSeparator className="my-1" />

              <DropdownMenuItem onClick={handleThemeToggle} className="cursor-pointer">
                <div className="flex w-full items-center gap-2">
                  {theme === 'dark' ? (
                    <MoonIcon className="size-4 opacity-60" />
                  ) : (
                    <SunIcon className="size-4 opacity-60" />
                  )}
                  <p className="text-[13px] opacity-60">{t('common.navUser.appTheme')}</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={getSettingsHref()} className="cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Settings size={16} className="opacity-60" />
                    <p className="text-[13px] opacity-60">{t('common.actions.settings')}</p>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <a href="https://discord.gg/0email" target="_blank" className="w-full">
                  <div className="flex items-center gap-2">
                    <HelpCircle size={16} className="opacity-60" />
                    <p className="text-[13px] opacity-60">{t('common.navUser.customerSupport')}</p>
                  </div>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={handleLogout}>
                <div className="flex items-center gap-2">
                  <LogOut size={16} className="opacity-60" />
                  <p className="text-[13px] opacity-60">{t('common.actions.logout')}</p>
                </div>
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem className="cursor-pointer" onClick={() => router.push('/login')}>
                <LogIn size={16} className="mr-2 opacity-60" />
                <p className="text-[13px] opacity-60">{t('common.navUser.signIn')}</p>
              </DropdownMenuItem>
            </>
          )}
        </div>

        {session && (
          <>
            <DropdownMenuSeparator className="mt-1" />
            <div className="text-muted-foreground/60 flex items-center justify-center gap-1 px-2 pb-2 pt-1 text-[10px]">
              <a href="/privacy" className="hover:underline">
                Privacy
              </a>
              <span>·</span>
              <a href="/terms" className="hover:underline">
                Terms
              </a>
            </div>
            <DropdownMenuSeparator className="mt-1" />
            <p className="text-muted-foreground px-2 py-1 text-[11px] font-medium">Debug</p>
            <DropdownMenuItem onClick={handleClearCache}>
              <div className="flex items-center gap-2">
                <HelpCircle size={16} className="opacity-60" />
                <p className="text-[13px] opacity-60">Clear Local Cache</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleEnableBrain}>
              <div className="flex items-center gap-2">
                <BrainCircuitIcon size={16} className="opacity-60" />
                <p className="text-[13px] opacity-60">Enable Brain</p>
              </div>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
