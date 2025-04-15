import { CreateEmail } from '@/components/create/create-email';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

// Define the type for search params
interface ComposePageProps {
  searchParams: Promise<{
    to?: string;
    subject?: string;
    body?: string;
    draftId?: string;
    cc?: string;
    bcc?: string;
  }>;
}

export default async function ComposePage({ searchParams }: ComposePageProps) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session) {
    redirect('/login');
  }

  // Need to await searchParams in Next.js 15+
  const params = await searchParams;

  // Check if this is a mailto URL
  const toParam = params.to || '';
  if (toParam.startsWith('mailto:')) {
    // Redirect to our dedicated mailto handler
    redirect(`/mail/compose/handle-mailto?mailto=${encodeURIComponent(toParam)}`);
  }

  // Handle normal compose page (direct or with draftId)
  return (
    <div className="flex h-full w-full flex-col">
      <div className="h-full flex-1">
        <CreateEmail
          initialTo={params.to || ''}
          initialSubject={params.subject || ''}
          initialBody={params.body || ''}
          initialCc={params.cc || ''}
          initialBcc={params.bcc || ''}
        />
      </div>
    </div>
  );
}
