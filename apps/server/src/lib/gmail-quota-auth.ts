import { budgetGmailRequest } from './gmail-quota-client';
import { OAuth2Client } from 'google-auth-library';

export class GmailQuotaAuth extends OAuth2Client {
  constructor(
    private mailbox: string,
    clientId: string,
    clientSecret: string,
  ) {
    super(clientId, clientSecret);
  }

  protected override requestAsync<T>(
    opts: Parameters<OAuth2Client['request']>[0],
    reAuthRetried = false,
  ) {
    const request = () =>
      super.requestAsync<T>(
        { ...opts, retry: false, timeout: opts.timeout ?? 30000 },
        reAuthRetried,
      );
    if (!opts.url) return request();
    return budgetGmailRequest(this.mailbox, opts.url, opts.method, request);
  }
}
