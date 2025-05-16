import { env } from 'cloudflare:workers';

export const enableBrainFunction = async (connection: { id: string; providerId: string }) => {
  return await env.zero.subscribe({
    connectionId: connection.id,
    providerId: connection.providerId,
  });
};

export const disableBrainFunction = async (connection: { id: string; providerId: string }) => {
  return await env.zero.unsubscribe({
    connectionId: connection.id,
    providerId: connection.providerId,
  });
};
