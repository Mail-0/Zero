'use client';
import { useSession } from '@/lib/auth-client';
import { useDebounce } from './use-debounce';
import axios from 'axios';
import useSWR from 'swr';

export const useStats = () => {
  const { data: session } = useSession();

  const {
    data = [],
    isValidating,
    isLoading,
    mutate: originalMutate,
    error,
  } = useSWR<{ label: string; count: number }[]>(
    session?.connectionId ? `/mail-count/${session?.connectionId}` : null,
    () => axios.get('/api/driver/count').then((res) => res.data),
  );

  const debouncedMutate = useDebounce(originalMutate, 3000);

  return {
    data: data ?? [],
    isValidating,
    isLoading,
    mutate: debouncedMutate,
    error,
  };
};
