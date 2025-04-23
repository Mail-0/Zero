import { getActiveConnection } from '@/actions/utils';
import { createDriver } from '@/app/api/driver';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const connection = await getActiveConnection();

    if (!connection?.accessToken || !connection.refreshToken) {
      console.error('Unauthorized: No valid connection found');
      return NextResponse.json([], { status: 401 });
    }

    const driver = await createDriver(connection.providerId, {
      auth: {
        access_token: connection.accessToken,
        refresh_token: connection.refreshToken,
        email: connection.email,
      },
    });
    const aliases = await driver.getEmailAliases();
    return NextResponse.json(aliases);
  } catch (error) {
    console.error('Error fetching email aliases:', error);
    return NextResponse.json([], { status: 400 });
  }
}
