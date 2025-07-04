import type { IOutgoingMessage, ParsedMessage, Label, DeleteAllSpamResponse } from '../../types';
import { ParsedMessageSchema } from '../../types';
import type { CreateDraftData } from '../schemas';
import { z } from 'zod';

export interface IGetThreadResponse {
  messages: ParsedMessage[];
  latest?: ParsedMessage;
  hasUnread: boolean;
  totalReplies: number;
  labels: { id: string; name: string }[];
}

export const IGetThreadResponseSchema = z.object({
  messages: z.array(ParsedMessageSchema),
  latest: ParsedMessageSchema.optional(),
  hasUnread: z.boolean(),
  totalReplies: z.number(),
  labels: z.array(z.object({ id: z.string(), name: z.string() })),
});

export interface ParsedDraft<T = unknown> {
  id: string;
  to?: string[];
  subject?: string;
  content?: string;
  rawMessage?: T;
  cc?: string[];
  bcc?: string[];
}

export interface IConfig {
  auth?: {
    access_token: string;
    refresh_token: string;
    email: string;
  };
}

export type ManagerConfig = {
  auth: {
    userId: string;
    // accountId: string;
    accessToken: string;
    refreshToken: string;
    email: string;
  };
};

export interface MailManager {
  config: ManagerConfig;
  get(id: string): Promise<IGetThreadResponse>;
  create(data: IOutgoingMessage): Promise<{ id?: string | null }>;
  sendDraft(id: string, data: IOutgoingMessage): Promise<void>;
  createDraft(
    data: CreateDraftData,
  ): Promise<{ id?: string | null; success?: boolean; error?: string }>;
  getDraft(id: string): Promise<ParsedDraft>;
  listDrafts(params: { q?: string; maxResults?: number; pageToken?: string }): Promise<{
    threads: { id: string; historyId: string | null; $raw: unknown }[];
    nextPageToken: string | null;
  }>;
  delete(id: string): Promise<void>;
  list(params: {
    folder: string;
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string | number;
  }): Promise<{
    threads: { id: string; historyId: string | null; $raw?: unknown }[];
    nextPageToken: string | null;
  }>;
  count(): Promise<{ count?: number; label?: string }[]>;
  getTokens(
    code: string,
  ): Promise<{ tokens: { access_token?: string; refresh_token?: string; expiry_date?: number } }>;
  getUserInfo(
    tokens?: ManagerConfig['auth'],
  ): Promise<{ address: string; name: string; photo: string }>;
  getScope(): string;
  listHistory<T>(historyId: string): Promise<{ history: T[]; historyId: string }>;
  markAsRead(threadIds: string[]): Promise<void>;
  markAsUnread(threadIds: string[]): Promise<void>;
  normalizeIds(id: string[]): { threadIds: string[] };
  modifyLabels(
    id: string[],
    options: { addLabels: string[]; removeLabels: string[] },
  ): Promise<void>;
  getAttachment(messageId: string, attachmentId: string): Promise<string | undefined>;
  getUserLabels(): Promise<Label[]>;
  getLabel(id: string): Promise<Label>;
  createLabel(label: {
    name: string;
    color?: { backgroundColor: string; textColor: string };
  }): Promise<void>;
  updateLabel(
    id: string,
    label: { name: string; color?: { backgroundColor: string; textColor: string } },
  ): Promise<void>;
  deleteLabel(id: string): Promise<void>;
  getEmailAliases(): Promise<{ email: string; name?: string; primary?: boolean }[]>;
  revokeToken(token: string): Promise<boolean>;
  deleteAllSpam(): Promise<DeleteAllSpamResponse>;
}
