'use server';
import axios from 'axios';

export const EnableBrain = async ({
  connection,
}: {
  connection: { id: string; providerId: string };
}) => {
  if (!process.env.BRAIN_URL) {
    return false;
  }

  return await axios
    .put(process.env.BRAIN_URL + `/subscribe/${connection.providerId}`, {
      connectionId: connection.id,
    })
    .catch((error) => false)
    .then(() => true);
};
