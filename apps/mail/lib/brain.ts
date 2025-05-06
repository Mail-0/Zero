export const enableBrainFunction = async (connection: { id: string; providerId: string }) => {
  return await fetch(process.env.BRAIN_URL + `/subscribe/${connection.providerId}`, {
    body: JSON.stringify({
      connectionId: connection.id,
    }),
    method: 'PUT',
  })
    .then(() => true)
    .catch(() => false);
};

export const disableBrainFunction = async (connection: { id: string; providerId: string }) => {
  return await fetch(process.env.BRAIN_URL + `/unsubscribe/${connection.providerId}`, {
    body: JSON.stringify({
      connectionId: connection.id,
    }),
    method: 'PUT',
  })
    .then(() => true)
    .catch(() => false);
};
