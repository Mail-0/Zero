import type { EProviders } from '../../types';

export type DoormanReceiveSource = 'gmail-watch' | 'manual-sync';

export interface DoormanReceivedThreadEvent {
  connectionId: string;
  userId: string;
  providerId: EProviders | string;
  threadId: string;
  historyId?: string | null;
  source: DoormanReceiveSource;
  receivedAt: string;
}

export interface DoormanReceivedEmailPayload {
  mailbox: {
    mailboxId: string;
    userId: string;
    mailboxName: string;
  };
  email: {
    emailId: string;
    date: Date | null;
    from: string | null;
    sender: string | null;
    receiver: string | null;
    replyTo: string | null;
    to: string | null;
    cc: string | null;
    bcc: string | null;
    subject: string | null;
    body: string;
    messageId: string | null;
    inReplyTo: string | null;
    mailboxId: string;
    categoryId: string | null;
    priorityScore: number | null;
    metadata: Record<string, unknown>;
  };
  mimeContent: {
    id: string;
    emailId: string;
    contentType: string | null;
    charset: string | null;
    transferEncoding: string | null;
    disposition: string | null;
    filename: string | null;
    contentId: string | null;
    rawPayload: string | null;
    decodedText: string | null;
  };
}
