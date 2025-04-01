import { MailLayout } from '@/components/mail/mail';
import Link from 'next/link';

interface MailPageProps {
  params: Promise<{
    folder: string;
  }>;
}

const ALLOWED_FOLDERS = ['inbox', 'draft', 'sent', 'spam', 'trash', 'archive'];

export default async function MailPage({ params }: MailPageProps) {
  const { folder } = await params;

  if (!ALLOWED_FOLDERS.includes(folder)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold dark:text-gray-300 mb-2">Invalid Folder</h1>
          <p className="dark:text-gray-600 mb-2">
            The folder <strong>mail/{folder}</strong> does not exist.
          </p>
        </div>
      </div>
    );
  }

  return <MailLayout />;
}
