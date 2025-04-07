'use server';
import { deleteActiveConnection, FatalErrors, getActiveDriver } from './utils';

export const getMails = async ({
  folder,
  q,
  max,
  labelIds,
  pageToken,
}: {
  folder: string;
  q?: string;
  max?: number;
  labelIds?: string[];
  pageToken: string | number | undefined;
}) => {
  if (!folder) {
    throw new Error('Missing required fields');
  }

  try {
    const driver = await getActiveDriver();
    return await driver.list(folder, q, max, labelIds, pageToken);
  } catch (error) {
    if (FatalErrors.includes((error as Error).message)) await deleteActiveConnection();
    console.error('Error getting threads:', error);
    throw error;
  }
};

export const getMail = async ({ id }: { id: string }) => {
  if (!id) {
    throw new Error('Missing required fields');
  }
  try {
    const driver = await getActiveDriver();
    return await driver.get(id);
  } catch (error) {
    if (FatalErrors.includes((error as Error).message)) await deleteActiveConnection();
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
    if (FatalErrors.includes((error as Error).message)) await deleteActiveConnection();
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
    if (FatalErrors.includes((error as Error).message)) await deleteActiveConnection();
    console.error('Error marking message as unread:', error);
    throw error;
  }
};

export const mailCount = async () => {
  try {
    const driver = await getActiveDriver();
    return await driver.count();
  } catch (error) {
    if (FatalErrors.includes((error as Error).message)) await deleteActiveConnection();
    console.error('Error getting mail count:', error);
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
    if (FatalErrors.includes((error as Error).message)) await deleteActiveConnection();
    console.error('Server: Error updating thread labels:', error);
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

    const threadResults = await Promise.allSettled(
      threadIds.map(id => driver.get(id))
    );

    let allStarred = true;
    let anyValid = false;

    for (const result of threadResults) {
      if (result.status === 'fulfilled' && result.value?.[0]) {
        anyValid = true;
        if (!result.value[0].tags?.includes('STARRED')) {
          allStarred = false;
          break;
        }
      }
    }

    const shouldStar = !anyValid || !allStarred;

    await driver.modifyLabels(threadIds, {
      addLabels: shouldStar ? ['STARRED'] : [],
      removeLabels: shouldStar ? [] : ['STARRED'],
    });

    return { success: true };
  } catch (error) {
    if (FatalErrors.includes((error as Error).message)) await deleteActiveConnection();
    console.error('Error toggling star:', error);
    throw error;
  }
};
