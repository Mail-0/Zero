import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assistantRequest } from '@/lib/assistant-client';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';

type Status = {
  line?: string;
  identities: Array<{ id: string; channel: string; sender: string; active: boolean }>;
};
export function AssistantChannels() {
  const { data: session } = useSession();
  const queryKey = ['assistant-channels', session?.user.id];
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey,
    queryFn: () => assistantRequest<Status>('/status'),
    retry: false,
    enabled: !!session?.user.id,
  });
  const disconnect = useMutation({
    mutationFn: (id: string) => assistantRequest(`/identities/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  if (!status.data?.line) return null;
  return (
    <section className="mt-6 space-y-4 border-t pt-6" aria-labelledby="assistant-channels-title">
      <h2 id="assistant-channels-title" className="font-medium">
        Text your account assistant
      </h2>
      <p className="text-muted-foreground text-sm">
        Send an iMessage to{' '}
        <a className="underline" href={`sms:${status.data.line}`}>
          {status.data.line}
        </a>
        , then follow the Zero login link to connect your account.
      </p>
      {status.data.identities.map((identity) => (
        <div key={identity.id} className="flex items-center justify-between gap-3 text-sm">
          <span className="min-w-0 break-all">
            {identity.sender} · {identity.active ? 'Connected' : 'Disconnected'}
          </span>
          {identity.active && (
            <Button
              variant="outline"
              className="min-h-11 shrink-0"
              disabled={disconnect.isPending}
              onClick={() => disconnect.mutate(identity.id)}
            >
              Disconnect
            </Button>
          )}
        </div>
      ))}
      {disconnect.error && (
        <p role="alert" className="text-destructive text-sm">
          {disconnect.error.message}
        </p>
      )}
    </section>
  );
}
