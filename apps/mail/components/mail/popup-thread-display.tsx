import { useThread } from '@/hooks/use-threads';
import { MailDisplaySkeleton } from './mail-skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Attachment } from '@/types';
import { cn } from '@/lib/utils';
import MailDisplay from './mail-display';
import { useQueryState } from 'nuqs';
import { useMemo } from 'react';

export function PopupThreadDisplay() {
  const [id] = useQueryState('threadId');
  const { data: emailData, isLoading } = useThread(id ?? null);
  
  const allThreadAttachments = useMemo(() => {
    if (!emailData?.messages) return [];
    return emailData.messages.reduce<Attachment[]>((acc, message) => {
      if (message.attachments && message.attachments.length > 0) {
        message.attachments.forEach(attachment => acc.push(attachment));
      }
      return acc;
    }, []);
  }, [emailData?.messages]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      <div className="bg-panelLight dark:bg-panelDark relative flex h-full flex-col overflow-hidden rounded-xl transition-all duration-300">
        {!id ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <p className="text-lg">No thread selected</p>
            </div>
          </div>
        ) : !emailData || isLoading ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <ScrollArea className="h-full flex-1" type="auto">
              <div className="pb-4">
                <MailDisplaySkeleton isFullscreen={false} />
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-1 flex-col">
            <ScrollArea
              className="h-full flex-1"
              type="auto"
            >
              <div className="pb-4">
                {(emailData.messages || []).map((message, index) => {
                  return (
                    <div
                      key={message.id}
                      className={cn(
                        'transition-all duration-200',
                        index > 0 && 'border-border border-t',
                      )}
                    >
                      <MailDisplay
                        emailData={message}
                        isFullscreen={false}
                        isMuted={false}
                        isLoading={false}
                        index={index}
                        totalEmails={emailData.messages?.length}
                        threadAttachments={index === 0 ? allThreadAttachments : undefined}
                        isPopup={true} // This indicates it's in popup mode
                      />
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
} 