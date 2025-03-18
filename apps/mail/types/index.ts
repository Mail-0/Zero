import type { Editor } from "@tiptap/react";

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
