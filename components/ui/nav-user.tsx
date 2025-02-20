"use client";

import { Book, ChevronDown, HelpCircle, LogIn, LogOut, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { useConnections } from "@/hooks/use-connections";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";
import { IConnection } from "@/types";
import { useMemo } from "react";
import { toast } from "sonner";
import axios from "axios";

export function NavUser() {
  const { data: session, refetch } = useSession();
  const router = useRouter();
  const { data: connections, isLoading, mutate } = useConnections();
  const pathname = usePathname();

  const activeAccount = useMemo(() => {
    if (!session) return null;
    return connections?.find((connection) => connection.id === session?.connectionId);
  }, [session, connections]);

  const handleAccountSwitch = (connection: IConnection) => () => {
    return axios
      .put(`/api/v1/mail/connections/${connection.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      })
      .then(refetch)
      .then(() => mutate())
      .catch((err) => {
        toast.error("Error switching connection", {
          description: err.response.data.message,
        });
      });
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
              className="group mt-2 h-[32px] bg-transparent px-0 hover:bg-transparent data-[state=open]:text-sidebar-accent-foreground"
            >
              {isLoading ? (
                <>
                  <div className="size-8 animate-pulse rounded-lg bg-primary/10" />
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
                    <AvatarFallback className="rounded-lg">
                      {(activeAccount?.name || session?.user.name || "User")
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col gap-0.5 leading-none">
                    <span className="truncate font-medium tracking-tight">
                      {activeAccount?.name || session?.user.name || "User"}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground/70">
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
            <p className="text-[13px] opacity-60">Customer Support</p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => window.open("https://github.com/nizzyabi/mail0", "_blank")}
        >
          <div className="flex cursor-pointer items-center gap-2 text-[13px]">
            <Book size={16} strokeWidth={2} className="opacity-60" aria-hidden="true" />
            <p className="text-[13px] opacity-60">Documentation</p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="space-y-1">
          {session ? (
            <>
              <div className="px-1 py-1.5 text-[11px] text-muted-foreground">Accounts</div>
              {connections?.map((connection) => (
                <DropdownMenuItem
                  key={connection.id}
                  onClick={handleAccountSwitch(connection)}
                  className={`flex cursor-pointer items-center gap-4 py-0.5 ${
                    connection.id === session?.connectionId ? "bg-accent" : ""
                  }`}
                >
                  <Avatar className="size-5 rounded-lg">
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
                      <p className="text-[12px] text-muted-foreground">
                        {connection.email.length > 25
                          ? `${connection.email.slice(0, 25)}...`
                          : connection.email}
                      </p>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem
                className="mt-1 cursor-pointer"
                onClick={() => router.push(`/settings/connections?from=${pathname}`)}
              >
                <div className="flex items-center gap-2">
                  <UserPlus size={16} strokeWidth={2} className="opacity-60" aria-hidden="true" />
                  <p className="text-[13px] opacity-60">Add email</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" onClick={handleLogout}>
                <LogOut size={16} strokeWidth={2} className="mr-1 opacity-60" aria-hidden="true" />
                <p className="text-[13px] opacity-60">Log out</p>
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/login")}>
                <LogIn size={16} strokeWidth={2} className="opacity-60" aria-hidden="true" />
                <p className="text-[13px] opacity-60">Sign in</p>
              </DropdownMenuItem>
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
