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

export interface ParsedMessage {
  id: string;
  connectionId?: string;
  title: string;
  subject: string;
  tags: string[];
  sender: {
    name: string;
    email: string;
  };
  receivedOn: string;
  unread: boolean;
  body: string;
  processedHtml: string;
  blobUrl: string;
  decodedBody?: string;
  references?: string;
  inReplyTo?: string;
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
  threadId?: string;
  title: string;
  tags: string[];
  sender: {
    name: string;
    email: string;
  };
  receivedOn: string;
  unread: boolean;
  subject: string;
  totalReplies: number;
  references?: string;
  inReplyTo?: string;
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

export type MailSelectMode = "mass" | "range" | "single" | "selectAllBelow";

export type ThreadProps = {
  message: InitialThread;
  selectMode: MailSelectMode;
  onClick?: (message: InitialThread) => () => Promise<any> | undefined;
  isCompact?: boolean;
};

export type ConditionalThreadProps = ThreadProps &
  (
    | { demo?: true; sessionData?: { userId: string; connectionId: string | null } }
    | { demo?: false; sessionData: { userId: string; connectionId: string | null } }
  );
