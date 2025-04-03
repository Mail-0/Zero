import { SRThreadDisplay } from '@/components/mail/thread-display';
import { getMail, getMails, markAsRead } from '@/actions/mail';
import type { MailPageProps, ParsedMessage } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { MailLayout } from '@/components/mail/mail';
import { SRMailList } from '../list.server';
import { Suspense } from 'react';

export default async function MailPage({ params, searchParams }: MailPageProps) {
  const { threadId, folder } = await params;
  const { pageToken, q, max, labelIds } = await searchParams;

  let threadMessages: ParsedMessage[] = [];
  if (threadId) threadMessages = (await getMail({ id: threadId })) ?? [];
  if (threadMessages && threadMessages.some((e) => e.unread)) void markAsRead({ ids: [threadId] });
  const threadsResponse = await getMails({
    folder,
    q,
    max,
    pageToken,
    labelIds,
  });
  return (
    <MailLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        <div className="w-full md:w-[33%]">
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
              resultSizeEstimate={threadsResponse?.resultSizeEstimate}
              threads={threadsResponse?.threads}
              nextPageToken={threadsResponse?.nextPageToken}
            />
          </Suspense>
        </div>
        <div className="hidden border-l md:block md:w-[67%]">
          <Suspense fallback={<p>Loading</p>}>
            <SRThreadDisplay messages={threadMessages ?? []} />
          </Suspense>
        </div>
      </div>
    </MailLayout>
  );
}
