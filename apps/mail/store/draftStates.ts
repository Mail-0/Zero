import { atomWithStorage } from "jotai/utils";
import { atom } from "jotai";

export interface DraftType {
  id: string;
  recipient?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  message?: string;
}
export const draftsAtom = atomWithStorage<DraftType[]>("emailDrafts", []);
export const draftCountAtom = atom((get) => get(draftsAtom).length);
