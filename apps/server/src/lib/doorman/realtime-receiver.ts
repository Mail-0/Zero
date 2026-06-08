import type { EProviders, ParsedMessage } from '../../types';
import { env } from '../../env';
import { runDoormanAnalysisJob } from '../../services/doorman-analysis';
import { preprocessEmailHtml } from '../email-processor';
import { getThread } from '../server-utils';
import { saveDoormanReceivedEmail } from './save-received-email';
import type {
  DoormanReceivedEmailPayload,
  DoormanReceivedThreadEvent,
  DoormanReceiveSource,
} from './received-email.types';

export type { DoormanReceivedThreadEvent, DoormanReceiveSource };

const formatAddress = (address?: { name?: string; email: string } | null) => {
  if (!address) return null;
  return address.name ? `${address.name} <${address.email}>` : address.email;
};

const formatAddressList = (addresses?: { name?: string; email: string }[] | null) => {
  if (!addresses?.length) return null;
  return addresses.map(formatAddress).filter(Boolean).join(', ');
};

const safeDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const pickLatestMessage = (messages: ParsedMessage[], latest?: ParsedMessage) => {
  return latest ?? messages[messages.length - 1] ?? null;
};

type ThreadResult = Awaited<ReturnType<typeof getThread>>['result'];

function buildDoormanReceivedEmailPayload(
  event: DoormanReceivedThreadEvent,
  thread: ThreadResult,
  latest: ParsedMessage,
): DoormanReceivedEmailPayload {
  const mailboxId = `inbox:${event.connectionId}`;
  const emailId = latest.id;
  const rawBody = latest.body || latest.processedHtml || latest.decodedBody || '';
  const processedBody = preprocessEmailHtml(rawBody);
  const syncedAt = new Date().toISOString();

  const metadata: Record<string, unknown> = {
    connectionId: event.connectionId,
    providerId: event.providerId,
    threadId: event.threadId,
    historyId: event.historyId ?? null,
    source: event.source,
    receivedAt: event.receivedAt,
    syncedAt,
    unread: latest.unread,
    tls: latest.tls,
    labels: thread.labels,
    totalReplies: thread.totalReplies,
    hasUnread: thread.hasUnread,
  };

  return {
    mailbox: {
      mailboxId,
      userId: event.userId,
      mailboxName: 'Inbox',
    },
    email: {
      emailId,
      date: safeDate(latest.receivedOn),
      from: formatAddress(latest.sender),
      sender: latest.sender?.email ?? null,
      receiver: formatAddressList(latest.to),
      replyTo: latest.replyTo ?? null,
      to: formatAddressList(latest.to),
      cc: formatAddressList(latest.cc),
      bcc: formatAddressList(latest.bcc),
      subject: latest.subject ?? null,
      body: processedBody,
      messageId: latest.messageId ?? latest.id,
      inReplyTo: latest.inReplyTo ?? null,
      mailboxId,
      categoryId: null,
      priorityScore: null,
      metadata,
    },
    mimeContent: {
      id: `${emailId}:body`,
      emailId,
      contentType: 'text/html',
      charset: 'utf-8',
      transferEncoding: null,
      disposition: 'inline',
      filename: null,
      contentId: null,
      rawPayload: rawBody,
      decodedText: latest.decodedBody ?? processedBody,
    },
  };
}

export async function handleDoormanReceivedThread(event: DoormanReceivedThreadEvent) {
  console.log('[DOORMAN_RECEIVE]', JSON.stringify(event));

  const thread = await getThread(event.connectionId, event.threadId);
  const latest = pickLatestMessage(thread.result.messages, thread.result.latest);

  if (!latest) {
    console.warn('[DOORMAN_RECEIVE] No latest message found', event);
    return {
      success: false,
      reason: 'No latest message found',
      event,
    };
  }

  const payload = buildDoormanReceivedEmailPayload(event, thread.result, latest);
  const result = await saveDoormanReceivedEmail(payload);

  try {
    const analysis = await runDoormanAnalysisJob(env, {
      emailIds: [result.emailId],
      batchSize: 1,
    });

    console.log('[DOORMAN_ANALYSIS_AFTER_SAVE]', {
      emailId: result.emailId,
      processed: analysis.processed,
      skipped: analysis.skipped,
    });
  } catch (error) {
    console.error('[DOORMAN_ANALYSIS_AFTER_SAVE] Failed to analyze received email', {
      emailId: result.emailId,
      error,
    });
  }

  console.log('[DOORMAN_DB_SAVE]', {
    emailId: result.emailId,
    mailboxId: result.mailboxId,
    subject: latest.subject,
    sender: latest.sender?.email ?? null,
    source: event.source,
  });

  return result;
}
