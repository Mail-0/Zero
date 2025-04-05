'use server'
import { auth } from "@/lib/auth";
import { db } from "@zero/db";
import { connection } from "@zero/db/schema";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import axios from "axios";

export const EnableBrain = async () => {
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

		if (!process.env.BRAIN_URL) {
			throw new Error('Brain URL not found');
		}

    return await axios.put(process.env.BRAIN_URL + `/subscribe/${_connection.providerId}`, {
        connectionId: _connection.id,
    })
}
