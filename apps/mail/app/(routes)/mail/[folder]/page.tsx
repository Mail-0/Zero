import { theme, connectionTheme, connectionThemeRelations } from '@zero/db/schema';
import { MailLayout } from '@/components/mail/mail';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@zero/db';

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

  if (!session || !session.connectionId) {
    redirect('/login');
  }

  const { folder } = await params;

  if (!ALLOWED_FOLDERS.includes(folder)) {
    return <div>Invalid folder</div>;
  }

  const [userThemes, currentConnectionTheme] = await Promise.all([
    db.query.theme.findMany({
      where: eq(theme.userId, session.user.id),
      columns: {
        id: true,
        name: true,
      },
    }),
    db.query.connectionTheme.findFirst({
      where: eq(connectionTheme.connectionId, session.connectionId),
      with: {
        theme: {
          columns: {
            id: true,
            styles: true,
          },
        },
      },
    }),
  ]);

  return <MailLayout userThemes={userThemes} currentTheme={currentConnectionTheme?.theme} />;
}
