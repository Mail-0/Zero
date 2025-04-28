'use client';

import useSWRImmutable from 'swr/immutable';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export type EmailAlias = {
  email: string;
  name?: string;
  primary?: boolean;
};

export function useEmailAliases() {
  const { data, error, isLoading, mutate } = useSWRImmutable<EmailAlias[]>(
    '/api/v1/email-aliases',
    fetcher,
  );

  return {
    aliases: data || [],
    isLoading,
    error,
    mutate,
  };
}
