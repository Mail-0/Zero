import { useActiveConnection } from '@/hooks/use-connections';
import { mailboxSyncView } from '@/lib/mailbox-sync-view';
import { useTRPC } from '@/providers/query-provider';
import { useQuery } from '@tanstack/react-query';

export function MailboxSyncStatus() {
  const trpc = useTRPC();
  const { data: connection } = useActiveConnection();
  const { data, isError } = useQuery(
    trpc.mail.syncStatus.queryOptions(undefined, {
      enabled: Boolean(connection?.id),
      staleTime: Infinity,
      refetchInterval: false,
    }),
  );
  if (!connection?.id) return null;
  const view = data ? mailboxSyncView(data) : null;
  if (!view && !isError) return null;
  const heading = isError ? 'Sync status unavailable' : view!.heading;
  const details = isError
    ? 'Could not update sync progress. Your imported mail remains saved.'
    : view!.detail;
  return (
    <div
      className="text-muted-foreground px-2 pt-1 text-[11px]"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      title={details}
    >
      <div
        className={isError || view?.attention ? 'text-amber-600 dark:text-amber-400' : undefined}
      >
        {heading}
      </div>
      <div className="mt-0.5 text-[10px] leading-relaxed">{details}</div>
    </div>
  );
}
