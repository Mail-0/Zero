import { atom, useAtom } from "jotai";

import { type Mail } from "@/components/mail/data";

type Config = {
  selected: Mail["id"] | null;
  bulkSelected: Mail["id"][];
  replyComposerOpen: boolean;
  replyAllComposerOpen: boolean;
  forwardComposerOpen: boolean;
  showImages: boolean;
  showCc: boolean;
  showBcc: boolean;
};

const configAtom = atom<Config>({
  selected: null,
  bulkSelected: [],
  replyComposerOpen: false,
  replyAllComposerOpen: false,
  forwardComposerOpen: false,
  showImages: false,
  showCc: false,
  showBcc: false,
});

export function useMail() {
  return useAtom(configAtom);
}

export const clearBulkSelectionAtom = atom(
  null,
  (get, set) => {
    const current = get(configAtom);
    set(configAtom, { ...current, bulkSelected: [] });
  }
);
