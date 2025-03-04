import { DropdownMenuCheckboxItemProps } from "@radix-ui/react-dropdown-menu";
import { atomWithStorage } from "jotai/utils";

type Checked = DropdownMenuCheckboxItemProps["checked"];

export type Tag = {
  id: string;
  label: string;
  checked: Checked;
};

// we might need to init these from the backend, should fix the flicker also
const initialTags: Tag[] = [
  { id: "0", label: "important", checked: false },
  { id: "1", label: "budget", checked: false },
  { id: "2", label: "meeting", checked: false },
  { id: "3", label: "personal", checked: false },
  { id: "5", label: "a really long one to test", checked: false },
];

export const tagsAtom = atomWithStorage<Tag[]>("tags-config", initialTags);
