'use server';

import { createDriver } from '@/app/api/driver';
import { getActiveConnection } from './utils';
import { ISendEmail } from '@/types';
import { updateWritingStyleMatrix } from '@/services/writing-style-service';
import { after } from 'next/server';

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
}: ISendEmail & { draftId?: string }) {
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
    attachments: attachments || [],
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

