import { MailLayout } from '@/components/mail/mail';
import { authProxy } from '@/lib/auth-proxy';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

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
  const headersList = new Headers(Object.fromEntries(await (await headers()).entries()));
  const session = await authProxy.api.getSession({ headers: headersList });

  if (!session) {
    redirect('/login');
  }

  const { folder } = await params;

  if (!ALLOWED_FOLDERS.includes(folder)) {
    return <div>Invalid folder</div>;
  }

  return <MailLayout />;
}
