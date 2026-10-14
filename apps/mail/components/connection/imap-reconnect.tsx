import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { useTRPC } from '@/providers/query-provider';
import { useQuery } from '@tanstack/react-query';
import { ImapConnectionForm } from './imap-form';
import { Skeleton } from '../ui/skeleton';
import { m } from '@/paraglide/messages';
import { useState } from 'react';

/** Reconnect / edit dialog for an IMAP connection (prefilled with its saved settings). */
export function ImapReconnectDialog({
  connectionId,
  children,
  onDone,
}: {
  connectionId: string;
  children: React.ReactNode;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(
    trpc.connections.imap.settings.queryOptions({ connectionId }, { enabled: open }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent showOverlay>
        <DialogHeader>
          <DialogTitle>{m['pages.settings.connections.imap.reconnectTitle']()}</DialogTitle>
          <DialogDescription>{data?.email}</DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : data.authMethod === 'xoauth2' && data.oauthProvider ? (
          <a
            className="underline"
            href={`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/imap-oauth/${data.oauthProvider}/start?email=${encodeURIComponent(data.email)}`}
          >
            {m['pages.settings.connections.imap.signInWith']({
              provider: data.oauthProvider === 'microsoft' ? 'Microsoft' : 'Google',
            })}
          </a>
        ) : (
          <ImapConnectionForm
            initial={data}
            onDone={() => {
              setOpen(false);
              onDone?.();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
