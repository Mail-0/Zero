import useBackgroundQueue from '@/hooks/ui/use-background-queue';
import { useMail } from '@/components/mail/use-mail';
import { useTRPC } from '@/providers/query-provider';
import { useMutation } from '@tanstack/react-query';
import { useThreads } from '@/hooks/use-threads';
import { useStats } from '@/hooks/use-stats';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

const useDelete = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [mail, setMail] = useMail();
  const [{ refetch: refetchThreads }] = useThreads();
  const { refetch: refetchStats } = useStats();
  const t = useTranslations();
  const { addToQueue, deleteFromQueue } = useBackgroundQueue();
  const trpc = useTRPC();
  const { mutateAsync: deleteThread } = useMutation(trpc.mail.delete.mutationOptions());

  return {
    mutate: (id: string, type: 'thread' | 'email' = 'thread') => {
      setIsLoading(true);
      addToQueue(id);
      return toast.promise(
        deleteThread({
          id,
        }),
        {
          loading: t('common.actions.deletingMail'),
          success: t('common.actions.deletedMail'),
          error: (error) => {
            console.error(`Error deleting ${type}:`, error);

            return t('common.actions.failedToDeleteMail');
          },
          finally: async () => {
            setMail({
              ...mail,
              bulkSelected: [],
            });
            setIsLoading(false);
            await Promise.all([refetchThreads(), refetchStats()]);
          },
        },
      );
    },
    isLoading,
  };
};

export default useDelete;
