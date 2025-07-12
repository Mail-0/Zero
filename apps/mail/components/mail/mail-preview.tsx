import { memo } from 'react';
import { useThread } from '@/hooks/use-threads';
import { cn } from '@/lib/utils';
import { MailContent } from './mail-content';

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
    const { data: threadData } = useThread(messageId);
    const latestMessage = threadData?.latest;

    if (!isVisible || !latestMessage) return null;

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
      >
        <div className="max-h-[80vh] overflow-auto p-4">
          {latestMessage.decodedBody ? (
            <MailContent
              id={latestMessage.id}
              html={latestMessage.decodedBody}
              senderEmail={latestMessage.sender.email}
            />
          ) : (
            <div className="text-muted-foreground">No content to display.</div>
          )}
        </div>
      </div>
    );
  },
); 