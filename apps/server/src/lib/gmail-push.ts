import { createRemoteJWKSet, jwtVerify } from 'jose';

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export async function verifyGmailPushToken(
  token: string,
  audience: string,
  serviceAccountEmail: string,
) {
  const { payload } = await jwtVerify(token, googleKeys, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience,
  });
  return payload.email === serviceAccountEmail && payload.email_verified === true;
}

export function gmailSubscriptionConnection(subscription: string, projectId: string) {
  const prefix = `projects/${projectId}/subscriptions/notifications__`;
  if (!subscription.startsWith(prefix)) throw new Error('Unexpected Gmail Pub/Sub subscription');
  const id = subscription.slice(prefix.length);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) {
    throw new Error('Invalid Gmail connection ID');
  }
  return id;
}

export function gmailNotification(body: unknown, subscriptionHeader?: string) {
  const value = body as { historyId?: unknown; subscription?: string; message?: { data?: string } };
  const payload = value.message?.data
    ? (JSON.parse(atob(value.message.data)) as { historyId?: unknown })
    : value;
  const historyId =
    typeof payload.historyId === 'number' &&
    Number.isSafeInteger(payload.historyId) &&
    payload.historyId >= 0
      ? String(payload.historyId)
      : payload.historyId;
  if (typeof historyId !== 'string' || !/^\d+$/.test(historyId))
    throw new Error('Invalid Gmail history ID');
  const subscriptionName = subscriptionHeader ?? value.subscription;
  if (!subscriptionName) throw new Error('Missing Gmail subscription');
  return { historyId, subscriptionName };
}
