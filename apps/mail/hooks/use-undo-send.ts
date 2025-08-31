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

export type SerializedFile = {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  data: string; 
};

type SerializableEmailData = Omit<EmailData, 'attachments'> & {
  attachments: SerializedFile[];
};

export type ReplyMode = 'reply' | 'replyAll' | 'forward';

export type UndoContext =
  | { kind: 'compose' }
  | {
      kind: 'reply';
      threadId: string;
      mode: ReplyMode;
      activeReplyId: string;
      draftId?: string | null;
    };

const serializeFiles = async (files: File[]): Promise<SerializedFile[]> => {
  return Promise.all(
    files.map(async (file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      data: await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }),
    }))
  );
};

export const deserializeFiles = (serializedFiles: SerializedFile[]): File[] => {
  return serializedFiles.map(({ data, name, type, lastModified }) => {
    const byteString = atob(data);
    const byteArray = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      byteArray[i] = byteString.charCodeAt(i);
    }
    return new File([byteArray], name, { type, lastModified });
  });
};

export const useUndoSend = () => {
  const trpc = useTRPC();
  const { mutateAsync: unsendEmail } = useMutation(trpc.mail.unsend.mutationOptions());

  const [, setIsComposeOpen] = useQueryState('isComposeOpen');
  const [, setThreadId] = useQueryState('threadId');
  const [, setActiveReplyId] = useQueryState('activeReplyId');
  const [, setMode] = useQueryState('mode');
  const [, setDraftId] = useQueryState('draftId');

  const handleUndoSend = (
    result: unknown,
    settings: { settings: UserSettings } | undefined,
    emailData?: EmailData,
    context: UndoContext = { kind: 'compose' },
  ) => {
    if (isSendResult(result) && settings?.settings?.undoSendEnabled) {
      const { messageId, sendAt } = result;

      const timeRemaining = sendAt ? Math.max(0, sendAt - Date.now()) : 15_000;
      const wasUserScheduled = Boolean(emailData?.scheduleAt);

      if (timeRemaining > 5_000) {
        if (wasUserScheduled) {
          toast.success('Email scheduled', {
            action: {
              label: 'Undo',
              onClick: async () => {
                try {
                  await unsendEmail({ messageId });
                  toast.info('Schedule cancelled');
                } catch {
                  toast.error('Failed to cancel');
                }
              },
            },
            duration: 15_000,
            closeButton: true,
          });
        } else {
          toast.success('Email sent', {
            action: {
              label: 'Undo',
              onClick: async () => {
              try {
                await unsendEmail({ messageId });
                
                if (emailData) {
                  const serializedAttachments = await serializeFiles(emailData.attachments);
                  const serializableData: SerializableEmailData = {
                    ...emailData,
                    attachments: serializedAttachments,
                  };
                  if (context.kind === 'reply') {
                    const withContext = {
                      ...serializableData,
                      __replyContext: {
                        threadId: context.threadId,
                        activeReplyId: context.activeReplyId,
                        mode: context.mode,
                        draftId: context.draftId ?? null,
                      },
                    } as const;
                    localStorage.setItem('undoReplyEmailData', JSON.stringify(withContext));
                  } else {
                    localStorage.setItem('undoEmailData', JSON.stringify(serializableData));
                  }
                }
                
                if (context.kind === 'reply') {
                  setIsComposeOpen(null);
                  setThreadId(context.threadId);
                  setActiveReplyId(context.activeReplyId);
                  setMode(context.mode);
                  setDraftId(context.draftId ?? null);
                } else {
                  setActiveReplyId(null);
                  setMode(null);
                  setDraftId(null);
                  setIsComposeOpen('true');
                }
                
                toast.info('Send cancelled');
              } catch {
                toast.error('Failed to cancel');
              }
              },
            },
            duration: 15_000,
            closeButton: true,
          });
        }
      }
    }
  };

  return { handleUndoSend };
};
