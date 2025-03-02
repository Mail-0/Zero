"use server";

import { account, connection } from "@zero/db/schema";
import { createDriver } from "@/app/api/driver";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@zero/db";

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

  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session || !session.connectionId) {
    throw new Error("Unauthorized, reconnect");
  }

  const [_connection] = await db
    .select()
    .from(connection)
    .where(and(eq(connection.userId, session.user.id), eq(connection.id, session.connectionId)));

  if (!_connection?.accessToken || !_connection.refreshToken) {
    throw new Error("Unauthorized, reconnect");
  }

  const driver = await createDriver(_connection.providerId, {
    auth: {
      access_token: _connection.accessToken,
      refresh_token: _connection.refreshToken,
    },
  });

  return await driver.list(folder, q, max, labelIds, pageToken);
};

export const getMail = async ({ id }: { id: string }) => {
  if (!id) {
    throw new Error("Missing required fields");
  }

  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session || !session.connectionId) {
    throw new Error("Unauthorized, reconnect");
  }

  // Updated to use googleConnection table
  const [_connection] = await db
    .select()
    .from(connection)
    .where(and(eq(connection.userId, session.user.id), eq(connection.id, session.connectionId)));

  if (!_connection?.accessToken || !_connection.refreshToken) {
    throw new Error("Unauthorized, reconnect");
  }

  const driver = await createDriver(_connection.providerId, {
    // Assuming "google" is the provider ID
    auth: {
      access_token: _connection.accessToken,
      refresh_token: _connection.refreshToken,
    },
  });

  return await driver.get(id);
};

export const markAsRead = async ({ id }: { id: string }) => {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session || !session.connectionId) {
    throw new Error("Unauthorized, reconnect");
  }

  const [_connection] = await db
    .select()
    .from(connection)
    .where(and(eq(connection.userId, session.user.id), eq(connection.id, session.connectionId)));

  if (!_connection?.accessToken || !_connection.refreshToken) {
    throw new Error("Unauthorized, reconnect");
  }

  const driver = await createDriver(_connection.providerId, {
    // Assuming "google" is the provider ID
    auth: {
      access_token: _connection.accessToken,
      refresh_token: _connection.refreshToken,
    },
  });

  try {
    await driver.markAsRead(id);
  } catch (error) {
    console.error("Error marking message as read:", error);
  }
};

export const mailCount = async () => {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session || !session.connectionId) {
    throw new Error("Unauthorized, reconnect");
  }

  const [_connection] = await db
    .select()
    .from(connection)
    .where(and(eq(connection.userId, session.user.id), eq(connection.id, session.connectionId)));

  if (!_connection?.accessToken || !_connection.refreshToken) {
    throw new Error("Unauthorized, reconnect");
  }

  const driver = await createDriver(_connection.providerId, {
    auth: {
      access_token: _connection.accessToken,
      refresh_token: _connection.refreshToken,
    },
  });

  return await driver.count();
};

export const updateLabels = async ({
  emailId,
  addLabels = [],
  removeLabels = []
}: {
  emailId: string;
  addLabels?: string[];
  removeLabels?: string[];
}) => {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session || !session.connectionId) {
    throw new Error("Unauthorized, reconnect");
  }

  const [_connection] = await db
    .select()
    .from(connection)
    .where(and(eq(connection.userId, session.user.id), eq(connection.id, session.connectionId)));

  if (!_connection?.accessToken || !_connection.refreshToken) {
    throw new Error("Unauthorized, reconnect");
  }

  const driver = await createDriver(_connection.providerId, {
    auth: {
      access_token: _connection.accessToken,
      refresh_token: _connection.refreshToken,
    },
  });

  try {
    const normalizedId = driver.normalizeId(emailId);
    
    if (addLabels.length > 0 || removeLabels.length > 0) {
      await driver.modifyLabels(normalizedId, {
        addLabels,
        removeLabels
      });
      return { success: true };
    }
    
    return { success: false, error: "No label changes specified" };
  } catch (error) {
    console.error("Error updating labels:", error);
    return { success: false, error: String(error) };
  }
};

export const updateThreadLabels = async ({
  threadId,
  addLabels = [],
  removeLabels = []
}: {
  threadId: string;
  addLabels?: string[];
  removeLabels?: string[];
}) => {
  console.log(`Server: updateThreadLabels called for thread ${threadId}`);
  console.log(`Adding labels: ${addLabels.join(', ')}`);
  console.log(`Removing labels: ${removeLabels.join(', ')}`);
  
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session || !session.connectionId) {
    console.error("Server: Unauthorized, no valid session");
    throw new Error("Unauthorized, reconnect");
  }

  const [_connection] = await db
    .select()
    .from(connection)
    .where(and(eq(connection.userId, session.user.id), eq(connection.id, session.connectionId)));

  if (!_connection?.accessToken || !_connection.refreshToken) {
    console.error("Server: Unauthorized, missing tokens");
    throw new Error("Unauthorized, reconnect");
  }

  const driver = await createDriver(_connection.providerId, {
    auth: {
      access_token: _connection.accessToken,
      refresh_token: _connection.refreshToken,
    },
  });

  try {
    const normalizedId = driver.normalizeId(threadId);
    
    if (addLabels.length > 0 || removeLabels.length > 0) {
      await driver.modifyThreadLabels(normalizedId, {
        addLabels,
        removeLabels
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

export const batchUpdateLabels = async ({
  messageIds,
  addLabels = [],
  removeLabels = []
}: {
  messageIds: string[];
  addLabels?: string[];
  removeLabels?: string[];
}) => {
  console.log(`Server: batchUpdateLabels called for ${messageIds.length} messages`);
  console.log(`Adding labels: ${addLabels.join(', ')}`);
  console.log(`Removing labels: ${removeLabels.join(', ')}`);
  
  if (!messageIds.length) {
    console.log("Server: No message IDs provided");
    return { success: false, error: "No message IDs provided" };
  }
  
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session || !session.connectionId) {
    console.error("Server: Unauthorized, no valid session");
    throw new Error("Unauthorized, reconnect");
  }

  const [_connection] = await db
    .select()
    .from(connection)
    .where(and(eq(connection.userId, session.user.id), eq(connection.id, session.connectionId)));

  if (!_connection?.accessToken || !_connection.refreshToken) {
    console.error("Server: Unauthorized, missing tokens");
    throw new Error("Unauthorized, reconnect");
  }

  const driver = await createDriver(_connection.providerId, {
    auth: {
      access_token: _connection.accessToken,
      refresh_token: _connection.refreshToken,
    },
  });

  try {
    const { normalizedIds, threadIds } = driver.normalizeIds(messageIds);
    
    if (normalizedIds.length > 0) {
      console.log(`Server: Batch updating ${normalizedIds.length} messages`);
      if (addLabels.length > 0 || removeLabels.length > 0) {
        await driver.batchModifyLabels(normalizedIds, {
          addLabels,
          removeLabels
        });
      }
    }
    
    if (threadIds.length > 0) {
      console.log(`Server: Processing ${threadIds.length} threads`);
      await Promise.all(threadIds.map(async (threadId) => {
        if (addLabels.length > 0 || removeLabels.length > 0) {
          await driver.modifyThreadLabels(threadId, {
            addLabels,
            removeLabels
          });
        }
      }));
    }
    
    console.log("Server: Successfully updated all labels");
    return { success: true };
  } catch (error) {
    console.error("Server: Error batch updating labels:", error);
    return { success: false, error: String(error) };
  }
};
