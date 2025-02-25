import { atom, useAtom } from "jotai";

type Config = {
  value: string;
  highlight: string;
  folder: string;
};

const configAtom = atom<Config>({
  value: "",
  highlight: "",
  folder: "",
});

export function useSearchValue() {
  return useAtom(configAtom);
}
