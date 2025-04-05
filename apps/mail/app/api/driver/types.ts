import { type InitialThread, type ParsedMessage } from '@/types';
import { gmail_v1, people_v1 } from 'googleapis';

export interface GoogleContact {
  id: string;
  name?: string;
  email: string;
  profilePhotoUrl?: string;
}

export interface MailManager {
  // Get provider-specific API clients (optional, provider-specific)
  getEmailAPIClient?(accessToken: string, refreshToken: string): Promise<any>;
  getContactsAPIClient?(accessToken: string, refreshToken: string): Promise<any>;
  
  // Get contacts from message history (provider-agnostic method)
  getContacts?(accessToken: string, refreshToken: string, userEmail: string): Promise<GoogleContact[]>;
  get(id: string): Promise<ParsedMessage[] | undefined>;
  create(data: any): Promise<any>;
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
  count(): Promise<any>;
  generateConnectionAuthUrl(userId: string, additionalScope?: string | null): string;
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
}

export interface IConfig {
  auth?: {
    access_token: string;
    refresh_token: string;
  };
}
