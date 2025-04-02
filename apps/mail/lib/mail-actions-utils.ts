import { moveThreadsTo, ThreadDestination } from '@/lib/thread-actions';
import { markAsRead, markAsUnread } from '@/actions/mail';
import { FOLDERS, LABELS } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * Shared mail action utilities for use in components
 * This file centralizes logic shared between command-palette-context.tsx and mail-quick-actions.tsx
 */

// Find a button in the DOM by various selectors
export const findButton = (selectors: string[]): HTMLElement | null => {
  for (const selector of selectors) {
    const button = document.querySelector(selector);
    if (button instanceof HTMLElement) return button;
  }
  return null;
};

// Helper to create a mail action event
export const dispatchMailAction = (
  action: string,
  threadId: string,
  previousFolder: string,
  currentFolder: string
) => {
  // Dispatch the general mail:action event for tracking
  const actionEvent = new CustomEvent('mail:action', {
    detail: { action, threadId, previousFolder, currentFolder },
  });
  window.dispatchEvent(actionEvent);
  
  // Also dispatch a specific event for the action
  const specificEvent = new CustomEvent(`mail:${action}`, {
    detail: { threadId, previousFolder, currentFolder },
  });
  window.dispatchEvent(specificEvent);
};

// Helper to handle undo operations
export const handleUndo = async ({
  lastAction,
  onSuccess,
  t, // translation function
}: {
  lastAction: {
    action: string;
    threadId?: string | string[];
    previousFolder?: string;
    currentFolder?: string;
  } | null;
  onSuccess: () => Promise<void>;
  t: (key: string) => string;
}) => {
  if (!lastAction) {
    toast.info(t('common.mail.nothingToUndo'));
    return;
  }
  
  const { threadId, previousFolder, currentFolder } = lastAction;
  
  if (threadId && previousFolder) {
    // Dispatch undo event
    const event = new CustomEvent('mail:undo', {
      detail: { 
        threadIds: Array.isArray(threadId) ? threadId : [threadId], 
        currentFolder,
        destination: previousFolder as ThreadDestination
      },
    });
    window.dispatchEvent(event);
    
    // Show success toast
    toast.success(t('common.mail.undoSuccess'));
    
    // Execute callback for UI updates
    await onSuccess();
  }
};

// Move thread to a different folder
export const moveThread = async ({
  threadId,
  currentFolder,
  destination,
  onSuccess,
  t,
}: {
  threadId: string;
  currentFolder: string;
  destination: ThreadDestination;
  onSuccess: () => Promise<void>;
  t: (key: string) => string;
}) => {
  try {
    // Determine action type
    let actionType = 'move';
    if (destination === 'trash') actionType = 'delete';
    else if (destination === 'archive') actionType = 'archive';
    else if (destination === 'inbox' && currentFolder === 'archive') actionType = 'unarchive';
    
    // Create formatted threadId
    const formattedThreadId = threadId.startsWith('thread:') ? threadId : `thread:${threadId}`;
    
    // Record action for undo capability
    dispatchMailAction(actionType, threadId, currentFolder, destination);
    
    // Execute the move operation
    await moveThreadsTo({
      threadIds: [formattedThreadId],
      currentFolder,
      destination,
    });
    
    // Show appropriate toast
    let toastMessage = t('common.mail.moved');
    if (actionType === 'delete') toastMessage = t('common.mail.moveToTrash');
    else if (actionType === 'archive') toastMessage = t('common.mail.archive');
    else if (actionType === 'unarchive') toastMessage = t('common.mail.unarchive');
    
    toast.success(toastMessage, {
      description: 'Press ⌘⇧T to undo'
    });
    
    // Execute callback for UI updates
    await onSuccess();
    
  } catch (error) {
    console.error(`Error moving thread to ${destination}:`, error);
    toast.error(t('common.mail.errorMoving'));
  }
};

// Toggle read/unread status
export const toggleReadStatus = async ({
  threadId,
  isUnread,
  onSuccess,
  t,
}: {
  threadId: string;
  isUnread: boolean;
  onSuccess: () => Promise<void>;
  t: (key: string) => string;
}) => {
  try {
    if (isUnread) {
      const response = await markAsRead({ ids: [threadId] });
      if (response.success) {
        toast.success(t('common.mail.markedAsRead'));
        await onSuccess();
      } else {
        toast.error(t('common.mail.failedToMarkAsRead'));
      }
    } else {
      const response = await markAsUnread({ ids: [threadId] });
      if (response.success) {
        toast.success(t('common.mail.markedAsUnread'));
        await onSuccess();
      } else {
        toast.error(t('common.mail.failedToMarkAsUnread'));
      }
    }
  } catch (error) {
    console.error('Error toggling read status:', error);
    toast.error(t('common.mail.errorProcessing'));
  }
};