import { atom } from "jotai";

export const connectionIdAtom = atom<string | null>(null);
export const connectionLoadingAtom = atom<boolean>(true);
export const connectionErrorAtom = atom<Error | null>(null);
