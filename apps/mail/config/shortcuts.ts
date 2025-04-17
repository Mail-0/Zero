export type ShortcutType = 'single' | 'combination';

export type Shortcut = {
  keys: string[];
  action: string;
  type: ShortcutType;
  description: string;
  scope: string;
  preventDefault?: boolean;
};

export const keyboardShortcuts: Shortcut[] = [
  { keys: ["c"], action: "newEmail", type: "single", description: "Compose new email", scope: "global" },
  { keys: ["mod", "Enter"], action: "sendEmail", type: "combination", description: "Send email", scope: "compose" },
  { keys: ["r"], action: "reply", type: "single", description: "Reply to email", scope: "thread-display" },
  { keys: ["a"], action: "replyAll", type: "single", description: "Reply all", scope: "thread-display" },
  { keys: ["f"], action: "forward", type: "single", description: "Forward email", scope: "thread-display" },
  { keys: ["g", "d"], action: "goToDrafts", type: "combination", description: "Go to drafts", scope: "global" },
  { keys: ["g", "i"], action: "inbox", type: "combination", description: "Go to inbox", scope: "global" },
  { keys: ["g", "t"], action: "sentMail", type: "combination", description: "Go to sent mail", scope: "global" },
  { keys: ["#"], action: "delete", type: "single", description: "Delete email", scope: "mail-list" },
  { keys: ["/"], action: "search", type: "single", description: "Search", scope: "global" },
  { keys: ["u"], action: "markAsUnread", type: "single", description: "Mark as unread", scope: "mail-list" },
  { keys: ["m"], action: "muteThread", type: "single", description: "Mute thread", scope: "mail-list" },
  { keys: ["mod", "p"], action: "printEmail", type: "combination", description: "Print email", scope: "thread-display" },
  { keys: ["e"], action: "archiveEmail", type: "single", description: "Archive email", scope: "mail-list" },
  { keys: ["!"], action: "markAsSpam", type: "single", description: "Mark as spam", scope: "mail-list" },
  { keys: ["v"], action: "moveToFolder", type: "single", description: "Move to folder", scope: "mail-list" },
  { keys: ["z"], action: "undoLastAction", type: "single", description: "Undo last action", scope: "global" },
  { keys: ["i"], action: "viewEmailDetails", type: "single", description: "View email details", scope: "thread-display" },
  { keys: ["o"], action: "expandEmailView", type: "single", description: "Expand email view", scope: "mail-list" },
  { keys: ["?"], action: "helpWithShortcuts", type: "single", description: "Show keyboard shortcuts", scope: "global" },
  { keys: ["mod", "a"], action: "selectAll", type: "combination", description: "Select all emails", scope: "mail-list", preventDefault: true },
];
