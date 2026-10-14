/**
 * IMAP/SMTP providers with their own tile in the Connect Email dialog. Choosing one skips
 * server autodiscovery and fills in these settings (username = the email address).
 * Keep in sync with the server-side presets in apps/server/src/lib/imap/discovery.ts.
 */
export interface ImapPreset {
  id: string;
  name: string;
  imap: { host: string; port: number; security: 'tls' | 'starttls' };
  smtp: { host: string; port: number; security: 'tls' | 'starttls' };
  serverSavesSent: boolean;
  /** Example address shown as the email placeholder. */
  placeholder: string;
  note: string;
  helpUrl: string;
}

export const ICLOUD_PRESET: ImapPreset = {
  id: 'icloud',
  name: 'iCloud',
  imap: { host: 'imap.mail.me.com', port: 993, security: 'tls' },
  smtp: { host: 'smtp.mail.me.com', port: 587, security: 'starttls' },
  serverSavesSent: true,
  placeholder: 'you@icloud.com',
  note: 'iCloud requires an app-specific password. Create one at account.apple.com under Sign-In and Security → App-Specific Passwords.',
  helpUrl: 'https://support.apple.com/en-us/102654',
};

export const IMAP_PRESETS: ImapPreset[] = [ICLOUD_PRESET];
