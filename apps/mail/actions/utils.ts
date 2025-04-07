import { connection } from "@zero/db/schema";
import { createDriver } from "@/app/api/driver";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@zero/db";
import { revalidatePath } from "next/cache";

export const FatalErrors = ['invalid_grant']

export const deleteActiveConnection = async () => {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });
    if (!session || !session.connectionId) {
        console.error("Server: Unauthorized, no valid session");
        throw new Error("Unauthorized, reconnect");
    }

    try {
        await db.delete(connection).where(and(eq(connection.userId, session.user.id), eq(connection.id, session.connectionId)));
        console.log("Server: Successfully deleted connection, please reload");
        return revalidatePath('/mail')
    } catch (error) {
        console.error("Server: Error deleting connection:", error);
        throw error;
    }
}

export const getActiveDriver = async () => {
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

    if (!_connection) {
        throw new Error("Unauthorized, reconnect");
    }

    if (!_connection.accessToken || !_connection.refreshToken) {
        throw new Error("Unauthorized, reconnect");
    }

    const driver = await createDriver(_connection.providerId, {
        auth: {
            access_token: _connection.accessToken,
            refresh_token: _connection.refreshToken,
            email: _connection.email
        },
    });

    return driver
}