export interface User {
  name: string;
  email: string;
  avatar: string;
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
  name: string;
  email: string;
}

export interface ParsedMessage {
  id: string;
  connectionId?: string;
  title: string;
  subject: string;
  tags: string[];
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
  attachments?: Attachment[];
}

export interface IConnection {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface InitialThread {
  id: string;
}

export interface Attachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  body: string;
  // TODO: Fix typing
  headers: any;
}
export interface MailListProps {
  isCompact?: boolean;
}

export type MailSelectMode = 'mass' | 'range' | 'single' | 'selectAllBelow';

export type ThreadProps = {
  message: { id: string };
  selectMode: MailSelectMode;
  // TODO: enforce types instead of sprinkling "any"
  onClick?: (message: ParsedMessage) => () => void;
  isCompact?: boolean;
  folder?: string;
  isKeyboardFocused?: boolean;
  isInQuickActionMode?: boolean;
  selectedQuickActionIndex?: number;
  resetNavigation?: () => void;
  demoMessage?: ParsedMessage;
};

export type ConditionalThreadProps = ThreadProps &
  (
    | { demo?: true; sessionData?: { userId: string; connectionId: string | null } }
    | { demo?: false; sessionData: { userId: string; connectionId: string | null } }
  );

export interface IOutgoingMessage {
  to: Sender[];
  cc?: Sender[];
  bcc?: Sender[];
  subject: string;
  message: string;
  attachments: any[];
  headers: Record<string, string>;
  threadId?: string;
}
