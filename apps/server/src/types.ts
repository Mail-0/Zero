import type { Context } from 'hono';

export enum EProviders {
  'google' = 'google',
  'microsoft' = 'microsoft',
}

export interface ISubscribeBatch {
  connectionId: string;
  providerId: EProviders;
}

export const defaultLabels = [
  {
    name: 'to respond',
    usecase: 'emails you need to respond to. NOT sales, marketing, or promotions.',
  },
  {
    name: 'FYI',
    usecase:
      'emails that are not important, but you should know about. NOT sales, marketing, or promotions.',
  },
  {
    name: 'comment',
    usecase:
      'Team chats in tools like Google Docs, Slack, etc. NOT marketing, sales, or promotions.',
  },
  {
    name: 'notification',
    usecase: 'Automated updates from services you use. NOT sales, marketing, or promotions.',
  },
  {
    name: 'promotion',
    usecase: 'Sales, marketing, cold emails, special offers or promotions. NOT to respond to.',
  },
  {
    name: 'meeting',
    usecase: 'Calendar events, invites, etc. NOT sales, marketing, or promotions.',
  },
  {
    name: 'billing',
    usecase: 'Billing notifications. NOT sales, marketing, or promotions.',
  },
];

export type Label = {
  id: string;
  name: string;
  color?: {
    backgroundColor: string;
    textColor: string;
  };
  type: string;
  labels?: Label[];
  count?: number;
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
  email: string;
}

export interface NavItem {
  title: string;
  url: string;
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
  attachments?: Attachment[];
  isDraft?: boolean;
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
  attachments: File[];
  headers: Record<string, string>;
  threadId?: string;
  fromEmail?: string;
  isForward?: boolean;
  originalMessage?: string | null;
}
export interface DeleteAllSpamResponse {
  success: boolean;
  message: string;
  count?: number;
  error?: string;
}

export enum Tools {
  GetThread = 'getThread',
  ComposeEmail = 'composeEmail',
  ListThreads = 'listThreads',
  DeleteEmail = 'deleteEmail',
  MarkThreadsRead = 'markThreadsRead',
  MarkThreadsUnread = 'markThreadsUnread',
  ModifyLabels = 'modifyLabels',
  GetUserLabels = 'getUserLabels',
  SendEmail = 'sendEmail',
  CreateLabel = 'createLabel',
  BulkDelete = 'bulkDelete',
  BulkArchive = 'bulkArchive',
  DeleteLabel = 'deleteLabel',
  AskZeroMailbox = 'askZeroMailbox',
  AskZeroThread = 'askZeroThread',
  WebSearch = 'webSearch',
}

export type AppContext = Context<{ Bindings: Env }>;

export enum EPrompts {
  SummarizeMessage = 'SummarizeMessage',
  ReSummarizeThread = 'ReSummarizeThread',
  SummarizeThread = 'SummarizeThread',
  Chat = 'Chat',
  Compose = 'Compose',
  //   ThreadLabels = 'ThreadLabels'
}
