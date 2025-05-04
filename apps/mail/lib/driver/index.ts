import { MailManager, ManagerConfig } from './types';
import { GoogleMailManager } from './google';

const SupportedProviders = {
  google: GoogleMailManager,
  // microsoft: microsoftDriver,
};

export const createDriver = async (
  provider: keyof typeof SupportedProviders | (string & {}),
  config: ManagerConfig,
): Promise<MailManager> => {
  const factory = SupportedProviders[provider as keyof typeof SupportedProviders];
  if (!factory) throw new Error('Provider not supported');
  switch (provider) {
    case 'google':
      return new GoogleMailManager(config);
    default:
      throw new Error('Provider not supported');
  }
};
