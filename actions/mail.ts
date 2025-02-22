"use server";

import { account, connection } from "@/db/schema";
import { createDriver } from "@/app/api/driver";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";

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
  pageToken: string;
}) => {
  if (!folder) {
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

  const [foundAccount] = await db.select().from(account).where(eq(account.userId, session.user.id));
  if (!foundAccount?.accessToken || !foundAccount.refreshToken) {
    throw new Error("Unauthorized, reconnect");
  }

  const driver = await createDriver(foundAccount.providerId, {
    auth: {
      access_token: foundAccount.accessToken,
      refresh_token: foundAccount.refreshToken,
    },
  });

  return await driver.count();
};
