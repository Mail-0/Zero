import { draftsAtom, DraftType } from "@/store/draftStates";
import { useAtom } from "jotai";

export const useDrafts = () => {
  const [drafts, setDrafts] = useAtom(draftsAtom);

  const addDraft = (draft: DraftType) => {
    setDrafts((prevDrafts) => {
      const draftIndex = prevDrafts.findIndex((d) => d.id === draft.id);
      if (draftIndex !== -1) {
        // Update existing draft
        const updatedDrafts = [...prevDrafts];
        updatedDrafts[draftIndex] = { ...prevDrafts[draftIndex], ...draft };
        return updatedDrafts;
      } else {
        // Add new draft
        return [...prevDrafts, draft];
      }
    });
  };

  const removeDraft = (id: string) => {
    setDrafts((prev) => prev.filter((draft) => draft.id !== id));
  };

  return { drafts, addDraft, removeDraft };
};
