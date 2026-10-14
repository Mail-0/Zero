/**
 * Maps IMAP folders onto the Gmail-style label ids the rest of the app uses. Each system
 * label (INBOX, SENT, DRAFT, SPAM, TRASH, ARCHIVE) maps to at most one folder, chosen by
 * SPECIAL-USE attribute (RFC 6154) first and by well-known names second. Every other
 * selectable folder becomes a user label.
 */
import type { ListEntry } from './client';

export type SystemFolderLabel = 'INBOX' | 'SENT' | 'DRAFT' | 'SPAM' | 'TRASH' | 'ARCHIVE';

export const SYSTEM_FOLDER_LABELS: SystemFolderLabel[] = [
  'INBOX',
  'SENT',
  'DRAFT',
  'SPAM',
  'TRASH',
  'ARCHIVE',
];

export interface MappedFolder {
  path: string;
  delimiter: string | null;
  labelId: string;
  /** Display name with `/` as the hierarchy separator. */
  name: string;
  system: SystemFolderLabel | null;
  /** Folders we never sync (virtual "All Mail"/"Flagged" views, non-selectable parents). */
  skip: boolean;
}

const SPECIAL_USE: Record<string, SystemFolderLabel | 'skip'> = {
  '\\SENT': 'SENT',
  '\\DRAFTS': 'DRAFT',
  '\\JUNK': 'SPAM',
  '\\TRASH': 'TRASH',
  '\\ARCHIVE': 'ARCHIVE',
  '\\ALL': 'skip',
  '\\FLAGGED': 'skip',
  '\\IMPORTANT': 'skip',
};

const NAME_HINTS: Record<SystemFolderLabel, string[]> = {
  INBOX: ['inbox'],
  SENT: [
    'sent',
    'sent items',
    'sent mail',
    'sent messages',
    'sent-mail',
    'gesendet',
    'gesendete elemente',
    'gesendete objekte',
    'envoyés',
    'éléments envoyés',
    'enviados',
    'elementos enviados',
    'posta inviata',
    'inviata',
    'verzonden',
    'verzonden items',
    'skickat',
    'отправленные',
  ],
  DRAFT: [
    'drafts',
    'draft',
    'entwürfe',
    'brouillons',
    'borradores',
    'bozze',
    'concepten',
    'черновики',
  ],
  SPAM: [
    'junk',
    'spam',
    'junk e-mail',
    'junk email',
    'junk mail',
    'bulk mail',
    'spamverdacht',
    'courrier indésirable',
    'спам',
  ],
  TRASH: [
    'trash',
    'deleted',
    'deleted items',
    'deleted messages',
    'bin',
    'papierkorb',
    'gelöschte elemente',
    'corbeille',
    'éléments supprimés',
    'papelera',
    'cestino',
    'prullenbak',
    'корзина',
  ],
  ARCHIVE: ['archive', 'archives', 'archiv', 'archivio', 'archivo', 'archief', 'архив'],
};

export const toBase64Url = (value: string) => {
  let binary = '';
  for (const byte of new TextEncoder().encode(value)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const fromBase64Url = (value: string) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '==='.slice((padded.length + 3) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
};

const USER_LABEL_PREFIX = 'F_';

/** URL-safe label id for a user folder. */
export const folderLabelId = (path: string) => `${USER_LABEL_PREFIX}${toBase64Url(path)}`;

export const folderPathFromLabelId = (labelId: string): string | null => {
  if (!labelId.startsWith(USER_LABEL_PREFIX)) return null;
  try {
    return fromBase64Url(labelId.slice(USER_LABEL_PREFIX.length));
  } catch {
    return null;
  }
};

const leafName = (entry: ListEntry) =>
  entry.delimiter ? (entry.path.split(entry.delimiter).at(-1) ?? entry.path) : entry.path;

const displayName = (entry: ListEntry) => {
  // Dovecot/Courier nest everything under INBOX ("INBOX.Work"); drop that prefix for display.
  let path = entry.path;
  if (entry.delimiter && path.toUpperCase().startsWith(`INBOX${entry.delimiter}`))
    path = path.slice(6);
  return entry.delimiter ? path.split(entry.delimiter).join('/') : path;
};

export const mapFolders = (entries: ListEntry[]): MappedFolder[] => {
  const assigned = new Map<SystemFolderLabel, string>();
  const flagsOf = (entry: ListEntry) => entry.flags.map((flag) => flag.toUpperCase());

  // INBOX is always the literal (case-insensitive) INBOX.
  for (const entry of entries) {
    if (entry.path.toUpperCase() === 'INBOX') assigned.set('INBOX', entry.path);
  }
  // SPECIAL-USE attributes.
  for (const entry of entries) {
    for (const flag of flagsOf(entry)) {
      const use = SPECIAL_USE[flag];
      if (use && use !== 'skip' && !assigned.has(use)) assigned.set(use, entry.path);
    }
  }
  // Name heuristics, top-level (or directly under INBOX) folders only.
  for (const label of SYSTEM_FOLDER_LABELS) {
    if (assigned.has(label)) continue;
    const hints = NAME_HINTS[label];
    const match = entries.find((entry) => {
      if (flagsOf(entry).some((f) => f === '\\NOSELECT' || f === '\\NONEXISTENT')) return false;
      if ([...assigned.values()].includes(entry.path)) return false;
      const depth = entry.delimiter ? entry.path.split(entry.delimiter).length : 1;
      const underInbox =
        entry.delimiter && entry.path.toUpperCase().startsWith(`INBOX${entry.delimiter}`);
      if (depth > (underInbox ? 2 : 1)) return false;
      return hints.includes(leafName(entry).toLowerCase());
    });
    if (match) assigned.set(label, match.path);
  }

  const systemByPath = new Map([...assigned].map(([label, path]) => [path, label]));
  return entries.map((entry) => {
    const flags = flagsOf(entry);
    const system = systemByPath.get(entry.path) ?? null;
    const skip =
      flags.includes('\\NOSELECT') ||
      flags.includes('\\NONEXISTENT') ||
      (!system && flags.some((flag) => SPECIAL_USE[flag] === 'skip'));
    return {
      path: entry.path,
      delimiter: entry.delimiter,
      labelId: system ?? folderLabelId(entry.path),
      name: system ? system : displayName(entry),
      system,
      skip,
    };
  });
};

/** Fixed sync priority: system folders first, then user folders alphabetically. */
export const folderSyncOrder = (folders: MappedFolder[]) => {
  const rank = (folder: MappedFolder) =>
    folder.system ? SYSTEM_FOLDER_LABELS.indexOf(folder.system) : SYSTEM_FOLDER_LABELS.length;
  return [...folders]
    .filter((folder) => !folder.skip)
    .sort((a, b) => rank(a) - rank(b) || a.path.localeCompare(b.path));
};
