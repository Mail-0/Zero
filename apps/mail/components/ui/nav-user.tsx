"use client";

import {
  Book,
  ChevronDown,
  HelpCircle,
  LogIn,
  LogOut,
  MoonIcon,
  Settings2Icon,
  UserPlus,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { SettingsGearIcon } from "../icons/animated/settings-gear";
import { useConnections } from "@/hooks/use-connections";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";
import { AddConnectionDialog } from "../connection/add";
import { putConnection } from "@/actions/connections";
import { useEffect, useMemo, useState } from "react";
import { SunIcon } from "../icons/animated/sun";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { IConnection } from "@/types";
import { Button } from "./button";
import { toast } from "sonner";
import Link from "next/link";
import axios from "axios";

export function NavUser() {
  const { data: session, refetch } = useSession();
  const router = useRouter();
  const { data: connections, isLoading, mutate } = useConnections();
  const pathname = usePathname();
  const [isRendered, setIsRendered] = useState(false);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const t = useTranslations();

  const activeAccount = useMemo(() => {
    if (!session) return null;
    return connections?.find((connection) => connection.id === session?.connectionId);
  }, [session, connections]);

  // Prevents hydration error
  useEffect(() => setIsRendered(true), []);

  async function handleThemeToggle() {
    const newTheme = theme === "dark" ? "light" : "dark";

    function update() {
      setTheme(newTheme);
    }

    if (document.startViewTransition && newTheme !== resolvedTheme) {
      document.documentElement.style.viewTransitionName = "theme-transition";
      await document.startViewTransition(update).finished;
      document.documentElement.style.viewTransitionName = "";
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
    toast.promise(signOut(), {
      loading: "Signing out...",
      success: () => "Signed out successfully!",
      error: "Error signing out",
    });
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
              {isLoading ? (
                <>
                  <div className="bg-primary/10 size-8 animate-pulse rounded-lg" />
                </>
              ) : (
                <>
                  <Avatar className="size-[32px] rounded-lg">
                    <AvatarImage
                      className="rounded-lg"
                      src={
                        (activeAccount?.picture ?? undefined) || (session?.user.image ?? undefined)
                      }
                      alt={activeAccount?.name || session?.user.name || "User"}
                    />
                    <AvatarFallback className="relative overflow-hidden rounded-lg">
                      <div className="absolute inset-0" />
                      <span className="relative z-10">
                        {(activeAccount?.name || session?.user.name || "User")
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </span>
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col gap-0.5 leading-none">
                    <span className="truncate font-medium tracking-tight">
                      {activeAccount?.name || session?.user.name || "User"}
                    </span>
                    <span className="text-muted-foreground/70 truncate text-[11px]">
                      {activeAccount?.email || session?.user.email}
                    </span>
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
        side={"bottom"}
        sideOffset={8}
      >
        <DropdownMenuItem onClick={() => router.push("/support")}>
          <div className="flex cursor-pointer items-center gap-2 text-[13px]">
            <HelpCircle size={16} strokeWidth={2} className="opacity-60" aria-hidden="true" />
            <p className="text-[13px] opacity-60">{t("common.navUser.customerSupport")}</p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="https://github.com/Mail-0/Zero" target="_blank">
            <div className="flex cursor-pointer items-center gap-2 text-[13px]">
              <Book size={16} strokeWidth={2} className="opacity-60" aria-hidden="true" />
              <p className="text-[13px] opacity-60">{t("common.navUser.documentation")}</p>
            </div>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleThemeToggle}>
          <div className="flex cursor-pointer items-center gap-2 text-[13px]">
            {theme === "dark" ? (
              <MoonIcon className="opacity-60" />
            ) : (
              <SunIcon className="opacity-60" />
            )}
            <p className="text-[13px] opacity-60">{t("common.navUser.appTheme")}</p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="space-y-1">
          {session ? (
            <>
              <p className="text-muted-foreground px-1 py-0.5 text-[11px]">
                {t("common.navUser.accounts")}
              </p>

              {connections?.map((connection) => (
                <DropdownMenuItem
                  key={connection.id}
                  onClick={handleAccountSwitch(connection)}
                  className={`flex cursor-pointer items-center gap-3 py-0.5 ${
                    connection.id === session?.connectionId ? "bg-accent" : ""
                  }`}
                >
                  <Avatar className="size-7 rounded-lg">
                    <AvatarImage
                      className="rounded-lg"
                      src={connection.picture || undefined}
                      alt={connection.name || connection.email}
                    />
                    <AvatarFallback className="rounded-lg text-[10px]">
                      {(connection.name || connection.email)
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="-space-y-1">
                    <p className="text-[12px]">{connection.name || connection.email}</p>
                    {connection.name && (
                      <p className="text-muted-foreground text-[12px]">
                        {connection.email.length > 25
                          ? `${connection.email.slice(0, 25)}...`
                          : connection.email}
                      </p>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
              <AddConnectionDialog />
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-muted-foreground cursor-pointer"
                onClick={handleLogout}
              >
                <LogOut size={16} strokeWidth={2} className="mr-1" aria-hidden="true" />
                <p className="text-[13px]">{t("common.actions.logout")}</p>
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/login")}>
                <LogIn size={16} strokeWidth={2} className="opacity-60" aria-hidden="true" />
                <p className="text-[13px] opacity-60">{t("common.navUser.signIn")}</p>
              </DropdownMenuItem>
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
