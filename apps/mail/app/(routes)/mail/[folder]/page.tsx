import { MailLayout } from '@/components/mail/mail';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

interface MailPageProps {
  params: Promise<{
    folder: string;
  }>;
  searchParams: Promise<{
    threadId: string;
  }>;
}

const ALLOWED_FOLDERS = ['inbox', 'draft', 'sent', 'spam', 'bin', 'archive'];

export default async function MailPage({ params }: MailPageProps) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session) {
    redirect('/login');
  }

  const { folder } = await params;

  if (!ALLOWED_FOLDERS.includes(folder)) {
    return <div>Invalid folder</div>;
  }

  return <MailLayout />;
}
