import type { Editor } from '@tiptap/react';

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
  cc: Sender[];
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
  sender: Sender;
  receivedOn: string;
  unread: boolean;
  subject: string;
  totalReplies: number;
  references?: string;
  inReplyTo?: string;
}

export interface AIInlineContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  position: { x: number; y: number };
  setPosition: (position: { x: number; y: number }) => void;

  // Editor-related states
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;

  // Diff-related states
  previewDiff: Diff.Change[];
  setPreviewDiff: (diff: Diff.Change[]) => void;
  isPreviewMode: boolean;
  setIsPreviewMode: (isPreview: boolean) => void;
  selectedText: string;
  setSelectedText: (text: string) => void;
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
  message: InitialThread;
  selectMode: MailSelectMode;
  // TODO: enforce types instead of sprinkling "any"
  onClick?: (message: InitialThread) => () => any;
  isCompact?: boolean;
};

export type ConditionalThreadProps = ThreadProps &
  (
    | { demo?: true; sessionData?: { userId: string; connectionId: string | null } }
    | { demo?: false; sessionData: { userId: string; connectionId: string | null } }
  );
