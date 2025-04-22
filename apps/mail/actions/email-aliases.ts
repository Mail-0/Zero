'use server';

import { throwUnauthorizedGracefully } from '@/app/api/utils';
import { createDriver } from '@/app/api/driver';
import { getActiveConnection } from './utils';

export type EmailAlias = {
  email: string;
  name?: string;
  primary?: boolean;
};

export async function getEmailAliases(): Promise<EmailAlias[]> {
  const connection = await getActiveConnection();

  if (!connection?.accessToken || !connection.refreshToken) {
    console.error('Unauthorized: No valid connection found');
    return [];
  }

  const driver = await createDriver(connection.providerId, {
    auth: {
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken,
      email: connection.email,
    },
  });

  try {
    const aliases = await driver.getEmailAliases();
    return aliases;
  } catch (error) {
    console.error('Error fetching email aliases:', error);
    return [{ email: connection.email, primary: true }];
  }
}
