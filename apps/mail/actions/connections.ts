"use server";

import { connection, user } from "@zero/db/schema";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { type IConnection } from "@/types";
import { auth } from "@/lib/auth";
import { db } from "@zero/db";

export async function getConnections() {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session) {
      throw new Error("Unauthorized, reconnect");
    }

    const userId = session?.user?.id;

    if (!userId) {
      throw new Error("Unauthorized, reconnect");
    }

    const connections = (await db
      .select({
        id: connection.id,
        email: connection.email,
        name: connection.name,
        picture: connection.picture,
        createdAt: connection.createdAt,
      })
      .from(connection)
      .where(eq(connection.userId, userId))) as IConnection[];

    return connections;
  } catch (error) {
    console.error("Failed to fetch connections:", error);
    throw new Error("Failed to fetch connections");
  }
}

export async function deleteConnection(connectionId: string) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session) {
      throw new Error("Unauthorized, reconnect");
    }

    const userId = session?.user?.id;

    if (!userId) {
      throw new Error("Unauthorized, reconnect");
    }

    await db
      .delete(connection)
      .where(and(eq(connection.id, connectionId), eq(connection.userId, userId)));

    if (connectionId === session?.connectionId) {
      await db.update(user).set({
        defaultConnectionId: null,
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to delete connection:", error);
    throw new Error("Failed to delete connection");
  }
}

export async function putConnection(connectionId: string) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session) {
      throw new Error("Unauthorized, reconnect");
    }

    const userId = session?.user?.id;

    if (!userId) {
      throw new Error("Unauthorized, reconnect");
    }

    const [foundConnection] = await db
      .select()
      .from(connection)
      .where(and(eq(connection.id, connectionId), eq(connection.userId, userId)))
      .limit(1);

    if (!foundConnection) {
      throw new Error("Connection not found");
    }

    await db
      .update(user)
      .set({
        defaultConnectionId: connectionId,
      })
      .where(eq(user.id, userId));

    return { success: true };
  } catch (error) {
    console.error("Failed to update connection:", error);
    throw new Error("Failed to update connection");
  }
}
