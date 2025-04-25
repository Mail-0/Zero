'use server';

import { createDriver } from '@/app/api/driver';
import { getActiveConnection } from './utils';
import { Sender } from '@/types';

export async function sendEmail({
  to,
  subject,
  message,
  attachments,
  bcc,
  cc,
  headers: additionalHeaders = {},
  threadId,
  fromEmail,
  draftId,
}: {
  to: Sender[];
  subject: string;
  message: string;
  attachments: File[];
  headers?: Record<string, string>;
  cc?: Sender[];
  bcc?: Sender[];
  threadId?: string;
  fromEmail?: string;
  draftId?: string;
}) {
  if (!to || !subject || !message) {
    throw new Error('Missing required fields');
  }

  const connection = await getActiveConnection();

  if (!connection?.accessToken || !connection.refreshToken) {
    return null;
  }

  const driver = await createDriver(connection.providerId, {
    auth: {
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken,
      email: connection.email,
    },
  });

  const emailData = {
    subject,
    to,
    message,
    attachments,
    headers: additionalHeaders,
    cc,
    bcc,
    threadId,
    fromEmail,
  };

  if (draftId) {
    await driver.sendDraft(draftId, emailData);
  } else {
    await driver.create(emailData);
  }

  return { success: true };
}
