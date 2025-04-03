import { ScrollArea } from '@/components/ui/scroll-area';
import { MailList } from '@/components/mail/mail-list';
import type { InitialThread } from '@/types';

export const SRMailList = async ({
  threads,
  resultSizeEstimate,
  nextPageToken,
}: {
  threads?: InitialThread[];
  resultSizeEstimate?: number;
  nextPageToken?: string;
}) => {
  return (
    <ScrollArea className="h-[calc(100vh-4rem)]">
      <MailList items={threads ?? []} size={resultSizeEstimate} next={nextPageToken} />
    </ScrollArea>
  );
};
