"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SettingsCard } from "@/components/settings/settings-card";
import { emailProviders } from "@/constants/emailProviders";
import { useConnections } from "@/hooks/use-connections";
import { deleteConnection } from "@/actions/connections";
import { AddConnectionDialog } from "@/components/connection/add";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { Trash } from "lucide-react";
import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";

export default function ConnectionsPage() {
  const { refetch } = useSession();
  const { data: connections, mutate, isLoading } = useConnections();
  const [openTooltip, setOpenTooltip] = useState<string | null>(null);

  const disconnectAccount = async (connectionId: string) => {
    try {
      await deleteConnection(connectionId);
      toast.success("Account disconnected successfully");
      mutate();
      refetch();
    } catch (error) {
      console.error("Error disconnecting account:", error);
      toast.error("Failed to disconnect account");
    }
  };

  return (
    <div className="grid gap-6">
      <SettingsCard title="Email Connections" description="Connect your email accounts to Zero.">
        <div className="space-y-6">
          {isLoading ? (
            <div className="grid md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border p-4 bg-popover"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <div className="flex-col gap-1 flex">
                      <Skeleton className="h-4 w-full lg:w-32" />
                      <Skeleton className="h-3 w-full lg:w-48" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-8 rounded-full ml-4" />
                </div>
              ))}
            </div>
          ) : connections?.length ? (
            <div className="grid md:grid-cols-3 gap-4">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between rounded-lg border p-4 bg-popover"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    {connection.picture ? (
                      <Image
                        src={connection.picture}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                        width={48}
                        height={48}
                      />
                    ) : (
                      <div className="bg-primary/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg">
                        <svg viewBox="0 0 24 24" className="text-primary h-6 w-6">
                            <path fill="currentColor" d={emailProviders[0]!.icon} />
                        </svg>
                      </div>
                    )}
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="truncate text-sm font-medium">{connection.name}</span>
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        <Tooltip
                          delayDuration={0}
                          open={openTooltip === connection.id}
                          onOpenChange={(open) => {
                            if (window.innerWidth <= 768) {
                              setOpenTooltip(open ? connection.id : null);
                            }
                          }}
                        >
                          <TooltipTrigger asChild>
                            <span
                              className="max-w-[180px] cursor-default truncate sm:max-w-[240px] md:max-w-[300px]"
                              onClick={() => {
                                if (window.innerWidth <= 768) {
                                  setOpenTooltip(
                                    openTooltip === connection.id ? null : connection.id,
                                  );
                                }
                              }}
                            >
                              {connection.email}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" align="start" className="select-all">
                            <div className="font-mono">{connection.email}</div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-primary shrink-0 ml-4"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Disconnect Email Account</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to disconnect this email?
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex justify-end gap-4">
                        <DialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <DialogClose asChild>
                          <Button onClick={() => disconnectAccount(connection.id)}>Remove</Button>
                        </DialogClose>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              ))}
            </div>
          ) : null}

          <AddConnectionDialog className="w-fit hover:bg-transparent">

          </AddConnectionDialog>
        </div>
      </SettingsCard>
    </div>
  );
}
