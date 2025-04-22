'use server';
import { throwUnauthorizedGracefully } from '@/app/api/utils';
import { getActiveConnection } from './utils';
import axios from 'axios';

export const EnableBrain = async () => {
  if (!process.env.BRAIN_URL) {
    return null;
  }

  const connection = await getActiveConnection();

  if (!connection?.accessToken || !connection.refreshToken) {
    throw throwUnauthorizedGracefully();
  }

  return await axios.put(process.env.BRAIN_URL + `/subscribe/${connection.providerId}`, {
    connectionId: connection.id,
  });
};
