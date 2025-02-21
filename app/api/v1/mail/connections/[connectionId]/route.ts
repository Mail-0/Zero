import { NextRequest, NextResponse } from "next/server";
import { connection, user } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { connectionId } = await params;

    await db
      .delete(connection)
      .where(and(eq(connection.id, connectionId), eq(connection.userId, userId)));

    const [remainingConnection] = await db
      .select()
      .from(connection)
      .where(eq(connection.userId, userId))
      .limit(1);

    if (remainingConnection) {
      await db
        .update(user)
        .set({
          defaultConnectionId: remainingConnection.id,
        })
        .where(eq(user.id, userId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete connection:", error);
    return NextResponse.json({ error: "Failed to delete connection" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { connectionId } = await params;

    const [foundConnection] = await db
      .select()
      .from(connection)
      .where(and(eq(connection.id, connectionId), eq(connection.userId, userId)))
      .limit(1);

    if (!foundConnection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    await db
      .update(user)
      .set({
        defaultConnectionId: connectionId,
      })
      .where(eq(user.id, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update connection:", error);
    return NextResponse.json({ error: "Failed to update connection" }, { status: 500 });
  }
}
