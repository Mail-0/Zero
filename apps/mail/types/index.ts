export type Label = {
  id: string;
  name: string;
  color?: {
    backgroundColor: string;
    textColor: string;
  };
  type: string;
  labels?: Label[];
};

export interface User {
  name: string;
  email: string;
  avatar: string;
}

export interface ISendEmail {
  to: Sender[];
  subject: string;
  message: string;
  attachments?: File[];
  headers?: Record<string, string>;
  cc?: Sender[];
  bcc?: Sender[];
  threadId?: string;
  fromEmail?: string;
}

export interface Account {
  name: string;
  logo: React.ComponentType<{ className?: string }>;
  email: string;
}

export interface NavItem {
  title: string;
  url: string;
  icon?: React.ComponentType<{ className?: string }>;
  isActive?: boolean;
  badge?: number;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export interface SidebarData {
  user: User;
  accounts: Account[];
  navMain: NavSection[];
}

export interface Sender {
  name?: string;
  email: string;
  subject?: string;
}

export interface ParsedMessage {
  id: string;
  connectionId?: string;
  title: string;
  subject: string;
  tags: Label[];
  sender: Sender;
  to: Sender[];
  cc: Sender[] | null;
  bcc: Sender[] | null;
  tls: boolean;
  listUnsubscribe?: string;
  listUnsubscribePost?: string;
  receivedOn: string;
  unread: boolean;
  body: string;
  processedHtml: string;
  blobUrl: string;
  decodedBody?: string;
  references?: string;
  inReplyTo?: string;
  replyTo?: string;
  messageId?: string;
  threadId?: string;
  isDraft?: boolean;
  attachments?: Attachment[];
}

export interface IConnection {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  createdAt: Date;
  providerId: string;
}

export interface Attachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  body: string;
  headers: { name?: string | null; value?: string | null }[];
}
export interface MailListProps {
  isCompact?: boolean;
}

export type MailSelectMode = 'mass' | 'range' | 'single' | 'selectAllBelow';

export type ThreadProps = {
  message: { id: string; historyId?: string | null };
  onClick?: (message: ParsedMessage) => () => void;
  isKeyboardFocused?: boolean;
};

export interface IOutgoingMessage {
  to: Sender[];
  subject: string;
  message: string;
  attachments?: File[];
  headers?: Record<string, string>;
  cc?: Sender[];
  bcc?: Sender[];
  threadId?: string;
  fromEmail?: string;
  isForward?: boolean;
  originalMessage?: string;
}

export interface Note {
  id: string;
  userId: string;
  threadId: string;
  content: string;
  color: string;
  isPinned: boolean | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}
