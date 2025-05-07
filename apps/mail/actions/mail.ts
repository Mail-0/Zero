'use server';
import { deleteActiveConnection, FatalErrors, getActiveDriver } from './utils';
import { IGetThreadResponse } from '@/app/api/driver/types';
import { ParsedMessage } from '@/types';

export const getMail = async ({ id }: { id: string }): Promise<IGetThreadResponse | null> => {
  try {
    const driver = await getActiveDriver();
    const mailData = await driver.get(id);
    return mailData;
  } catch (error) {
    console.error('Error getting mail:', error);
    throw error;
  }
};

export const markAsRead = async ({ ids }: { ids: string[] }) => {
  try {
    const driver = await getActiveDriver();
    await driver.markAsRead(ids);
    return { success: true };
  } catch (error) {
    console.error('Error marking message as read:', error);
    throw error;
  }
};

export const markAsUnread = async ({ ids }: { ids: string[] }) => {
  try {
    const driver = await getActiveDriver();
    await driver.markAsUnread(ids);
    return { success: true };
  } catch (error) {
    console.error('Error marking message as unread:', error);
    throw error;
  }
};

export const markAsImportant = async ({ ids }: { ids: string[] }) => {
  try {
    const driver = await getActiveDriver();
    await driver.modifyLabels(ids, { addLabels: ['IMPORTANT'], removeLabels: [] });
    return { success: true };
  } catch (error) {
    console.error('Error marking message as important:', error);
    throw error;
  }
};

export const modifyLabels = async ({
  threadId,
  addLabels = [],
  removeLabels = [],
}: {
  threadId: string[];
  addLabels?: string[];
  removeLabels?: string[];
}) => {
  console.log(`Server: updateThreadLabels called for thread ${threadId}`);
  console.log(`Adding labels: ${addLabels.join(', ')}`);
  console.log(`Removing labels: ${removeLabels.join(', ')}`);

  try {
    const driver = await getActiveDriver();
    const { threadIds } = driver.normalizeIds(threadId);

    if (threadIds.length) {
      await driver.modifyLabels(threadIds, {
        addLabels,
        removeLabels,
      });
      console.log('Server: Successfully updated thread labels');
      return { success: true };
    }

    console.log('Server: No label changes specified');
    return { success: false, error: 'No label changes specified' };
  } catch (error) {
    console.error('Error updating thread labels:', error);
    throw error;
  }
};

export const toggleStar = async ({ ids }: { ids: string[] }) => {
  try {
    const driver = await getActiveDriver();
    const { threadIds } = driver.normalizeIds(ids);

    if (!threadIds.length) {
      return { success: false, error: 'No thread IDs provided' };
    }

    const threadResults = await Promise.allSettled(threadIds.map((id) => driver.get(id)));

    let anyStarred = false;
    let processedThreads = 0;

    for (const result of threadResults) {
      if (result.status === 'fulfilled' && result.value && result.value.messages.length > 0) {
        processedThreads++;
        const isThreadStarred = result.value.messages.some((message: ParsedMessage) =>
          message.tags?.some((tag) => tag.name.toLowerCase().startsWith('starred')),
        );
        if (isThreadStarred) {
          anyStarred = true;
          break;
        }
      }
    }

    const shouldStar = processedThreads > 0 && !anyStarred;

    await driver.modifyLabels(threadIds, {
      addLabels: shouldStar ? ['STARRED'] : [],
      removeLabels: shouldStar ? [] : ['STARRED'],
    });

    return { success: true };
  } catch (error) {
    console.error('Error toggling star:', error);
    throw error;
  }
};

export const deleteThread = async ({ id }: { id: string }) => {
  console.log('Deleting thread:', id);
  try {
    const driver = await getActiveDriver();
    await driver.delete(id);
    return { success: true };
  } catch (error) {
    if (FatalErrors.includes((error as Error).message)) await deleteActiveConnection();
    console.error('Error deleting thread:', error);
    throw error;
  }
};

export const bulkDeleteThread = async ({ ids }: { ids: string[] }) => {
  try {
    const driver = await getActiveDriver();
    await driver.modifyLabels(ids, { addLabels: ['TRASH'], removeLabels: [] });
    return { success: true };
  } catch (error) {
    console.error('Error marking message as important:', error);
    throw error;
  }
};

export const bulkArchive = async ({ ids }: { ids: string[] }) => {
  try {
    const driver = await getActiveDriver();
    await driver.modifyLabels(ids, { addLabels: [], removeLabels: ['INBOX'] });
    return { success: true };
  } catch (error) {
    console.error('Error marking message as archived:', error);
    throw error;
  }
};

export const bulkStar = async ({ ids }: { ids: string[] }) => {
  try {
    const driver = await getActiveDriver();
    await driver.modifyLabels(ids, { addLabels: ['STARRED'], removeLabels: [] });
    return { success: true };
  } catch (error) {
    console.error('Error marking message as starred:', error);
    throw error;
  }
};

export const bulkUnstar = async ({ ids }: { ids: string[] }) => {
  try {
    const driver = await getActiveDriver();
    await driver.modifyLabels(ids, { addLabels: [], removeLabels: ['STARRED'] });
    return { success: true };
  } catch (error) {
    console.error('Error marking message as unstarred:', error);
    throw error;
  }
};

export const muteThread = async ({ ids }: { ids: string[] }) => {
  try {
    const driver = await getActiveDriver();
    await driver.modifyLabels(ids, { addLabels: ['MUTE'], removeLabels: [] });
    return { success: true };
  } catch (error) {
    console.error('Error marking message as muted:', error);
    throw error;
  }
};

export const checkSpamEmails = async () => {
  try {
    const driver = await getActiveDriver();
    
    // Get all emails from spam folder
    const spamEmails = await driver.list('spam');
    
    // Return count and whether there are any emails
    return { 
      hasEmails: !!spamEmails?.threads?.length,
      count: spamEmails?.threads?.length || 0
    };
  } catch (error) {
    console.error('Error checking spam emails:', error);
    return { hasEmails: false, count: 0 };
  }
};

export const deleteAllSpamEmails = async () => {
  try {
    const driver = await getActiveDriver();
    
    // Get all emails from spam folder
    const spamEmails = await driver.list('spam');
    console.log(spamEmails?.threads?.length);
    if (!spamEmails || !spamEmails.threads || spamEmails.threads.length === 0) {
      return { success: true, message: 'No spam emails to delete' };
    }
    
    // Extract email IDs
    const emailIds = spamEmails.threads.map((thread) => thread.id);
    
    // Use existing bulkDeleteThread function to move emails to trash
    await bulkDeleteThread({ ids: emailIds });
    
    return { 
      success: true, 
      message: `Successfully deleted ${emailIds.length} email(s) from spam folder` 
    };
  } catch (error) {
    console.error('Error deleting all spam emails:', error);
    throw error;
  }
};
