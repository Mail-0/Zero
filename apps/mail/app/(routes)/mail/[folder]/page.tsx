import { MailLayout } from '@/components/mail/mail';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

interface MailPageProps {
  params: Promise<{
    folder: string;
  }>;
}

const ALLOWED_FOLDERS = ['inbox', 'draft', 'sent', 'spam', 'trash', 'archive'];

export default async function MailPage({ params }: MailPageProps) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  
  if (!session) {
    redirect('/login');
  }

  const { folder } = await params;

  if (!ALLOWED_FOLDERS.includes(folder)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold dark:text-gray-300 mb-2">Invalid Folder</h1>
          <p className="dark:text-gray-400 mb-2">
            The folder <strong>mail/{folder}</strong> does not exist.
          </p>
        </div>
      </div>
    );
  }

  return <MailLayout />;
}
