import { atom, useAtom } from "jotai";

import { Mail } from "@/components/mail/data";

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
