'use client';
import { useSession } from '@/lib/auth-client';
import { mailCount } from '@/actions/mail';
import useSWR from 'swr';

export const useStats = () => {
  const { data: session } = useSession();
  const {
    data = [],
    isValidating,
    isLoading,
    mutate,
    error,
  } = useSWR<{ label: string; count: number }[]>(
    session?.connectionId ? `/mail-count/${session?.connectionId}` : null,
    mailCount,
  );

  return {
    data,
    isValidating,
    isLoading,
    mutate,
    error,
  };
};
