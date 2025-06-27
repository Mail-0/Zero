import { useActiveConnection } from './use-connections';
import { useTRPC } from '@/providers/query-provider';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';
import { useTranslations } from 'use-intl';
import type { Note } from '@/types';

export const useThreadNotes = (threadId: string) => {
  const t = useTranslations();
  const { data: session } = useSession();
  const trpc = useTRPC();
  const { data: activeConnection } = useActiveConnection();

  const noteQuery = useQuery(
    trpc.notes.list.queryOptions(
      { threadId },
      {
        enabled: !!activeConnection?.id && !!threadId,
        staleTime: 1000 * 60 * 5, // 5 minutes
        initialData: { notes: [] as Note[] },
        meta: {
          customError: t('common.notes.errors.failedToLoadNotes'),
        },
      },
    ),
  );

  return noteQuery;
};
