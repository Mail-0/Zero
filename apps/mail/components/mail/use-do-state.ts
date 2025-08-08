import { atom, useAtom } from 'jotai';

export type State = {
  isSyncing: boolean;
  syncingFolders: string[];
  storageSize: number;
  counts: { label: string; count: number }[];
  shards: number;
};

const stateAtom = atom<State>({
  isSyncing: false,
  syncingFolders: [],
  storageSize: 0,
  counts: [],
  shards: 0,
});

function useDoState() {
  return useAtom(stateAtom);
}

const setIsSyncingAtom = atom(null, (get, set, isSyncing: boolean) => {
  const current = get(stateAtom);
  set(stateAtom, { ...current, isSyncing });
});

const setSyncingFoldersAtom = atom(null, (get, set, syncingFolders: string[]) => {
  const current = get(stateAtom);
  set(stateAtom, { ...current, syncingFolders });
});

const setStorageSizeAtom = atom(null, (get, set, storageSize: number) => {
  const current = get(stateAtom);
  set(stateAtom, { ...current, storageSize });
});

export { setIsSyncingAtom, setSyncingFoldersAtom, setStorageSizeAtom, useDoState };
