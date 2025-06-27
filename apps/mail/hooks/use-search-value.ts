import { atom, useAtom } from 'jotai';

type Config = {
  value: string;
  highlight: string;
  folder: string;
  isLoading?: boolean;
  isAISearching?: boolean;
};

const configAtom = atom<Config>({
  value: '',
  highlight: '',
  folder: '',
  isLoading: false,
  isAISearching: false,
});

export function useSearchValue() {
  return useAtom(configAtom);
}
