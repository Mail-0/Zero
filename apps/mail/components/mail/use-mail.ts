import { atom, useAtom } from 'jotai';

import { type Mail } from '@/components/mail/data';

type Config = {
  selected: Mail['id'] | null;
  bulkSelected: Mail['id'][];
  unifiedInbox: boolean;
};

const configAtom = atom<Config>({
  selected: null,
  bulkSelected: [],
  unifiedInbox: false,
});

export function useMail() {
  return useAtom(configAtom);
}

export const clearBulkSelectionAtom = atom(null, (get, set) => {
  const current = get(configAtom);
  set(configAtom, { ...current, bulkSelected: [] });
});

export const toggleUnifiedInboxAtom = atom(
  (get) => get(configAtom).unifiedInbox,
  (get, set) => {
    const current = get(configAtom);
    set(configAtom, { ...current, unifiedInbox: !current.unifiedInbox });
  },
);
