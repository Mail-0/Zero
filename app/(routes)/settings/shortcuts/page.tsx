// File: components/settings/shortcuts/page.tsx
"use client";

import { DEFAULT_KEYBOARD_SHORTCUTS, HAS_SHORTCUTS_CHANGED } from "@/config/shortcuts";
import { SettingsCard } from "@/components/settings/settings-card";
import { ReactNode, useState, useEffect, useRef } from "react";
import { keyboardShortcutsAtom } from "@/store/shortcuts";
import { Button } from "@/components/ui/button";
import { useAtom } from "jotai";
import { toast } from "sonner";

// Moved outside the component so it's accessible to both + made a function
const formatShortcutKeys = (keys: string[]) => {
  if (!keys) return "";
  return keys
    .map((key) => {
      if (key === "Meta") return "⌘";
      if (key === "Control") return "Ctrl";
      if (key === "ArrowUp") return "↑";
      if (key === "ArrowDown") return "↓";
      if (key === "ArrowLeft") return "←";
      if (key === "ArrowRight") return "→";
      if (key === " ") return "Space";
      return key;
    })
    .join("+");
};

export default function ShortcutsPage() {
  const [shortcuts, setShortcuts] = useAtom(keyboardShortcutsAtom);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [tempShortcut, setTempShortcut] = useState<string[]>([]); // Temporarily store new keys
  const shortcutContainerRef = useRef<HTMLDivElement>(null); // Ref for click-outside

  useEffect(() => {
    const hasChanged = localStorage.getItem(HAS_SHORTCUTS_CHANGED);
    if (hasChanged === "true") {
      // Load from atom (Jotai handles localStorage)
    } else {
      setShortcuts(DEFAULT_KEYBOARD_SHORTCUTS);
    }
  }, [setShortcuts]);

  const handleEditShortcut = (action: string) => {
    setIsEditing(action);
    setTempShortcut([]); // Reset temporary shortcut
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === "Escape") {
      setIsEditing(null);
      setTempShortcut([]);
      return;
    }
    // Ignore certain keys
    const ignoredKeys = [
      "CapsLock",
      "NumLock",
      "ScrollLock",
      "OS",
      "AudioVolumeMute",
      "AudioVolumeDown",
      "AudioVolumeUp",
      "ContextMenu",
      "Insert",
      "PageUp",
      "PageDown",
      "Home",
      "End",
      "Pause",
      "PrintScreen",
    ];

    if (ignoredKeys.includes(e.key)) {
      return;
    }

    if (e.key === "Backspace") {
      setTempShortcut((prev) => prev.slice(0, -1)); // Remove the last key
      return;
    }
    if (e.key === "Enter") {
      handleShortcutUpdate();
      return;
    }

    const key = e.key;
    const newShortcut: string[] = [];

    // Consistent modifier order: Ctrl, Alt, Shift, Meta
    if (e.ctrlKey) newShortcut.push("Ctrl");
    if (e.altKey) newShortcut.push("Alt");
    if (e.shiftKey) newShortcut.push("Shift");
    if (e.metaKey) newShortcut.push("Meta");

    // Add the key *only* if it's not a modifier *and* not already in the temp shortcut
    if (key && !newShortcut.includes(key) && !["Control", "Alt", "Shift", "Meta"].includes(key)) {
      newShortcut.push(key);
    }

    //prevent duplicates

    if (!tempShortcut.includes(key)) {
      setTempShortcut(newShortcut);
    }
  };

  const isDuplicateShortcut = (newShortcut: string[]) => {
    const newShortcutStr = formatShortcutKeys(newShortcut);
    return shortcuts.some(
      (shortcut) =>
        shortcut.action !== isEditing && // Exclude the *current* shortcut being edited
        formatShortcutKeys(shortcut.keys) === newShortcutStr, // Use formatted string for comparison
    );
  };

  const handleShortcutUpdate = () => {
    if (!isEditing) return;

    if (!tempShortcut.length) {
      toast.error("No keys were pressed");
      setIsEditing(null); // Clear editing state
      return;
    }

    // Prevent modifier-only shortcuts.
    if (
      tempShortcut.length === 1 &&
      ["Meta", "Shift", "Alt", "Control"].includes(tempShortcut[0])
    ) {
      toast.error("Invalid shortcut");
      setIsEditing(null); // Clear editing state
      setTempShortcut([]);
      return;
    }

    if (isDuplicateShortcut(tempShortcut)) {
      toast.error("Shortcut already in use!");
      setIsEditing(null); // Clear editing state on duplicate
      setTempShortcut([]);
      return;
    }

    const updatedShortcuts = shortcuts.map((shortcut) =>
      shortcut.action === isEditing ? { ...shortcut, keys: tempShortcut } : shortcut,
    );
    setShortcuts(updatedShortcuts);
    localStorage.setItem(HAS_SHORTCUTS_CHANGED, "true");
    setIsEditing(null); // Clear editing state after update.
    setTempShortcut([]);
    toast.success("Shortcut updated!");
  };

  const handleResetShortcuts = () => {
    setIsEditing(null); // Clear is editing!
    setTempShortcut([]);
    setShortcuts(DEFAULT_KEYBOARD_SHORTCUTS);
    localStorage.setItem(HAS_SHORTCUTS_CHANGED, "false");
    toast.success("Shortcuts reset to defaults!");
  };

  return (
    <div className="grid gap-6">
      <SettingsCard
        title="Keyboard Shortcuts"
        description="View and customize keyboard shortcuts for quick actions."
        footer={
          <div className="flex justify-between">
            <Button variant="outline" onClick={handleResetShortcuts}>
              Reset to Defaults
            </Button>
            <Button onClick={handleShortcutUpdate} disabled={!isEditing}>
              Save Changes
            </Button>
          </div>
        }
      >
        <div className="grid gap-2 md:grid-cols-2" role="group">
          {shortcuts.map((shortcut, index) => (
            <Shortcut
              key={index}
              keys={shortcut.keys}
              isEditing={isEditing === shortcut.action}
              onEdit={() => handleEditShortcut(shortcut.action)}
              tempShortcut={tempShortcut}
              setIsEditing={setIsEditing}
              setTempShortcut={setTempShortcut}
              onKeyDown={handleKeyDown}
            >
              {shortcut.action}
            </Shortcut>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}

function Shortcut({
  children,
  keys,
  isEditing,
  onEdit,
  tempShortcut,
  setIsEditing,
  setTempShortcut,
}: {
  children: ReactNode;
  keys: string[];
  isEditing: boolean;
  onEdit: () => void;
  tempShortcut: string[];
  setIsEditing: React.Dispatch<React.SetStateAction<string | null>>;
  setTempShortcut: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const shortcutContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isEditing &&
        shortcutContainerRef.current &&
        !shortcutContainerRef.current.contains(event.target as Node)
      ) {
        setIsEditing(null); // Clear editing state
        setTempShortcut([]);
      }
    };

    if (isEditing) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditing, setIsEditing, setTempShortcut]);

  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg border p-2 text-sm text-muted-foreground transition-colors ${
        isEditing
          ? "bg-accent text-accent-foreground"
          : "bg-card/50 hover:border-primary hover:bg-card"
      }`}
      ref={shortcutContainerRef}
    >
      <span className="font-medium">{children}</span>
      <div className="flex select-none gap-1">
        {isEditing ? (
          <span className="animate-pulse rounded bg-secondary px-2 py-0.5 text-xs">
            Recording...
          </span>
        ) : (
          <>
            <span
              role="button"
              className="h-6 rounded-[6px] border border-muted-foreground/10 bg-accent px-1.5 font-mono text-xs leading-6"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              {formatShortcutKeys(keys)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
