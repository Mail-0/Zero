'use server';

import { throwUnauthorizedGracefully } from '@/app/api/utils';
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
}) {
  if (!to || !subject || !message) {
    throw new Error('Missing required fields');
  }

  const connection = await getActiveConnection();

  if (!connection?.accessToken || !connection.refreshToken) {
    return throwUnauthorizedGracefully();
  }

  const driver = await createDriver(connection.providerId, {
    auth: {
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken,
      email: connection.email,
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
    threadId,
    fromEmail,
  });

  return { success: true };
}
