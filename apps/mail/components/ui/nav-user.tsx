'use client';

import {
  HelpCircle,
  LogIn,
  LogOut,
  MoonIcon,
  Settings,
  Plus,
  ChevronDown,
  BrainCircuitIcon,
  BrainIcon,
  CopyCheckIcon,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CircleCheck, ThreeDots } from '../icons/icons';
import { SunIcon } from '../icons/animated/sun';
import Link from 'next/link';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { DisableBrain, EnableBrain } from '@/actions/brain';
import { useConnections } from '@/hooks/use-connections';
import { signOut, useSession } from '@/lib/auth-client';
import { AddConnectionDialog } from '../connection/add';
import { putConnection } from '@/actions/connections';
import { useSidebar } from '@/components/ui/sidebar';
import { useBrainState } from '@/hooks/use-summary';
import { dexieStorageProvider } from '@/lib/idb';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type IConnection } from '@/types';
import { useTheme } from 'next-themes';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function NavUser() {
  const { data: session, refetch } = useSession();
  const router = useRouter();
  const { data: connections, isLoading, mutate } = useConnections();
  const [isRendered, setIsRendered] = useState(false);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const t = useTranslations();
  const { state } = useSidebar();

  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getSettingsHref = useCallback(() => {
    const category = searchParams.get('category');
    const currentPath = category
      ? `${pathname}?category=${encodeURIComponent(category)}`
      : pathname;
    return `/settings/general?from=${encodeURIComponent(currentPath)}`;
  }, [pathname, searchParams]);

  const handleClearCache = useCallback(async () => {
    dexieStorageProvider().clear();
    toast.success('Cache cleared successfully');
  }, []);

  const handleCopyConnectionId = useCallback(async () => {
    await navigator.clipboard.writeText(session?.connectionId || '');
    toast.success('Connection ID copied to clipboard');
  }, [session]);

  const handleEnableBrain = useCallback(async () => {
    // This takes too long, not waiting
    const enabled = await EnableBrain({});
    if (enabled) toast.success('Brain enabled successfully');
  }, []);

  const handleDisableBrain = useCallback(async () => {
    // This takes too long, not waiting
    const enabled = await DisableBrain({});
    if (enabled) toast.success('Brain disabled');
  }, []);

  const activeAccount = useMemo(() => {
    if (!session) return null;
    return connections?.find((connection) => connection.id === session?.connectionId);
  }, [session, connections]);

  useEffect(() => setIsRendered(true), []);

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

  const { data: brainState } = useBrainState();

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (!isRendered) return null;
  if (!session) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {state === 'collapsed' ? (
          activeAccount && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex cursor-pointer items-center">
                  <div className="relative">
                    <Avatar className="size-8 rounded-[5px]">
                      <AvatarImage
                        className="rounded-[5px]"
                        src={activeAccount?.picture || undefined}
                        alt={activeAccount?.name || activeAccount?.email}
                      />
                      <AvatarFallback className="rounded-[5px] text-[10px]">
                        {(activeAccount?.name || activeAccount?.email)
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="ml-3 w-[--radix-dropdown-menu-trigger-width] min-w-56 bg-white font-medium dark:bg-[#131313]"
                align="end"
                side={'bottom'}
                sideOffset={8}
              >
                {session && activeAccount && (
                  <>
                    <div className="flex flex-col items-center p-3 text-center">
                      <Avatar className="border-border/50 mb-2 size-14 rounded-xl border">
                        <AvatarImage
                          className="rounded-xl"
                          src={
                            (activeAccount.picture ?? undefined) ||
                            (session.user.image ?? undefined)
                          }
                          alt={activeAccount.name || session.user.name || 'User'}
                        />
                        <AvatarFallback className="rounded-xl">
                          <span>
                            {(activeAccount.name || session.user.name || 'User')
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </span>
                        </AvatarFallback>
                      </Avatar>
                      <div className="w-full">
                        <div className="text-sm font-medium">
                          {activeAccount.name || session.user.name || 'User'}
                        </div>
                        <div className="text-muted-foreground text-xs">{activeAccount.email}</div>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}
                <div className="space-y-1">
                  <>
                    <p className="text-muted-foreground px-2 py-1 text-[11px] font-medium">
                      {t('common.navUser.accounts')}
                    </p>

                    {connections
                      ?.filter((connection) => connection.id !== session.connectionId)
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
                              {(connection.name || connection.email)
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .toUpperCase()
                                .slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="-space-y-0.5">
                            <p className="text-[12px]">{connection.name || connection.email}</p>
                            {connection.name && (
                              <p className="text-muted-foreground text-[11px]">
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
                          <p className="text-[13px] opacity-60">
                            {t('common.navUser.customerSupport')}
                          </p>
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
                </div>
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
                </>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        ) : (
          <div className="mt-0. flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              {connections?.map((connection) => (
                <div
                  key={connection.id}
                  onClick={handleAccountSwitch(connection)}
                  className={`flex cursor-pointer items-center ${
                    connection.id === session.connectionId && connections.length > 1
                      ? 'outline-mainBlue rounded-[5px] outline outline-2'
                      : ''
                  }`}
                >
                  <div className="relative">
                    <Avatar className="size-7 rounded-[5px]">
                      <AvatarImage
                        className="rounded-[5px]"
                        src={connection.picture || undefined}
                        alt={connection.name || connection.email}
                      />
                      <AvatarFallback className="rounded-[5px] text-[10px]">
                        {(connection.name || connection.email)
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    {connection.id === session.connectionId && connections.length > 1 && (
                      <CircleCheck className="fill-mainBlue absolute -bottom-2 -right-2 size-4 rounded-full bg-white dark:bg-black" />
                    )}
                  </div>
                </div>
              ))}

              <AddConnectionDialog>
                <button className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[5px] border border-dashed dark:bg-[#262626] dark:text-[#929292]">
                  <Plus className="size-4" />
                </button>
              </AddConnectionDialog>
            </div>
            <div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className={cn('md:h-fit md:px-2')}>
                    <ThreeDots className="fill-iconLight dark:fill-iconDark" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="ml-3 min-w-56 bg-white font-medium dark:bg-[#131313]"
                  align="end"
                  side={'bottom'}
                  sideOffset={8}
                >
                  <div className="space-y-1">
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
                          <p className="text-[13px] opacity-60">
                            {t('common.navUser.customerSupport')}
                          </p>
                        </div>
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer" onClick={handleLogout}>
                      <div className="flex items-center gap-2">
                        <LogOut size={16} className="opacity-60" />
                        <p className="text-[13px] opacity-60">{t('common.actions.logout')}</p>
                      </div>
                    </DropdownMenuItem>
                  </div>

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
                  <DropdownMenuItem onClick={handleCopyConnectionId}>
                    <div className="flex items-center gap-2">
                      <CopyCheckIcon size={16} className="opacity-60" />
                      <p className="text-[13px] opacity-60">Copy Connection ID</p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleClearCache}>
                    <div className="flex items-center gap-2">
                      <HelpCircle size={16} className="opacity-60" />
                      <p className="text-[13px] opacity-60">Clear Local Cache</p>
                    </div>
                  </DropdownMenuItem>
                  {!brainState?.enabled ? (
                    <DropdownMenuItem onClick={handleEnableBrain}>
                      <div className="flex items-center gap-2">
                        <BrainIcon size={16} className="opacity-60" />
                        <p className="text-[13px] opacity-60">Enable Brain Activity</p>
                      </div>
                    </DropdownMenuItem>
                  ) : null}
                  {brainState?.enabled ? (
                    <DropdownMenuItem onClick={handleDisableBrain}>
                      <div className="flex items-center gap-2">
                        <BrainIcon size={16} className="opacity-60" />
                        <p className="text-[13px] opacity-60">Disable Brain Activity</p>
                      </div>
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      </div>
      {state !== 'collapsed' && (
        <div className="my-2 flex flex-col items-start gap-1 space-y-1">
          <div className="text-[13px] leading-none text-black dark:text-white">
            {activeAccount?.name || session.user.name || 'User'}
          </div>
          <div
            title={activeAccount?.email || session.user.email}
            className="line-clamp-1 break-all text-xs font-normal leading-none text-[#898989]"
          >
            {activeAccount?.email || session.user.email}
          </div>
        </div>
      )}
    </div>
  );
}
