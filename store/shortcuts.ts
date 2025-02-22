//File: store/shortcuts.ts
import { DEFAULT_KEYBOARD_SHORTCUTS } from "@/config/shortcuts";
import { HAS_SHORTCUTS_CHANGED } from "@/config/shortcuts";
import { atomWithStorage } from "jotai/utils";

export const keyboardShortcutsAtom = atomWithStorage("shortcuts", DEFAULT_KEYBOARD_SHORTCUTS);
if (typeof window !== "undefined" && localStorage.getItem(HAS_SHORTCUTS_CHANGED) !== "true") {
  localStorage.setItem("shortcuts", JSON.stringify(DEFAULT_KEYBOARD_SHORTCUTS));
}
