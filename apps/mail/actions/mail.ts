"use server";
import { getActiveDriver } from "./utils";

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
  pageToken: string | undefined;
}) => {
  if (!folder) {
    throw new Error("Missing required fields");
  }

  try {
    const driver = await getActiveDriver();
    return await driver.list(folder, q, max, labelIds, pageToken);
  } catch (error) {
    console.error("Error getting threads:", error);
    throw error;
  }
};

export const getMail = async ({ id }: { id: string }) => {
  if (!id) {
    throw new Error("Missing required fields");
  }
  try {
    const driver = await getActiveDriver();
    return await driver.get(id);
  } catch (error) {
    console.error("Error getting mail:", error);
    throw error;
  }
};

export const markAsRead = async ({ ids }: { ids: string[] }) => {
  try {
    const driver = await getActiveDriver();
    await driver.markAsRead(ids);
    return { success: true };
  } catch (error) {
    console.error("Error marking message as read:", error);
    return { success: false };
  }
};

export const markAsUnread = async ({ ids }: { ids: string[] }) => {
  try {
    const driver = await getActiveDriver();
    await driver.markAsUnread(ids);
    return { success: true };
  } catch (error) {
    console.error("Error marking message as unread:", error);
    return { success: false };
  }
};

export const mailCount = async () => {
  try {
    const driver = await getActiveDriver();
    return await driver.count();
  } catch (error) {
    console.error("Error getting mail count:", error);
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
  console.log(`Adding labels: ${addLabels.join(", ")}`);
  console.log(`Removing labels: ${removeLabels.join(", ")}`);

  try {
    const driver = await getActiveDriver();
    const { threadIds } = driver.normalizeIds(threadId);

    if (threadIds.length) {
      await driver.modifyLabels(threadIds, {
        addLabels,
        removeLabels,
      });
      console.log("Server: Successfully updated thread labels");
      return { success: true };
    }

    console.log("Server: No label changes specified");
    return { success: false, error: "No label changes specified" };
  } catch (error) {
    console.error("Server: Error updating thread labels:", error);
    return { success: false, error: String(error) };
  }
};
