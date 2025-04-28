'use client';

import { ParsedDraft } from '@/app/api/driver/types';
import { useSession } from '@/lib/auth-client';
import { fetcher } from '@/lib/utils';
import useSWR from 'swr';

export const useDraft = (id: string | null) => {
  const { data: session } = useSession();

  const { data, isLoading, error, mutate } = useSWR<ParsedDraft>(
    session?.user.id && id ? `/api/driver/drafts/${id}` : null,
    fetcher,
  );

  return { data, isLoading, error, mutate };
};
