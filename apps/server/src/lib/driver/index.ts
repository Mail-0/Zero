import type { MailManager, ManagerConfig } from './types';
import { GoogleMailManager } from './google';
import type { AppEnv } from '../../ctx';

const supportedProviders = {
  google: GoogleMailManager,
  // microsoft: microsoftDriver,
};

export const createDriver = (
  provider: keyof typeof supportedProviders | (string & {}),
  config: ManagerConfig,
  env: AppEnv,
): MailManager => {
  const Provider = supportedProviders[provider as keyof typeof supportedProviders];
  if (!Provider) throw new Error('Provider not supported');
  return new Provider(config, env);
};
