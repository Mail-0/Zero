import { useSession } from '@/lib/auth-client';
import useSWRImmutable from 'swr/immutable';
import { useEffect, useState } from 'react';
import { Sender } from '@/types';

export const useContacts = () => {
  const { data: session } = useSession();
  const { mutate, data } = useSWRImmutable<Sender[]>(['contacts', session?.connectionId]);

  useEffect(() => {
    if (!session?.connectionId) return;
    // provider.list(`$inf$@"${session?.connectionId}"`).then((cachedThreadsResponses) => {
    //   const seen = new Set<string>();
    //   const contacts: Sender[] = cachedThreadsResponses.reduce((acc: Sender[], { state }) => {
    //     if (state.data) {
    //       for (const thread of state.data[0].threads) {
    //         const email = thread.sender.email;
    //         if (!seen.has(email)) {
    //           seen.add(email);
    //           acc.push(thread.sender);
    //         }
    //       }
    //     }
    //     return acc;
    //   }, []);
    //   mutate(contacts);
    // });
  }, [session?.connectionId]);

  if (!data) {
    return [];
  }

  return data;
};
