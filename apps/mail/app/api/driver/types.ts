import { type IOutgoingMessage, type InitialThread, type ParsedMessage } from '@/types';

export interface IGetThreadResponse {
  messages: ParsedMessage[];
  latest: ParsedMessage | undefined;
  hasUnread: boolean;
  totalReplies: number;
}

export interface MailManager {
  get(id: string): Promise<IGetThreadResponse>;
  create(data: IOutgoingMessage): Promise<any>;
  createDraft(data: any): Promise<any>;
  getDraft: (id: string) => Promise<any>;
  listDrafts: (q?: string, maxResults?: number, pageToken?: string) => Promise<any>;
  delete(id: string): Promise<any>;
  list<T>(
    folder: string,
    query?: string,
    maxResults?: number,
    labelIds?: string[],
    pageToken?: string | number,
  ): Promise<(T & { threads: InitialThread[] }) | undefined>;
  count(): Promise<{ count?: number; label?: string }[]>;
  generateConnectionAuthUrl(userId: string): string;
  getTokens(
    code: string,
  ): Promise<{ tokens: { access_token?: any; refresh_token?: any; expiry_date?: number } }>;
  getUserInfo(tokens: IConfig['auth']): Promise<any>;
  getScope(): string;
  markAsRead(id: string[]): Promise<void>;
  markAsUnread(id: string[]): Promise<void>;
  normalizeIds(id: string[]): { threadIds: string[] };
  modifyLabels(
    id: string[],
    options: { addLabels: string[]; removeLabels: string[] },
  ): Promise<void>;
  getAttachment(messageId: string, attachmentId: string): Promise<string | undefined>;
  getUserLabels(): Promise<any>;
  getLabel: (labelId: string) => Promise<any>;
  createLabel(label: {
    name: string;
    color?: { backgroundColor: string; textColor: string };
  }): Promise<any>;
  updateLabel(
    id: string,
    label: { name: string; color?: { backgroundColor: string; textColor: string } },
  ): Promise<any>;
  deleteLabel(id: string): Promise<void>;
  getEmailAliases(): Promise<{ email: string; name?: string; primary?: boolean }[]>;
  revokeRefreshToken(refreshToken: string): Promise<boolean>;
}

export interface IConfig {
  auth?: {
    access_token: string;
    refresh_token: string;
    email: string;
  };
}
