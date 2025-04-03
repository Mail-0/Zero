import { IGetThreads, MailPageProps } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { MailLayout } from '@/components/mail/mail';
import { redirect } from 'next/navigation';
import { SRMailList } from './list.server';
import { getMails } from '@/actions/mail';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { Suspense } from 'react';

const ALLOWED_FOLDERS = ['inbox', 'draft', 'sent', 'spam', 'trash', 'archive'];

export default async function MailPage({ params, searchParams }: MailPageProps) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session) redirect('/login');

  const { threadId, folder } = await params;
  const { pageToken, q, max, labelIds } = await searchParams;
  const threadsResponse = await getMails({
    folder,
    q,
    max,
    pageToken,
    labelIds,
  });

  if (!ALLOWED_FOLDERS.includes(folder)) {
    return <div>Invalid folder</div>;
  }

  return (
    <MailLayout>
      <Suspense
        fallback={
          <div className="flex flex-col">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex flex-col px-4 py-3">
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="mt-2 h-3 w-32" />
                <Skeleton className="mt-2 h-3 w-full" />
                <div className="mt-2 flex gap-2">
                  <Skeleton className="h-4 w-16 rounded-md" />
                  <Skeleton className="h-4 w-16 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        }
      >
        <SRMailList
          threads={threadsResponse?.threads}
          nextPageToken={threadsResponse?.nextPageToken}
          resultSizeEstimate={threadsResponse?.resultSizeEstimate}
        />
      </Suspense>
    </MailLayout>
  );
}
