import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTRPC } from '@/providers/query-provider';
import { isSendResult } from '@/lib/email-utils';
import type { UserSettings } from '@zero/server/schemas';

export const useUndoSend = () => {
  const trpc = useTRPC();
  const { mutateAsync: unsendEmail } = useMutation(trpc.mail.unsend.mutationOptions());

  const handleUndoSend = (result: unknown, settings: { settings: UserSettings } | undefined) => {
    if (isSendResult(result) && settings?.settings?.undoSendEnabled) {
      const { messageId, sendAt } = result;

      const timeRemaining = sendAt ? sendAt - Date.now() : 30_000;

      if (timeRemaining > 5_000) {
        toast.success('Email scheduled', {
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                await unsendEmail({ messageId });
                toast.info('Send cancelled');
              } catch {
                toast.error('Failed to cancel');
              }
            },
          },
          duration: timeRemaining,
        });
      }
    }
  };

  return { handleUndoSend };
};
