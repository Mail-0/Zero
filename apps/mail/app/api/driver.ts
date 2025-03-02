/* eslint-disable @typescript-eslint/no-explicit-any */

import { ParsedMessage, InitialThread } from "@/types";
import googleDriver from "./google.driver";

export interface MailManager {
  get(id: string): Promise<ParsedMessage[] | undefined>;
  create(data: any): Promise<any>;
  delete(id: string): Promise<any>;
  list<T>(
    folder: string,
    query?: string,
    maxResults?: number,
    labelIds?: string[],
    pageToken?: string,
  ): Promise<(T & { threads: InitialThread[] }) | undefined>;
  count(): Promise<any>;
  generateConnectionAuthUrl(userId: string): string;
  getTokens(
    code: string,
  ): Promise<{ tokens: { access_token?: any; refresh_token?: any; expiry_date?: number } }>;
  getUserInfo(tokens: IConfig["auth"]): Promise<any>;
  getScope(): string;
  markAsRead(id: string): Promise<void>;
  modifyLabels(id: string, options: { addLabels: string[], removeLabels: string[] }): Promise<void>;
  modifyThreadLabels(threadId: string, options: { addLabels: string[], removeLabels: string[] }): Promise<void>;
  batchModifyLabels(ids: string[], options: { addLabels: string[], removeLabels: string[] }): Promise<void>;
  normalizeId(id: string): string;
  normalizeIds(ids: string[]): { normalizedIds: string[], threadIds: string[] };
}

export interface IConfig {
  auth?: {
    access_token: string;
    refresh_token: string;
  };
}

const SupportedProviders = {
  google: googleDriver,
};

export const createDriver = async (
  provider: keyof typeof SupportedProviders | string,
  config: IConfig,
): Promise<MailManager> => {
  const factory = SupportedProviders[provider as keyof typeof SupportedProviders];
  if (!factory) throw new Error("Provider not supported");
  
  return factory(config);
};
