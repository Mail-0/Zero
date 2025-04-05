import { atom, useAtom } from "jotai";

import { type Mail } from "@/components/mail/data";

type Config = {
  selected: Mail["id"] | null;
  bulkSelected: Mail["id"][];
};

const configAtom = atom<Config>({
  selected: null,
  bulkSelected: [],
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
