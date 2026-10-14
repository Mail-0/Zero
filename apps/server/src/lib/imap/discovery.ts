/**
 * IMAP/SMTP server autodiscovery for an email address, in order:
 *  1. Built-in presets for common providers (by domain, then by MX host).
 *  2. Mozilla Thunderbird autoconfig: the domain's own `autoconfig.<domain>` and the ISPDB.
 *  3. DNS SRV records (RFC 6186: _imaps._tcp, _submissions._tcp, _submission._tcp) via DoH.
 *  4. A guess of imap.<domain> / smtp.<domain>.
 */
export interface DiscoveredServer {
  host: string;
  port: number;
  security: 'tls' | 'starttls';
}

export interface DiscoveredSettings {
  source: 'preset' | 'autoconfig' | 'srv' | 'guess';
  provider?: string;
  imap: DiscoveredServer;
  smtp: DiscoveredServer;
  /** `%EMAILADDRESS%` (default) or `%EMAILLOCALPART%`. */
  username: 'email' | 'localpart';
  serverSavesSent: boolean;
  /** Help text, e.g. "Create an app password". */
  note?: string;
  helpUrl?: string;
  /** Provider supports (and prefers) OAuth via XOAUTH2. */
  oauthProvider?: 'google' | 'microsoft';
}

interface Preset extends Omit<DiscoveredSettings, 'source'> {
  domains: string[];
  mx?: RegExp;
}

const PRESETS: Preset[] = [
  {
    provider: 'iCloud',
    domains: ['icloud.com', 'me.com', 'mac.com'],
    // iCloud+ custom email domains.
    mx: /\.mail\.icloud\.com$/i,
    imap: { host: 'imap.mail.me.com', port: 993, security: 'tls' },
    smtp: { host: 'smtp.mail.me.com', port: 587, security: 'starttls' },
    username: 'email',
    serverSavesSent: true,
    note: 'iCloud requires an app-specific password.',
    helpUrl: 'https://support.apple.com/en-us/102654',
  },
  {
    provider: 'Fastmail',
    domains: ['fastmail.com', 'fastmail.fm', 'messagingengine.com'],
    mx: /\.messagingengine\.com$/i,
    imap: { host: 'imap.fastmail.com', port: 993, security: 'tls' },
    smtp: { host: 'smtp.fastmail.com', port: 465, security: 'tls' },
    username: 'email',
    serverSavesSent: false,
    note: 'Fastmail requires an app password.',
    helpUrl: 'https://www.fastmail.help/hc/en-us/articles/360058752854',
  },
  {
    provider: 'Yahoo',
    domains: ['yahoo.com', 'ymail.com', 'rocketmail.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de'],
    mx: /yahoodns\.net$/i,
    imap: { host: 'imap.mail.yahoo.com', port: 993, security: 'tls' },
    smtp: { host: 'smtp.mail.yahoo.com', port: 465, security: 'tls' },
    username: 'email',
    serverSavesSent: true,
    note: 'Yahoo requires an app password.',
    helpUrl: 'https://help.yahoo.com/kb/SLN15241.html',
  },
  {
    provider: 'AOL',
    domains: ['aol.com', 'aim.com'],
    imap: { host: 'imap.aol.com', port: 993, security: 'tls' },
    smtp: { host: 'smtp.aol.com', port: 465, security: 'tls' },
    username: 'email',
    serverSavesSent: true,
    note: 'AOL requires an app password.',
  },
  {
    provider: 'Zoho',
    domains: ['zoho.com', 'zohomail.com'],
    mx: /\.zoho\.(com|eu|in)$/i,
    imap: { host: 'imap.zoho.com', port: 993, security: 'tls' },
    smtp: { host: 'smtp.zoho.com', port: 465, security: 'tls' },
    username: 'email',
    serverSavesSent: false,
  },
  {
    provider: 'GMX',
    domains: ['gmx.com', 'gmx.net', 'gmx.de'],
    imap: { host: 'imap.gmx.com', port: 993, security: 'tls' },
    smtp: { host: 'mail.gmx.com', port: 587, security: 'starttls' },
    username: 'email',
    serverSavesSent: false,
  },
  {
    provider: 'Gmail',
    domains: ['gmail.com', 'googlemail.com'],
    mx: /(\.|^)google(mail)?\.com$/i,
    imap: { host: 'imap.gmail.com', port: 993, security: 'tls' },
    smtp: { host: 'smtp.gmail.com', port: 465, security: 'tls' },
    username: 'email',
    serverSavesSent: true,
    oauthProvider: 'google',
    note: 'Gmail works best with the Google connection. For IMAP, use an app password.',
    helpUrl: 'https://support.google.com/accounts/answer/185833',
  },
  {
    provider: 'Outlook',
    domains: ['outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'outlook.de', 'hotmail.co.uk'],
    mx: /\.(protection\.outlook\.com|olc\.protection\.outlook\.com)$/i,
    imap: { host: 'outlook.office365.com', port: 993, security: 'tls' },
    smtp: { host: 'smtp.office365.com', port: 587, security: 'starttls' },
    username: 'email',
    serverSavesSent: true,
    oauthProvider: 'microsoft',
    note: 'Microsoft accounts require signing in with Microsoft.',
  },
];

export type Fetcher = typeof fetch;

const domainOf = (email: string) => email.split('@')[1]?.trim().toLowerCase() ?? '';

const fromPreset = (preset: Preset): DiscoveredSettings => {
  const { domains: _domains, mx: _mx, ...rest } = preset;
  return { source: 'preset', ...rest };
};

const dnsQuery = async (name: string, type: 'MX' | 'SRV', fetcher: Fetcher) => {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
  const response = await fetcher(url, { headers: { accept: 'application/dns-json' } });
  if (!response.ok) return [];
  const body = (await response.json()) as { Answer?: { data: string; type: number }[] };
  return (body.Answer ?? []).map((answer) => answer.data);
};

export const lookupMx = async (domain: string, fetcher: Fetcher) =>
  (await dnsQuery(domain, 'MX', fetcher))
    .map((data) => {
      const [priority, host] = data.split(/\s+/);
      return { priority: Number(priority), host: (host ?? '').replace(/\.$/, '').toLowerCase() };
    })
    .filter((record) => record.host)
    .sort((a, b) => a.priority - b.priority);

const lookupSrv = async (name: string, fetcher: Fetcher) => {
  const [first] = (await dnsQuery(name, 'SRV', fetcher))
    .map((data) => {
      const [priority, , port, target] = data.split(/\s+/);
      return {
        priority: Number(priority),
        port: Number(port),
        host: (target ?? '').replace(/\.$/, '').toLowerCase(),
      };
    })
    .filter((record) => record.host && record.host !== '.' && record.port > 0)
    .sort((a, b) => a.priority - b.priority);
  return first;
};

/** Parses a Thunderbird autoconfig XML document. */
export const parseAutoconfig = (xml: string): Omit<DiscoveredSettings, 'source'> | null => {
  const servers = (tag: 'incomingServer' | 'outgoingServer', type: string) =>
    [...xml.matchAll(new RegExp(`<${tag}[^>]*type="${type}"[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map(
      (match) => {
        const body = match[1]!;
        const field = (name: string) =>
          new RegExp(`<${name}>\\s*([^<]*?)\\s*</${name}>`).exec(body)?.[1] ?? '';
        const socket = field('socketType').toUpperCase();
        return {
          host: field('hostname').toLowerCase(),
          port: Number(field('port')),
          security:
            socket === 'SSL'
              ? ('tls' as const)
              : socket === 'STARTTLS'
                ? ('starttls' as const)
                : null,
          username: field('username'),
        };
      },
    );
  const pick = (list: ReturnType<typeof servers>) =>
    list.find((server) => server.security && server.host && server.port && server.port !== 25);
  const imap = pick(servers('incomingServer', 'imap'));
  const smtp = pick(servers('outgoingServer', 'smtp'));
  if (!imap || !smtp) return null;
  return {
    imap: { host: imap.host, port: imap.port, security: imap.security! },
    smtp: { host: smtp.host, port: smtp.port, security: smtp.security! },
    username: imap.username.includes('%EMAILLOCALPART%') ? 'localpart' : 'email',
    serverSavesSent: false,
  };
};

const fetchAutoconfig = async (domain: string, email: string, fetcher: Fetcher) => {
  const urls = [
    `https://autoconfig.${domain}/mail/config-v1.1.xml?emailaddress=${encodeURIComponent(email)}`,
    `https://autoconfig.thunderbird.net/v1.1/${domain}`,
  ];
  for (const url of urls) {
    try {
      const response = await fetcher(url, { signal: AbortSignal.timeout(4000) });
      if (!response.ok) continue;
      const parsed = parseAutoconfig(await response.text());
      if (parsed) return parsed;
    } catch {
      // try next source
    }
  }
  return null;
};

export const discoverMailSettings = async (
  email: string,
  fetcher: Fetcher = fetch,
): Promise<DiscoveredSettings> => {
  const domain = domainOf(email);
  if (!domain) throw new Error('Invalid email address');

  const byDomain = PRESETS.find((preset) => preset.domains.includes(domain));
  if (byDomain) return fromPreset(byDomain);

  const mx = await lookupMx(domain, fetcher).catch(() => []);
  const byMx = PRESETS.find(
    (preset) => preset.mx && mx.some((record) => preset.mx!.test(record.host)),
  );
  if (byMx) return fromPreset(byMx);

  const autoconfig = await fetchAutoconfig(domain, email, fetcher);
  if (autoconfig) return { source: 'autoconfig', ...autoconfig };

  // Autoconfig also lives under the MX provider's domain (e.g. hosted mail on mx.example.net).
  const mxDomain = mx[0]?.host.split('.').slice(-2).join('.');
  if (mxDomain && mxDomain !== domain) {
    const viaMx = await fetchAutoconfig(mxDomain, email, fetcher);
    if (viaMx) return { source: 'autoconfig', ...viaMx };
  }

  const [imaps, submissions, submission] = await Promise.all([
    lookupSrv(`_imaps._tcp.${domain}`, fetcher).catch(() => undefined),
    lookupSrv(`_submissions._tcp.${domain}`, fetcher).catch(() => undefined),
    lookupSrv(`_submission._tcp.${domain}`, fetcher).catch(() => undefined),
  ]);
  if (imaps && (submissions || submission)) {
    return {
      source: 'srv',
      imap: { host: imaps.host, port: imaps.port, security: 'tls' },
      smtp: submissions
        ? { host: submissions.host, port: submissions.port, security: 'tls' }
        : { host: submission!.host, port: submission!.port, security: 'starttls' },
      username: 'email',
      serverSavesSent: false,
    };
  }

  return {
    source: 'guess',
    imap: { host: `imap.${domain}`, port: 993, security: 'tls' },
    smtp: { host: `smtp.${domain}`, port: 465, security: 'tls' },
    username: 'email',
    serverSavesSent: false,
  };
};
