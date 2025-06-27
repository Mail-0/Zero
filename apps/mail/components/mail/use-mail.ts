import { atom, useAtom } from 'jotai';

export type Config = {
  selected: string | null;
  bulkSelected: string[];
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
