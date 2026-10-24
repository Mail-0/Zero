import { assistantRequest } from '@/lib/assistant-client';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';

export const meta = () => [{ name: 'referrer', content: 'no-referrer' }];
import { useLoaderData } from 'react-router';

export async function clientLoader({ request }: { request: Request }) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new Response('Invalid connection link', { status: 400 });
  const link = await assistantRequest<{ channel: string; sender: string; account: string }>(
    `/links/${token}`,
  );
  return { token, link };
}

export default function ConnectAssistant() {
  const { token, link } = useLoaderData<typeof clientLoader>();
  const connect = useMutation({
    mutationFn: () =>
      assistantRequest<{ command: string; line: string }>(`/links/${token}`, { method: 'POST' }),
  });
  return (
    <main className="bg-background text-foreground flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-md space-y-6 rounded-xl border p-6">
        <h1 className="text-xl font-semibold">Connect your Zero assistant</h1>
        <p>
          Link iMessage identity <strong className="break-all">{link.sender}</strong> to{' '}
          <strong className="break-all">{link.account}</strong>.
        </p>
        <p className="text-muted-foreground text-sm">
          Only continue if you started this connection. The assistant will be able to read your
          connected mailboxes. Sending and changing mail require your approval in Zero.
        </p>
        {connect.data ? (
          <div role="status" className="space-y-3">
            <p>
              From that same iMessage identity, text this command to {connect.data.line} within 10
              minutes:
            </p>
            <code className="bg-muted block rounded-md p-4 text-base select-all">
              {connect.data.command}
            </code>
            <p className="text-muted-foreground text-sm">
              Do not share this command. Zero will confirm the connection in iMessage.
            </p>
          </div>
        ) : (
          <Button
            className="min-h-11 w-full"
            disabled={connect.isPending}
            onClick={() => connect.mutate()}
          >
            {connect.isPending ? 'Connecting…' : 'Connect this account'}
          </Button>
        )}
        {connect.error && (
          <p role="alert" className="text-destructive text-sm">
            {connect.error.message}
          </p>
        )}
      </section>
    </main>
  );
}
