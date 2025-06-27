import { z } from 'zod';

export const shortcutSchema = z.object({
  keys: z.array(z.string()),
  action: z.string(),
  type: z.enum(['single', 'combination']),
  description: z.string(),
  scope: z.string(),
  preventDefault: z.boolean().optional(),
});

export type Shortcut = z.infer<typeof shortcutSchema>;
export type ShortcutType = Shortcut['type'];

const threadDisplayShortcuts: Shortcut[] = [
  // {
  //   keys: ['i'],
  //   action: 'viewEmailDetails',
  //   type: 'single',
  //   description: 'View email details',
  //   scope: 'thread-display',
  // },
  // {
  //   keys: ['mod', 'p'],
  //   action: 'printEmail',
  //   type: 'combination',
  //   description: 'Print email',
  //   scope: 'thread-display',
  // },
  {
    keys: ['r'],
    action: 'reply',
    type: 'single',
    description: 'Reply to email',
    scope: 'thread-display',
  },
  {
    keys: ['a'],
    action: 'replyAll',
    type: 'single',
    description: 'Reply all',
    scope: 'thread-display',
  },
  {
    keys: ['f'],
    action: 'forward',
    type: 'single',
    description: 'Forward email',
    scope: 'thread-display',
  },
  {
    keys: ['meta', 'backspace'],
    action: 'delete',
    type: 'single',
    description: 'Move to Bin',
    scope: 'thread-display',
  },
];

const globalShortcuts: Shortcut[] = [
  // { keys: ['/'], action: 'search', type: 'single', description: 'Search', scope: 'global' },
  // {
  //   keys: ['?'],
  //   action: 'helpWithShortcuts',
  //   type: 'single',
  //   description: 'Show keyboard shortcuts',
  //   scope: 'global',
  // },
  // {
  //   keys: ['z'],
  //   action: 'undoLastAction',
  //   type: 'single',
  //   description: 'Undo last action',
  //   scope: 'global',
  // },
  {
    keys: ['c'],
    action: 'newEmail',
    type: 'single',
    description: 'Compose new email',
    scope: 'global',
    preventDefault: true,
  },
  {
    keys: ['g', 'd'],
    action: 'goToDrafts',
    type: 'combination',
    description: 'Go to drafts',
    scope: 'global',
  },
  {
    keys: ['g', 'i'],
    action: 'inbox',
    type: 'combination',
    description: 'Go to inbox',
    scope: 'global',
  },
  {
    keys: ['g', 't'],
    action: 'sentMail',
    type: 'combination',
    description: 'Go to sent mail',
    scope: 'global',
  },
  {
    keys: ['mod', 'k'],
    action: 'commandPalette',
    type: 'combination',
    description: 'Open command palette',
    scope: 'global',
  },
];

const mailListShortcuts: Shortcut[] = [
  // {
  //   keys: ['r'],
  //   action: 'markAsRead',
  //   type: 'single',
  //   description: 'Mark as read',
  //   scope: 'mail-list',
  // },
  // {
  //   keys: ['u'],
  //   action: 'markAsUnread',
  //   type: 'single',
  //   description: 'Mark as unread',
  //   scope: 'mail-list',
  // },
  // {
  //   keys: ['m'],
  //   action: 'muteThread',
  //   type: 'single',
  //   description: 'Mute thread',
  //   scope: 'mail-list',
  // },
  // {
  //   keys: ['e'],
  //   action: 'archiveEmail',
  //   type: 'single',
  //   description: 'Archive email',
  //   scope: 'mail-list',
  // },
  {
    keys: ['escape'],
    action: 'exitSelectionMode',
    type: 'single',
    description: 'Exit selection mode',
    scope: 'mail-list',
  },
  // {
  //   keys: ['!'],
  //   action: 'markAsSpam',
  //   type: 'single',
  //   description: 'Mark as spam',
  //   scope: 'mail-list',
  // },
  // {
  //   keys: ['v'],
  //   action: 'moveToFolder',
  //   type: 'single',
  //   description: 'Move to folder',
  //   scope: 'mail-list',
  // },

  // {
  //   keys: ['o'],
  //   action: 'expandEmailView',
  //   type: 'single',
  //   description: 'Expand email view',
  //   scope: 'mail-list',
  // },
  // {
  //   keys: ['#'],
  //   action: 'delete',
  //   type: 'single',
  //   description: 'Delete email',
  //   scope: 'mail-list',
  // },
  // {
  //   keys: ['mod', 'a'],
  //   action: 'selectAll',
  //   type: 'combination',
  //   description: 'Select all emails',
  //   scope: 'mail-list',
  //   preventDefault: true,
  // },
];

const composeShortcuts: Shortcut[] = [
  {
    keys: ['mod', 'Enter'],
    action: 'sendEmail',
    type: 'combination',
    description: 'Send email',
    scope: 'compose',
  },
];

export const keyboardShortcuts: Shortcut[] = [
  ...threadDisplayShortcuts,
  ...globalShortcuts,
  ...mailListShortcuts,
  ...composeShortcuts,
];
