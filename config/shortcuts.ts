// File: config/shortcuts.ts
export const DEFAULT_KEYBOARD_SHORTCUTS = [
  { keys: ["Meta", "n"], action: "New Email" },
  { keys: ["Meta", "Enter"], action: "Send Email" },
  { keys: ["Meta", "r"], action: "Reply" },
  { keys: ["Meta", "Shift", "r"], action: "Reply All" },
  { keys: ["Meta", "f"], action: "Forward" },
  { keys: ["Meta", "Shift", "d"], action: "Drafts" },
  { keys: ["Meta", "Shift", "i"], action: "Inbox" },
  { keys: ["Meta", "Shift", "s"], action: "Sent Mail" },
  { keys: ["Meta", "Backspace"], action: "Delete" },
  { keys: ["Meta", "/"], action: "Search" },
  { keys: ["Meta", "Shift", "u"], action: "Mark as Unread" },
  { keys: ["Meta", "Shift", "m"], action: "Mute Thread" },
  { keys: ["Meta", "Shift", "p"], action: "Print Email" },
  { keys: ["Meta", "Shift", "h"], action: "Archive Email" },
  { keys: ["Meta", "Shift", "j"], action: "Mark as Spam" },
  { keys: ["Meta", "Shift", "e"], action: "Move to Folder" },
  { keys: ["Meta", "Shift", "t"], action: "Undo Last Action" },
  { keys: ["Meta", "Shift", "v"], action: "View Email Details" },
  { keys: ["Meta", "Shift", "g"], action: "Go to Drafts" },
  { keys: ["Meta", "Shift", "x"], action: "Expand Email View" },
  { keys: ["Meta", "?"], action: "Help with shortcuts" },
];

export const HAS_SHORTCUTS_CHANGED = "hasShortcutsChanged";
