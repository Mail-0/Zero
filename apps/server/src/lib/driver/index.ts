import type { MailManager, ManagerConfig } from './types';
import { OutlookMailManager } from './microsoft';
import { GoogleMailManager } from './google';
import { ImapMailManager } from './imap';

const supportedProviders = {
  google: GoogleMailManager,
  microsoft: OutlookMailManager,
  imap: ImapMailManager,
};

export const createDriver = (
  provider: keyof typeof supportedProviders | (string & {}),
  config: ManagerConfig,
): MailManager => {
  const Provider = supportedProviders[provider as keyof typeof supportedProviders];
  if (!Provider) throw new Error('Provider not supported');
  return new Provider(config);
};
