import type { MailManager, ManagerConfig } from './types';
import { OutlookMailManager } from './microsoft';
import type { HonoContext } from '../../ctx';
import { GoogleMailManager } from './google';

const supportedProviders = {
  google: GoogleMailManager,
  microsoft: OutlookMailManager,
};

export const createDriver = (
  provider: keyof typeof supportedProviders | (string & {}),
  config: ManagerConfig,
  c: HonoContext,
): MailManager => {
  const Provider = supportedProviders[provider as keyof typeof supportedProviders];
  if (!Provider) throw new Error('Provider not supported');
  return new Provider(config, c);
};
