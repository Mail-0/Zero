'use server';
import { deleteActiveConnection, FatalErrors, getActiveDriver } from './utils';
import { getConnections } from './connections';

export const getMails = async ({
  folder,
  q,
  max,
  labelIds,
  pageToken,
  connectionId,
  unifiedInbox = false,
}: {
  folder: string;
  q?: string;
  max?: number;
  labelIds?: string[];
  pageToken: string | undefined;
  connectionId?: string;
  unifiedInbox?: boolean;
}) => {
  if (!folder) {
    throw new Error('Missing required fields');
  }

  try {
    // Unified inbox: fetch emails from all connections
    if (unifiedInbox) {
      const connections = await getConnections();

      // If no connections or only one, fall back to normal behavior
      if (!connections || connections.length <= 1) {
        const driver = await getActiveDriver();
        return await driver.list(folder, q, max, labelIds, pageToken);
      }

      // Fetch emails from each connection and merge them
      const results = await Promise.all(
        connections.map(async (conn) => {
          try {
            const driver = await getActiveDriver(conn.id);
            const result = await driver.list(folder, q, max, labelIds, pageToken);

            // Add connection info to each email thread
            if (result && result.threads) {
              result.threads = result.threads.map((thread) => ({
                ...thread,
                connectionId: conn.id,
                connectionEmail: conn.email,
                connectionName: conn.name || conn.email,
              }));
            }

            return result;
          } catch (error) {
            console.error(`Error fetching mails from connection ${conn.id}:`, error);
            return { threads: [], nextPageToken: undefined, resultSizeEstimate: 0 };
          }
        }),
      );

      // Merge results from all connections
      const mergedThreads = results.flatMap((result) => result?.threads || []);

      return {
        threads: mergedThreads,
        nextPageToken: undefined, // Pagination is more complex in unified mode
        resultSizeEstimate: mergedThreads.length,
      };
    }

    // Normal single-connection behavior
    const driver = await getActiveDriver(connectionId);
    return await driver.list(folder, q, max, labelIds, pageToken);
  } catch (error) {
    if (FatalErrors.includes((error as Error).message)) await deleteActiveConnection();
    console.error('Error getting threads:', error);
    throw error;
  }
};

export const getMail = async ({ id, connectionId }: { id: string; connectionId?: string }) => {
  if (!id) {
    throw new Error('Missing required fields');
  }
  try {
    const driver = await getActiveDriver(connectionId);
    return await driver.get(id);
  } catch (error) {
    if (FatalErrors.includes((error as Error).message)) await deleteActiveConnection();
    console.error('Error getting mail:', error);
    throw error;
  }
};

export const markAsRead = async ({
  ids,
  connectionId,
}: {
  ids: string[];
  connectionId?: string;
}) => {
  try {
    const driver = await getActiveDriver(connectionId);
    await driver.markAsRead(ids);
    return { success: true };
  } catch (error) {
    if (FatalErrors.includes((error as Error).message)) await deleteActiveConnection();
    console.error('Error marking message as read:', error);
    throw error;
  }
};

export const markAsUnread = async ({
  ids,
  connectionId,
}: {
  ids: string[];
  connectionId?: string;
}) => {
  try {
    const driver = await getActiveDriver(connectionId);
    await driver.markAsUnread(ids);
    return { success: true };
  } catch (error) {
    if (FatalErrors.includes((error as Error).message)) await deleteActiveConnection();
    console.error('Error marking message as unread:', error);
    throw error;
  }
};

export const mailCount = async ({ connectionId }: { connectionId?: string } = {}) => {
  try {
    const driver = await getActiveDriver(connectionId);
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
  connectionId,
}: {
  threadId: string[];
  addLabels?: string[];
  removeLabels?: string[];
  connectionId?: string;
}) => {
  console.log(`Server: updateThreadLabels called for thread ${threadId}`);
  console.log(`Adding labels: ${addLabels.join(', ')}`);
  console.log(`Removing labels: ${removeLabels.join(', ')}`);

  try {
    const driver = await getActiveDriver(connectionId);
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
