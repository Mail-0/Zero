'use server';
import { throwUnauthorizedGracefully } from '@/app/api/utils';
import { getActiveConnection } from './utils';
import axios from 'axios';

export const EnableBrain = async () => {
  if (!process.env.BRAIN_URL) {
    throw new Error('Brain URL not found');
  }

  const connection = await getActiveConnection();

  if (!connection?.accessToken || !connection.refreshToken) {
    return throwUnauthorizedGracefully();
  }

  return await axios.put(process.env.BRAIN_URL + `/subscribe/${connection.providerId}`, {
    connectionId: connection.id,
  });
};
