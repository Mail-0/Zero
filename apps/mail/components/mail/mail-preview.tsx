import { memo } from 'react';
import { useThread } from '@/hooks/use-threads';
import { cn } from '@/lib/utils';
import { MailContent } from './mail-content';
import { Skeleton } from '../ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertTriangle } from 'lucide-react';

export const MailPreview = memo(
  ({
    messageId,
    isVisible,
    position,
  }: {
    messageId: string | null;
    isVisible: boolean;
    position: { top: number; left: number };
  }) => {
    const { data: threadData, isLoading, error } = useThread(messageId);
    const latestMessage = threadData?.latest;

    if (!isVisible || !messageId) return null;

    return (
      <div
        className={cn(
          'fixed z-[100] w-[450px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg',
          'transition-opacity duration-200 dark:border-gray-700 dark:bg-[#262626]',
          isVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mail-preview-heading"
      >
        <h2 id="mail-preview-heading" className="sr-only">
          Email Preview
        </h2>
        <div className="max-h-[80vh] overflow-auto p-4">
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>Could not load email preview.</AlertDescription>
            </Alert>
          )}
          {!isLoading && !error && latestMessage?.decodedBody && (
            <MailContent
              id={latestMessage.id}
              html={latestMessage.decodedBody}
              senderEmail={latestMessage.sender.email}
            />
          )}
          {!isLoading && !error && (!latestMessage || !latestMessage.decodedBody) && (
            <div className="text-muted-foreground">No content to display.</div>
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    if (
      prevProps.messageId !== nextProps.messageId ||
      prevProps.isVisible !== nextProps.isVisible
    ) {
      return false;
    }
    if (
      prevProps.position.top !== nextProps.position.top ||
      prevProps.position.left !== nextProps.position.left
    ) {
      return false;
    }
    return true;
  },
); 