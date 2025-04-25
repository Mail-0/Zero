'use server';
import { deleteActiveConnection, FatalErrors, getActiveDriver } from './utils';
import { IGetThreadResponse } from '@/app/api/driver/types';
import { ParsedMessage } from '@/types';

export const getMail = async ({ id }: { id: string }): Promise<IGetThreadResponse | null> => {
  if (!id) {
    throw new Error('Missing required fields');
  }
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
          message.tags?.find((tag) => tag.startsWith('STARRED')),
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
