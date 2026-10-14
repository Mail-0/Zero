import {
  IconTile,
  SettingsGroup,
  destructiveButton,
  destructiveIconButton,
  rowClass,
  rowDescription,
  rowTitle,
  subtleButton,
} from '@/components/settings/settings-ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ImapReconnectDialog } from '@/components/connection/imap-reconnect';
import { SettingsCard } from '@/components/settings/settings-card';
import { AddConnectionDialog } from '@/components/connection/add';

import { Trash, Plus, Unplug, Mail, Settings2 } from 'lucide-react';
import { useSession, authClient } from '@/lib/auth-client';
import { useConnections } from '@/hooks/use-connections';
import { useTRPC } from '@/providers/query-provider';
import { Skeleton } from '@/components/ui/skeleton';
import { useMutation } from '@tanstack/react-query';
import { useThreads } from '@/hooks/use-threads';
import { useBilling } from '@/hooks/use-billing';
import { emailProviders } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { m } from '@/paraglide/messages';
import { useQueryState } from 'nuqs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function ConnectionsPage() {
  const { data, isLoading, refetch: refetchConnections } = useConnections();
  const { refetch } = useSession();
  const [openTooltip, setOpenTooltip] = useState<string | null>(null);

  const trpc = useTRPC();
  const { mutateAsync: deleteConnection } = useMutation(trpc.connections.delete.mutationOptions());
  const [{ refetch: refetchThreads }] = useThreads();
  const { isPro } = useBilling();
  const [, setPricingDialog] = useQueryState('pricingDialog');
  const [imapError, setImapError] = useQueryState('imapError');
  const [imapConnected, setImapConnected] = useQueryState('imapConnected');

  // Result of the IMAP OAuth (XOAUTH2) redirect flow.
  useEffect(() => {
    if (imapConnected) {
      toast.success(m['pages.settings.connections.imap.success']());
      void setImapConnected(null);
      void refetchConnections();
    }
    if (imapError) {
      toast.error(m['pages.settings.connections.imap.oauthError']({ reason: imapError }));
      void setImapError(null);
    }
  }, [imapConnected, imapError, setImapConnected, setImapError, refetchConnections]);
  const disconnectAccount = async (connectionId: string) => {
    await deleteConnection(
      { connectionId },
      {
        onError: (error) => {
          console.error('Error disconnecting account:', error);
          toast.error(m['pages.settings.connections.disconnectError']());
        },
      },
    );
    toast.success(m['pages.settings.connections.disconnectSuccess']());
    void refetchConnections();
    refetch();
    void refetchThreads();
  };

  const addEmailButton = (onClick?: () => void) => (
    <Button variant="ghost" className={cn(subtleButton, 'gap-1.5')} onClick={onClick}>
      <Plus className="size-3.5" />
      {m['pages.settings.connections.addEmail']()}
    </Button>
  );

  return (
    <SettingsCard
      title={m['pages.settings.connections.title']()}
      description={m['pages.settings.connections.description']()}
      action={
        isPro ? (
          <AddConnectionDialog>{addEmailButton()}</AddConnectionDialog>
        ) : (
          addEmailButton(() => setPricingDialog('true'))
        )
      }
    >
      {isLoading ? (
        <SettingsGroup>
          {[0, 1, 2].map((n) => (
            <div key={n} className={rowClass}>
              <Skeleton className="size-8 rounded-lg" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </SettingsGroup>
      ) : data?.connections?.length ? (
        <SettingsGroup>
          {data.connections.map((connection) => {
            const Icon =
              emailProviders.find((p) => p.providerId === connection.providerId)?.icon ??
              (connection.providerId === 'imap' ? Mail : undefined);
            const isImap = connection.providerId === 'imap';
            const isDisconnected = data.disconnectedIds?.includes(connection.id);
            return (
              <div key={connection.id} className={rowClass}>
                {connection.picture ? (
                  <img
                    src={connection.picture}
                    alt=""
                    className="size-8 shrink-0 rounded-lg object-cover"
                    width={32}
                    height={32}
                  />
                ) : (
                  <IconTile>{Icon && <Icon />}</IconTile>
                )}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className={cn(rowTitle, 'truncate')}>{connection.name}</span>
                    {isDisconnected && (
                      <span className="rounded-md bg-[#FDE4E9] px-1.5 py-0.5 text-[11px] font-medium text-[#F43F5E] dark:bg-[#411D23]">
                        {m['pages.settings.connections.disconnected']()}
                      </span>
                    )}
                  </div>
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
                      <p
                        className={cn(rowDescription, 'cursor-default truncate')}
                        onClick={() => {
                          if (window.innerWidth <= 768) {
                            setOpenTooltip(openTooltip === connection.id ? null : connection.id);
                          }
                        }}
                      >
                        {connection.email}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="start" className="select-all">
                      <div className="font-mono">{connection.email}</div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {isImap && (
                    <ImapReconnectDialog
                      connectionId={connection.id}
                      onDone={() => void refetchConnections()}
                    >
                      <Button variant="ghost" className={cn(subtleButton, 'gap-1.5')}>
                        {isDisconnected ? (
                          <Unplug className="size-3.5" />
                        ) : (
                          <Settings2 className="size-3.5" />
                        )}
                        {isDisconnected
                          ? m['pages.settings.connections.reconnect']()
                          : m['pages.settings.connections.imap.editSettings']()}
                      </Button>
                    </ImapReconnectDialog>
                  )}
                  {isDisconnected && !isImap && (
                    <Button
                      variant="ghost"
                      className={cn(subtleButton, 'gap-1.5')}
                      onClick={async () => {
                        await authClient.linkSocial({
                          provider: connection.providerId,
                          callbackURL: `${window.location.origin}/settings/connections`,
                        });
                      }}
                    >
                      <Unplug className="size-3.5" />
                      {m['pages.settings.connections.reconnect']()}
                    </Button>
                  )}
                  <Dialog>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            className={destructiveIconButton}
                            disabled={data.connections.length === 1}
                            aria-label={m['pages.settings.connections.remove']()}
                          >
                            <Trash />
                          </Button>
                        </DialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent>{m['pages.settings.connections.remove']()}</TooltipContent>
                    </Tooltip>
                    <DialogContent showOverlay className="rounded-2xl">
                      <DialogHeader>
                        <DialogTitle className="text-[15px]">
                          {m['pages.settings.connections.disconnectTitle']()}
                        </DialogTitle>
                        <DialogDescription className="text-[13px]">
                          {m['pages.settings.connections.disconnectDescription']()}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex justify-end gap-2">
                        <DialogClose asChild>
                          <Button variant="ghost" className={subtleButton}>
                            {m['pages.settings.connections.cancel']()}
                          </Button>
                        </DialogClose>
                        <DialogClose asChild>
                          <Button
                            variant="ghost"
                            className={destructiveButton}
                            onClick={() => disconnectAccount(connection.id)}
                          >
                            {m['pages.settings.connections.remove']()}
                          </Button>
                        </DialogClose>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            );
          })}
        </SettingsGroup>
      ) : null}
    </SettingsCard>
  );
}
