'use server';

import { createDriver } from '@/app/api/driver';
import { getActiveConnection } from './utils';
import { Sender } from '@/types';
import { after } from 'next/server';
import { updateWritingStyleMatrix } from '@/services/writing-style-service';

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
    return null;
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

  after(async () => {
    try {
      console.warn('Saving writing style matrix...')
      await updateWritingStyleMatrix(connection.id, message)
      console.warn('Saved writing style matrix.')
    } catch (error) {
      console.error('Failed to save writing style matrix', error)
    }
  })

  return { success: true };
}

