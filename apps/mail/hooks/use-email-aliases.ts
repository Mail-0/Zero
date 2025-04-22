'use client';

import type { EmailAlias } from '../actions/email-aliases';
import useSWRImmutable from 'swr/immutable';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useEmailAliases() {
  const { data, error, isLoading, mutate } = useSWRImmutable<EmailAlias[]>(
    '/api/driver/email-aliases',
    fetcher,
  );

  return {
    aliases: data || [],
    isLoading,
    error,
    mutate,
  };
}
