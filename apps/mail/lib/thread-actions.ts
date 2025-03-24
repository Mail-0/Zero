import { modifyLabels } from '@/actions/mail';
import { LABELS, FOLDERS } from '@/lib/utils';

export type ThreadDestination = 'inbox' | 'archive' | 'spam' | null;
export type FolderLocation = 'inbox' | 'archive' | 'spam' | 'sent' | string;

interface MoveThreadOptions {
  threadIds: string[];
  currentFolder: FolderLocation;
  destination: ThreadDestination;
}

export function isActionAvailable(folder: FolderLocation, action: ThreadDestination): boolean {
  if (!action) return false;

  const pattern = `${folder}_to_${action}`;

  switch (pattern) {
    // From inbox rules
    case `${FOLDERS.INBOX}_to_spam`:
      return true;
    case `${FOLDERS.INBOX}_to_archive`:
      return true;

    // From archive rules
    case `${FOLDERS.ARCHIVE}_to_inbox`:
      return true;

    // From spam rules
    case `${FOLDERS.SPAM}_to_inbox`:
      return true;

    default:
      return false;
  }
}

export function getAvailableActions(folder: FolderLocation): ThreadDestination[] {
  const allPossibleActions: ThreadDestination[] = ['inbox', 'archive', 'spam'];
  return allPossibleActions.filter(action => isActionAvailable(folder, action));
}

export async function moveThreadsTo({
  threadIds,
  currentFolder,
  destination,
}: MoveThreadOptions) {
  try {
    if (!threadIds.length) return;
    const isInInbox = currentFolder === FOLDERS.INBOX || !currentFolder;
    const isInSpam = currentFolder === FOLDERS.SPAM;

    let addLabel = '';
    let removeLabel = '';

    switch(destination) {
      case 'inbox':
        addLabel = LABELS.INBOX;
        removeLabel = isInSpam ? LABELS.SPAM : '';
        break;
      case 'archive':
        removeLabel = isInInbox ? LABELS.INBOX : (isInSpam ? LABELS.SPAM : '');
        break;
      case 'spam':
        addLabel = LABELS.SPAM;
        removeLabel = isInInbox ? LABELS.INBOX : '';
        break;
      default:
        break;
    }

    return modifyLabels({
      threadId: threadIds,
      addLabels: addLabel ? [addLabel] : [],
      removeLabels: removeLabel ? [removeLabel] : [],
    })
  } catch (error) {
    console.error(`Error moving thread(s):`, error);
    throw error;
  }
}
