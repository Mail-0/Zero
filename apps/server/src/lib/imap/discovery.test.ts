import { discoverMailSettings, parseAutoconfig } from './discovery';
import { describe, expect, it } from 'vitest';

const AUTOCONFIG = `<?xml version="1.0"?>
<clientConfig version="1.1"><emailProvider id="example.org">
  <incomingServer type="pop3"><hostname>pop.example.org</hostname><port>995</port><socketType>SSL</socketType></incomingServer>
  <incomingServer type="imap"><hostname>mail.example.org</hostname><port>993</port><socketType>SSL</socketType><username>%EMAILLOCALPART%</username></incomingServer>
  <outgoingServer type="smtp"><hostname>mail.example.org</hostname><port>25</port><socketType>STARTTLS</socketType></outgoingServer>
  <outgoingServer type="smtp"><hostname>mail.example.org</hostname><port>587</port><socketType>STARTTLS</socketType><username>%EMAILLOCALPART%</username></outgoingServer>
</emailProvider></clientConfig>`;

const fetcher = (routes: Record<string, unknown>): typeof fetch =>
  (async (input: string | URL | Request) => {
    const url = String(input);
    const match = Object.entries(routes).find(([prefix]) => url.startsWith(prefix));
    if (!match) return new Response('not found', { status: 404 });
    const body = match[1];
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200 });
  }) as typeof fetch;

describe('discovery', () => {
  it('parses autoconfig, skipping port 25 and POP', () => {
    expect(parseAutoconfig(AUTOCONFIG)).toEqual({
      imap: { host: 'mail.example.org', port: 993, security: 'tls' },
      smtp: { host: 'mail.example.org', port: 587, security: 'starttls' },
      username: 'localpart',
      serverSavesSent: false,
    });
  });

  it('uses presets by domain and by MX', async () => {
    expect((await discoverMailSettings('a@icloud.com', fetcher({}))).provider).toBe('iCloud');
    const viaMx = await discoverMailSettings(
      'a@custom.dev',
      fetcher({
        'https://cloudflare-dns.com/dns-query?name=custom.dev&type=MX': {
          Answer: [{ type: 15, data: '10 in1-smtp.messagingengine.com.' }],
        },
      }),
    );
    expect(viaMx).toMatchObject({ source: 'preset', provider: 'Fastmail' });
    const icloudCustom = await discoverMailSettings(
      'me@family.dev',
      fetcher({
        'https://cloudflare-dns.com/dns-query?name=family.dev&type=MX': {
          Answer: [{ type: 15, data: '10 mx01.mail.icloud.com.' }],
        },
      }),
    );
    expect(icloudCustom).toMatchObject({ provider: 'iCloud', imap: { host: 'imap.mail.me.com' } });
  });

  it('falls back to autoconfig, then SRV, then a guess', async () => {
    const auto = await discoverMailSettings(
      'me@example.org',
      fetcher({ 'https://autoconfig.thunderbird.net/v1.1/example.org': AUTOCONFIG }),
    );
    expect(auto.source).toBe('autoconfig');

    const srv = await discoverMailSettings(
      'me@srv.dev',
      fetcher({
        'https://cloudflare-dns.com/dns-query?name=_imaps._tcp.srv.dev': {
          Answer: [{ type: 33, data: '0 1 993 imap.host.net.' }],
        },
        'https://cloudflare-dns.com/dns-query?name=_submission._tcp.srv.dev': {
          Answer: [{ type: 33, data: '0 1 587 smtp.host.net.' }],
        },
      }),
    );
    expect(srv).toMatchObject({
      source: 'srv',
      imap: { host: 'imap.host.net', port: 993 },
      smtp: { host: 'smtp.host.net', port: 587, security: 'starttls' },
    });

    expect(await discoverMailSettings('me@nothing.dev', fetcher({}))).toMatchObject({
      source: 'guess',
      imap: { host: 'imap.nothing.dev' },
    });
  });
});
