'use server';
import { getActiveConnection } from './utils';
import axios from 'axios';

export const EnableBrain = async ({
  connection,
}: {
  connection?: { id: string; providerId: string } | null;
}) => {
  if (!process.env.BRAIN_URL) {
    return false;
  }
  if (!connection) {
    connection = await getActiveConnection();
  }

  if (!connection?.id) {
    return false;
  }

  return await axios
    .put(process.env.BRAIN_URL + `/subscribe/${connection.providerId}`, {
      connectionId: connection.id,
    })
    .catch((error) => false)
    .then(() => true);
};
