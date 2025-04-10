"use server";

import { createDriver } from "@/app/api/driver";
import { connection } from "@zero/db/schema";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@zero/db";
import { Sender } from "@/types";

export async function sendEmail({
  to,
  subject,
  message,
  attachments,
  bcc,
  cc,
  headers: additionalHeaders = {},
}: {
    to: Sender[];
  subject: string;
  message: string;
  attachments: File[];
    headers?: Record<string, string>;
    cc?: Sender[];
    bcc?: Sender[];
}) {
  if (!to || !subject || !message) {
    throw new Error("Missing required fields");
  }

  const headersList = await headers();

  const session = await auth.api.getSession({ headers: headersList });
  if (!session?.user) throw new Error("Unauthorized");

  const [_connection] = await db
    .select()
    .from(connection)
    .where(eq(connection.userId, session.user.id))
    .orderBy(connection.createdAt);

  if (!_connection?.accessToken || !_connection.refreshToken) {
    throw new Error("Unauthorized, reconnect");
  }

  const driver = await createDriver(_connection.providerId, {
    auth: {
      access_token: _connection.accessToken,
      refresh_token: _connection.refreshToken,
      email: _connection.email
    },
  });

  await driver.create({
    subject,
    to,
    message,
    attachments,
    headers: additionalHeaders,
    cc,
    bcc
  });

  return { success: true };
}
