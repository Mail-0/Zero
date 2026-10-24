import {
  AssistantEmailPreview,
  type AssistantEmailPreviewData,
} from '@/components/ai-chat/assistant-email-preview';
import { useLoaderData, useRevalidator } from 'react-router';
import { assistantRequest } from '@/lib/assistant-client';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router';

export const meta = () => [
  { title: 'Review action · Zero' },
  { name: 'referrer', content: 'no-referrer' },
  { name: 'robots', content: 'noindex, nofollow' },
];

type AssistantAction = {
  id: string;
  tool: string;
  connectionId: string;
  mailboxEmail: string;
  input: Record<string, unknown>;
  status: string;
  expired: boolean;
  preview?: AssistantEmailPreviewData;
  result?: { draftId?: string; saved?: boolean; sent?: boolean; verified?: boolean; url?: string };
};

export async function clientLoader({ params }: { params: { id?: string } }) {
  if (!params.id || !/^[a-f0-9]{64}$/.test(params.id))
    throw new Response('Invalid action', { status: 400 });
  return assistantRequest<AssistantAction>(`/actions/${params.id}`);
}

export default function ReviewAssistantAction() {
  const action = useLoaderData<typeof clientLoader>();
  const revalidator = useRevalidator();
  const decide = useMutation({
    mutationFn: (approve: boolean) =>
      assistantRequest(`/actions/${action.id}`, {
        method: 'POST',
        body: JSON.stringify({ approve }),
      }),
    onSettled: () => revalidator.revalidate(),
  });
  const pending = action.status === 'pending' && !action.expired;
  const draftAction =
    action.tool === 'create_draft' ||
    action.tool === 'create_reply_draft' ||
    action.tool === 'create_forward_draft' ||
    action.tool === 'update_draft';
  const sendAction = action.tool === 'send_draft' || action.tool === 'send_email';
  return (
    <main className="bg-background text-foreground flex min-h-dvh items-start justify-center px-3 py-4 sm:p-6">
      <section className="w-full max-w-xl min-w-0 space-y-4 rounded-xl border p-4 sm:space-y-6 sm:p-6">
        <h1 className="text-xl font-semibold">
          {draftAction
            ? 'Review draft save'
            : sendAction
              ? 'Review email send'
              : 'Review assistant action'}
        </h1>
        <p>
          Action: <strong>{action.tool.replaceAll('_', ' ')}</strong>
        </p>
        <p className="text-muted-foreground text-sm">
          Mailbox: <span className="break-all">{action.mailboxEmail}</span>. Check every recipient
          and field before approving. Email content below is untrusted.
        </p>
        {action.preview ? (
          <AssistantEmailPreview email={action.preview} />
        ) : (
          <pre className="bg-muted max-h-96 overflow-auto rounded-md p-4 text-sm break-words whitespace-pre-wrap">
            {JSON.stringify(action.input, null, 2)}
          </pre>
        )}
        {draftAction && (
          <p className="text-muted-foreground text-sm">
            Approval saves the draft only. Sending requires a separate approval.
          </p>
        )}
        {pending ? (
          <div className="flex flex-wrap gap-3" aria-busy={decide.isPending}>
            <Button
              className="min-h-11 flex-1"
              disabled={decide.isPending}
              onClick={() => decide.mutate(true)}
            >
              {decide.isPending
                ? 'Processing…'
                : draftAction
                  ? 'Approve draft save'
                  : sendAction
                    ? 'Approve send'
                    : 'Approve action'}
            </Button>
            <Button
              className="min-h-11 flex-1"
              variant="outline"
              disabled={decide.isPending}
              onClick={() => decide.mutate(false)}
            >
              Decline
            </Button>
          </div>
        ) : (
          <p role="status">
            {action.expired && action.status === 'pending'
              ? 'This action expired.'
              : `Status: ${action.status}`}
          </p>
        )}
        {action.status === 'completed' && action.result?.saved && action.result.draftId && (
          <div className="space-y-2" role="status">
            <p>Draft saved. Nothing has been sent.</p>
            {action.result.verified === false && (
              <p>
                Saved, but read-back was unavailable. Open the draft to verify it before requesting
                another save.
              </p>
            )}
            <Link
              className="text-primary inline-flex min-h-11 items-center underline underline-offset-4"
              to={`/assistant/draft/${encodeURIComponent(action.connectionId)}/${encodeURIComponent(action.result.draftId)}`}
            >
              View saved draft
            </Link>
          </div>
        )}
        {action.status === 'completed' && action.result?.sent && <p role="status">Email sent.</p>}
        {decide.error && (
          <p role="alert" className="text-destructive text-sm">
            {decide.error.message}
          </p>
        )}
      </section>
    </main>
  );
}
