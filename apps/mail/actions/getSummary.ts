'use server'
import { auth } from "@/lib/auth";
import { db } from "@zero/db";
import { connection, summary } from "@zero/db/schema";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

export const GetSummary = async (threadId: string) => {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session || !session.connectionId) {
        throw new Error("Unauthorized, reconnect");
    }

    const [_connection] = await db
        .select()
        .from(connection)
        .where(and(eq(connection.userId, session.user.id), eq(connection.id, session.connectionId)));

    if (!_connection) {
        throw new Error("Unauthorized, reconnect");
    }

    try {
        const [_summary] = await db
            .select()
            .from(summary)
            .where(and(eq(summary.messageId, threadId), eq(summary.connectionId, _connection.id),));

        return _summary?.content.startsWith('Unable') ? null : _summary ?? null
    } catch (error) {
        console.error("Error getting summary:", error);
        return null
    }

}