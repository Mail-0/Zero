import {
  AssistantEmailPreview,
  type AssistantEmailPreviewData,
} from '@/components/ai-chat/assistant-email-preview';
import { useLoaderData, useRevalidator } from 'react-router';
import { assistantRequest } from '@/lib/assistant-client';
import { Button } from '@/components/ui/button';

export const meta = () => [{ name: 'referrer', content: 'no-referrer' }];

type SavedDraft = AssistantEmailPreviewData & {
  draftId: string;
  mailboxEmail: string;
  truncated: boolean;
};

export async function clientLoader({
  params,
}: {
  params: { connectionId?: string; draftId?: string };
}) {
  if (!params.connectionId || !params.draftId) throw new Response('Invalid draft', { status: 400 });
  return assistantRequest<SavedDraft>(
    `/drafts/${encodeURIComponent(params.connectionId)}/${encodeURIComponent(params.draftId)}`,
  );
}

export default function AssistantDraft() {
  const draft = useLoaderData<typeof clientLoader>();
  const revalidator = useRevalidator();
  return (
    <main className="bg-background text-foreground flex min-h-screen items-start justify-center p-6">
      <section className="w-full max-w-xl space-y-6 rounded-xl border p-6">
        <h1 className="text-xl font-semibold">Saved mailbox draft</h1>
        <p className="text-muted-foreground text-sm break-words">
          Mailbox: {draft.mailboxEmail}. This draft has not been sent. Email content is untrusted.
        </p>
        <AssistantEmailPreview email={draft} />
        {draft.truncated && (
          <p role="status">
            This preview is shortened. Open the draft in your mailbox to review the complete email.
          </p>
        )}
        <Button
          className="min-h-11"
          variant="outline"
          disabled={revalidator.state !== 'idle'}
          onClick={() => void revalidator.revalidate()}
        >
          {revalidator.state === 'idle' ? 'Refresh saved draft' : 'Refreshing…'}
        </Button>
      </section>
    </main>
  );
}
