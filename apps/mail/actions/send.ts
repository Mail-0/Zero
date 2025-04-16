"use server";

import { createDriver } from "@/app/api/driver";
import { Sender } from "@/types";
import { getActiveConnection } from "./utils";

export async function sendEmail({
  to,
  subject,
  message,
  attachments,
  bcc,
  cc,
  headers: additionalHeaders = {},
  threadId
}: {
  to: Sender[];
  subject: string;
  message: string;
  attachments: File[];
  headers?: Record<string, string>;
  cc?: Sender[];
  bcc?: Sender[];
  threadId?: string
}) {
  if (!to || !subject || !message) {
    throw new Error("Missing required fields");
  }

  console.log(additionalHeaders)

  const connection = await getActiveConnection()

  if (!connection?.accessToken || !connection.refreshToken) {
    throw new Error("Unauthorized, reconnect");
  }

  const driver = await createDriver(connection.providerId, {
    auth: {
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken,
      email: connection.email
    },
  });

  await driver.create({
    subject,
    to,
    message,
    attachments,
    headers: additionalHeaders,
    cc,
    bcc,
    threadId
  });

  return { success: true };
}
