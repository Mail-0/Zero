import { atom, useAtom } from 'jotai';

import { type InitialThread } from '@/types';

export type Config = {
  selected: InitialThread['id'] | null;
  bulkSelected: InitialThread['id'][];
  replyComposerOpen: boolean;
  replyAllComposerOpen: boolean;
  forwardComposerOpen: boolean;
  showImages: boolean;
};

const configAtom = atom<Config>({
  selected: null,
  bulkSelected: [],
  replyComposerOpen: false,
  replyAllComposerOpen: false,
  forwardComposerOpen: false,
  showImages: false,
});

export function useMail() {
  return useAtom(configAtom);
}

export const clearBulkSelectionAtom = atom(null, (get, set) => {
  const current = get(configAtom);
  set(configAtom, { ...current, bulkSelected: [] });
});
