"use server";

import { createDriver } from "@/app/api/driver";
import { connection } from "@zero/db/schema";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@zero/db";

export async function sendEmail({
  to,
  subject,
  message,
  attachments,
  headers: additionalHeaders = {},
}: {
  to: string;
  subject: string;
  message: string;
  attachments: File[];
  headers?: Record<string, string>;
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
    },
  });

  const fromName = _connection.name || session.user.name || "Unknown";
  const fromEmail = _connection.email || session.user.email;
  const fromHeader = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const domain = fromEmail.split("@")[1];
  const randomPart = Math.random().toString(36).substring(2);
  const timestamp = Date.now();
  const messageId = `<${timestamp}.${randomPart}.mail0@${domain}>`;

  const date = new Date().toUTCString();
  const boundary = `----=_NextPart_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;

  // Start building email content
  const emailParts = [
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "MIME-Version: 1.0",
    `Date: ${date}`,
    `Message-ID: ${messageId}`,
    `From: ${fromHeader}`,
    `To: ${to
      .split(",")
      .map((ref) => (ref.startsWith("<") ? ref : `<${ref}>`))
      .join(", ")}`,
    `Subject: ${subject}`,

    // Add threading headers if present
    ...(additionalHeaders["In-Reply-To"]
      ? [
          `In-Reply-To: ${additionalHeaders["In-Reply-To"]
            .split(" ")
            .filter(Boolean)
            .map((ref) => (ref.startsWith("<") ? ref : `<${ref}>`))
            .join(" ")}`,
        ]
      : []),
    ...(additionalHeaders["References"]
      ? [
          `References: ${additionalHeaders["References"]
            .split(" ")
            .filter(Boolean)
            .map((ref) => (ref.startsWith("<") ? ref : `<${ref}>`))
            .join(" ")}`,
        ]
      : []),

    // Security headers
    "X-Mailer: Mail0",
    `X-Originating-IP: [PRIVATE]`,
    `X-Priority: 3`,
    `X-MSMail-Priority: Normal`,
    `Importance: Normal`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    message.trim(),
  ];

  // Process attachments if any
  if (attachments?.length > 0) {
    for (const file of attachments) {
      // Convert File to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Content = buffer.toString("base64");

      emailParts.push(
        `--${boundary}`,
        `Content-Type: ${file.type || "application/octet-stream"}`,
        `Content-Transfer-Encoding: base64`,
        `Content-Disposition: attachment; filename="${file.name}"`,
        "",
        base64Content.match(/.{1,76}/g)?.join("\n") || base64Content,
      );
    }
  }

  // Add final boundary
  emailParts.push(`--${boundary}--`);

  // Join all parts with CRLF
  const emailContent = emailParts.join("\r\n");

  const encodedMessage = Buffer.from(emailContent).toString("base64");

  await driver.create({
    raw: encodedMessage,
  });

  return { success: true };
}
