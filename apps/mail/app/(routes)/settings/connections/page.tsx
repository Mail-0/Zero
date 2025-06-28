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
import { SettingsCard } from '@/components/settings/settings-card';
import { ThemeSelector } from '@/components/theme/theme-selector';
import { AddConnectionDialog } from '@/components/connection/add';
import { PricingDialog } from '@/components/ui/pricing-dialog';
import { useSession, authClient } from '@/lib/auth-client';
import { useConnections } from '@/hooks/use-connections';
import { useTRPC } from '@/providers/query-provider';
import { Skeleton } from '@/components/ui/skeleton';
import { useMutation } from '@tanstack/react-query';
import { Trash, Plus, Unplug } from 'lucide-react';
import { useThreads } from '@/hooks/use-threads';
import { useBilling } from '@/hooks/use-billing';
import { emailProviders } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'use-intl';
import { useQueryState } from 'nuqs';
import { useState } from 'react';
import { toast } from 'sonner';

export default function ConnectionsPage() {
  const { data, isLoading, refetch: refetchConnections } = useConnections();
  const { refetch } = useSession();
  const [openTooltip, setOpenTooltip] = useState<string | null>(null);
  const t = useTranslations();
  const trpc = useTRPC();
  const { mutateAsync: deleteConnection } = useMutation(trpc.connections.delete.mutationOptions());
  const [{ refetch: refetchThreads }] = useThreads();
  const { isPro } = useBilling();
  const [, setPricingDialog] = useQueryState('pricingDialog');
  const disconnectAccount = async (connectionId: string) => {
    await deleteConnection(
      { connectionId },
      {
        onError: (error) => {
          console.error('Error disconnecting account:', error);
          toast.error(t('pages.settings.connections.disconnectError'));
        },
      },
    );
    toast.success(t('pages.settings.connections.disconnectSuccess'));
    void refetchConnections();
    refetch();
    void refetchThreads();
  };

  return (
    <div className="grid gap-6">
      <SettingsCard
        title={t('pages.settings.connections.title')}
        description={t('pages.settings.connections.description')}
      >
        <div className="space-y-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center p-4 rounded-lg border bg-popover"
                >
                  <div className="flex gap-4 items-center min-w-0">
                    <Skeleton className="w-12 h-12 rounded-lg" />
                    <div className="flex flex-col gap-1">
                      <Skeleton className="w-full h-4 lg:w-32" />
                      <Skeleton className="w-full h-3 lg:w-48" />
                    </div>
                  </div>
                  <Skeleton className="ml-4 w-8 h-8 rounded-full" />
                </div>
              ))}
            </div>
          ) : data?.connections?.length ? (
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:">
              {data.connections.map((connection) => {
                const Icon = emailProviders.find(
                  (p) => p.providerId === connection.providerId,
                )?.icon;
                return (
                  <div
                    key={connection.id}
                    className="flex justify-between items-center p-4 rounded-lg border bg-popover"
                  >
                    <div className="flex gap-4 items-center min-w-0">
                      {connection.picture ? (
                        <img
                          src={connection.picture}
                          alt=""
                          className="object-cover w-12 h-12 rounded-lg shrink-0"
                          width={48}
                          height={48}
                        />
                      ) : (
                        <div className="flex justify-center items-center w-12 h-12 rounded-lg bg-primary/10 shrink-0">
                          {Icon && <Icon className="size-6" />}
                        </div>
                      )}
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-sm font-medium truncate">{connection.name}</span>
                        <div className="flex gap-2 items-center text-xs text-muted-foreground">
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
                                className="cursor-default max-w-[180px] truncate sm:max-w-[240px] md:max-w-[300px]"
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
                        {/* Theme Selector */}
                        <div className="mt-2">
                          <ThemeSelector connectionId={connection.id} />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-4 items-center">
                      {data.disconnectedIds?.includes(connection.id) ? (
                        <>
                          <div>
                            <Badge variant="destructive">
                              {t('pages.settings.connections.disconnected')}
                            </Badge>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={async () => {
                              await authClient.linkSocial({
                                provider: connection.providerId,
                                callbackURL: `${window.location.origin}/settings/connections`,
                              });
                            }}
                          >
                            <Unplug className="size-4" />
                            {t('pages.settings.connections.reconnect')}
                          </Button>
                        </>
                      ) : null}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="ml-4 text-muted-foreground shrink-0 hover:text-primary"
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent showOverlay>
                          <DialogHeader>
                            <DialogTitle>
                              {t('pages.settings.connections.disconnectTitle')}
                            </DialogTitle>
                            <DialogDescription>
                              {t('pages.settings.connections.disconnectDescription')}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="flex gap-4 justify-end">
                            <DialogClose asChild>
                              <Button variant="outline">
                                {t('pages.settings.connections.cancel')}
                              </Button>
                            </DialogClose>
                            <DialogClose asChild>
                              <Button onClick={() => disconnectAccount(connection.id)}>
                                {t('pages.settings.connections.remove')}
                              </Button>
                            </DialogClose>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="flex justify-start items-center">
            {isPro ? (
              <AddConnectionDialog>
                <Button
                  variant="outline"
                  className="group relative w-9 overflow-hidden transition-all duration-200 hover:w-full sm:hover:w-[32.5%]"
                >
                  <Plus className="absolute left-2 w-4 h-4" />
                  <span className="pl-7 whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    {t('pages.settings.connections.addEmail')}
                  </span>
                </Button>
              </AddConnectionDialog>
            ) : (
              <Button
                onClick={() => setPricingDialog('true')}
                variant="outline"
                className="group relative w-9 overflow-hidden transition-all duration-200 hover:w-full sm:hover:w-[32.5%]"
              >
                <Plus className="absolute left-2 w-4 h-4" />
                <span className="pl-7 whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  {t('pages.settings.connections.addEmail')}
                </span>
              </Button>
            )}
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
