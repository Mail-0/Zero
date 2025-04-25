import { fetchThreadNotes } from '@/actions/notes';
import type { Note } from '@/app/api/notes/types';
import { useSession } from '@/lib/auth-client';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { toast } from 'sonner';
import useSWR from 'swr';

export type { Note };

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export const useThreadNotes = (threadId: string) => {
  const t = useTranslations();
  const { data: session } = useSession();
  const {
    data: notes = [],
    error,
    isLoading,
    mutate,
  } = useSWR<Note[]>(
    session?.connectionId && threadId ? ['notes', session.connectionId, threadId] : null,
    async () => {
      try {
        const result = await fetcher('/api/driver/notes?threadId=' + threadId);
        return result || [];
      } catch (err: any) {
        console.error('Error fetching notes:', err);
        toast.error(t('common.notes.errors.failedToLoadNotes'));
        throw err;
      }
    },
  );

  const hasNotes = useMemo(() => {
    if (!notes) return false;
    return notes.length > 0;
  }, [notes]);

  return {
    data: notes,
    error,
    mutate,
    isLoading: isLoading,
    hasNotes,
  };
};
