import { atom, useAtom } from 'jotai';

export const selectedAtom = atom<string | null>(null);
export const bulkSelectedAtom = atom<string[]>([]);
export const replyComposerOpenAtom = atom<boolean>(false);
export const replyAllComposerOpenAtom = atom<boolean>(false);
export const forwardComposerOpenAtom = atom<boolean>(false);
export const showImagesAtom = atom<boolean>(false);

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
  set(bulkSelectedAtom, []);
});
