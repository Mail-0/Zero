import { CreateEmail } from '@/components/create/create-email';
import { authProxy } from '@/lib/auth-proxy';
import { useLoaderData } from 'react-router';
import type { Route } from './+types/page';

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const session = await authProxy.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.redirect(`${import.meta.env.VITE_PUBLIC_APP_URL}/login`);
  }

  const url = new URL(request.url);
  const toParam = url.searchParams.get('to');

  if (toParam?.startsWith('mailto:')) {
    return Response.redirect(
      `${import.meta.env.VITE_PUBLIC_APP_URL}/mail/compose/handle-mailto?mailto=${encodeURIComponent(toParam)}`,
    );
  }

  // The <CreateEmail> component is responsible for sanitizing these values,
  // especially `body`, before rendering to prevent XSS vulnerabilities
  return {
    to: url.searchParams.get('to') ?? undefined,
    subject: url.searchParams.get('subject') ?? undefined,
    body: url.searchParams.get('body') ?? undefined,
    draftId: url.searchParams.get('draftId') ?? undefined,
    cc: url.searchParams.get('cc') ?? undefined,
    bcc: url.searchParams.get('bcc') ?? undefined,
  };
}

export default function ComposePage() {
  const params = useLoaderData<typeof clientLoader>();

  // Use a standard `div` for a full-page component instead of a Dialog.
  // This fixes major accessibility and UX issues by removing the modal trap.
  return (
    <div className="h-screen w-screen bg-[#FAFAFA] p-0 dark:bg-[#141414]">
      <CreateEmail
        initialTo={params.to || ''}
        initialSubject={params.subject || ''}
        initialBody={params.body || ''}
        initialCc={params.cc || ''}
        initialBcc={params.bcc || ''}
        draftId={params.draftId || null}
      />
    </div>
  );
}