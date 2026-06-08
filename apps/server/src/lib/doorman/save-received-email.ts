import { createDb } from '../../db';
import {
  email as emailTable,
  mailbox as mailboxTable,
  mimeContent as mimeContentTable,
} from '../../db/schema';
import { env } from '../../env';
import type { DoormanReceivedEmailPayload } from './received-email.types';

export async function saveDoormanReceivedEmail(payload: DoormanReceivedEmailPayload) {
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);

  try {
    await db
      .insert(mailboxTable)
      .values(payload.mailbox)
      .onConflictDoUpdate({
        target: [mailboxTable.mailboxId],
        set: {
          userId: payload.mailbox.userId,
          mailboxName: payload.mailbox.mailboxName,
        },
      });

    await db
      .insert(emailTable)
      .values(payload.email)
      .onConflictDoUpdate({
        target: [emailTable.emailId],
        set: {
          date: payload.email.date,
          from: payload.email.from,
          sender: payload.email.sender,
          receiver: payload.email.receiver,
          replyTo: payload.email.replyTo,
          to: payload.email.to,
          cc: payload.email.cc,
          bcc: payload.email.bcc,
          subject: payload.email.subject,
          body: payload.email.body,
          messageId: payload.email.messageId,
          inReplyTo: payload.email.inReplyTo,
          mailboxId: payload.email.mailboxId,
          categoryId: payload.email.categoryId,
          priorityScore: payload.email.priorityScore,
          metadata: payload.email.metadata,
        },
      });

    await db
      .insert(mimeContentTable)
      .values(payload.mimeContent)
      .onConflictDoUpdate({
        target: [mimeContentTable.id],
        set: {
          contentType: payload.mimeContent.contentType,
          charset: payload.mimeContent.charset,
          transferEncoding: payload.mimeContent.transferEncoding,
          disposition: payload.mimeContent.disposition,
          filename: payload.mimeContent.filename,
          contentId: payload.mimeContent.contentId,
          rawPayload: payload.mimeContent.rawPayload,
          decodedText: payload.mimeContent.decodedText,
        },
      });

    return {
      success: true,
      emailId: payload.email.emailId,
      mailboxId: payload.mailbox.mailboxId,
    };
  } finally {
    await conn.end();
  }
}
