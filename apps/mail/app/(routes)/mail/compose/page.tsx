import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CreateEmail } from '@/components/create/create-email';
import { authProxy } from '@/lib/auth-proxy';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

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
  const session = await authProxy.api.getSession({ headers: headersList });

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
    <Dialog open={true}>
      <DialogTitle></DialogTitle>
      <DialogDescription></DialogDescription>
      <DialogTrigger></DialogTrigger>
      <DialogContent className="h-screen w-screen max-w-none border-none bg-[#FAFAFA] p-0 shadow-none dark:bg-[#141414]">
        <CreateEmail
          initialTo={params.to || ''}
          initialSubject={params.subject || ''}
          initialBody={params.body || ''}
          initialCc={params.cc || ''}
          initialBcc={params.bcc || ''}
          draftId={params.draftId || null}
        />
      </DialogContent>
    </Dialog>
  );
}
