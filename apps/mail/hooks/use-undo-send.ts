import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useQueryState } from 'nuqs';

import { useTRPC } from '@/providers/query-provider';
import { isSendResult } from '@/lib/email-utils';
import type { UserSettings } from '@zero/server/schemas';

export type EmailData = {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  message: string;
  attachments: File[];
  fromEmail?: string;
  scheduleAt?: string;
};

export const useUndoSend = () => {
  const trpc = useTRPC();
  const { mutateAsync: unsendEmail } = useMutation(trpc.mail.unsend.mutationOptions());
  
  const [, setIsComposeOpen] = useQueryState('isComposeOpen');
  const [, setDraftId] = useQueryState('draftId');
  const [, setActiveReplyId] = useQueryState('activeReplyId');
  const [, setMode] = useQueryState('mode');

  const handleUndoSend = (
    result: unknown, 
    settings: { settings: UserSettings } | undefined,
    emailData?: EmailData
  ) => {
    if (isSendResult(result) && settings?.settings?.undoSendEnabled) {
      const { messageId, sendAt } = result;

      const timeRemaining = sendAt ? sendAt - Date.now() : 15_000;

      if (timeRemaining > 5_000) {
        toast.success('Email scheduled', {
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                await unsendEmail({ messageId });
                
                if (emailData) {
                  localStorage.setItem('undoEmailData', JSON.stringify(emailData));
                }
                
                setActiveReplyId(null);
                setMode(null);
                setDraftId(null);
                setIsComposeOpen('true');
                
                toast.info('Send cancelled');
              } catch {
                toast.error('Failed to cancel');
              }
            },
          },
          duration: 15_000,
        });
      }
    }
  };

  return { handleUndoSend };
};
