import { SmtpAuthError, SmtpClient, SmtpError, prepareData, stripBccHeader } from './client';
import { FakeMailServer } from '../mail-transport/fake-socket';
import { describe, expect, it } from 'vitest';

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

const smtpServer = (options: { auth?: string; rejectAll?: boolean } = {}) => {
  let inData = false;
  let data = '';
  const server = new FakeMailServer('220 smtp.example.com ready\r\n', (line, { tls }) => {
    if (inData) {
      if (line === '.') {
        inData = false;
        return '250 2.0.0 queued as 1\r\n';
      }
      data += `${line}\r\n`;
      return;
    }
    if (line.startsWith('EHLO'))
      return [
        '250-smtp.example.com\r\n',
        '250-SIZE 1000000\r\n',
        ...(tls ? [] : ['250-STARTTLS\r\n']),
        `250 AUTH ${options.auth ?? 'PLAIN LOGIN'}\r\n`,
      ];
    if (line === 'STARTTLS') return '220 go ahead\r\n';
    if (line.startsWith('AUTH PLAIN ')) {
      return atob(line.slice(11)) === '\0me@example.com\0pw'
        ? '235 ok\r\n'
        : '535 5.7.8 bad credentials\r\n';
    }
    if (line === 'AUTH LOGIN') return '334 VXNlcm5hbWU6\r\n';
    if (line === btoa('me@example.com')) return '334 UGFzc3dvcmQ6\r\n';
    if (line === btoa('pw')) return '235 ok\r\n';
    if (line.startsWith('MAIL FROM')) return '250 ok\r\n';
    if (line.startsWith('RCPT TO'))
      return options.rejectAll || line.includes('bad@') ? '550 no such user\r\n' : '250 ok\r\n';
    if (line === 'DATA') {
      inData = true;
      return '354 end with .\r\n';
    }
    if (line === 'QUIT') return '221 bye\r\n';
    if (line === 'RSET') return '250 ok\r\n';
    return '500 unknown\r\n';
  });
  return { server, data: () => data };
};

const connect = (
  server: FakeMailServer,
  password = 'pw',
  security: 'tls' | 'starttls' = 'starttls',
) =>
  SmtpClient.connect({
    host: 'smtp.example.com',
    port: security === 'tls' ? 465 : 587,
    security,
    socketFactory: server.factory,
    auth: { method: 'password', username: 'me@example.com', password },
  });

describe('SmtpClient', () => {
  it('upgrades with STARTTLS, authenticates and sends with dot-stuffing', async () => {
    const { server, data } = smtpServer();
    const client = await connect(server);
    expect(server.tls).toBe(true);
    const result = await client.send(
      { from: 'me@example.com', recipients: ['a@x.com', 'bad@x.com'] },
      new TextEncoder().encode('Subject: hi\n\n.leading dot\nend'),
    );
    expect(result.accepted).toBe(1);
    expect(result.rejected[0]?.address).toBe('bad@x.com');
    expect(data()).toBe('Subject: hi\r\n\r\n..leading dot\r\nend\r\n');
    expect(server.received).toContain('MAIL FROM:<me@example.com> SIZE=29');
    await client.quit();
  });

  it('falls back to AUTH LOGIN', async () => {
    const { server } = smtpServer({ auth: 'LOGIN' });
    const client = await connect(server, 'pw', 'tls');
    expect(server.received).toContain('AUTH LOGIN');
    await client.quit();
  });

  it('maps auth failures and total recipient rejection', async () => {
    await expect(connect(smtpServer().server, 'nope')).rejects.toBeInstanceOf(SmtpAuthError);
    const client = await connect(smtpServer({ rejectAll: true }).server);
    await expect(
      client.send({ from: 'me@example.com', recipients: ['a@x.com'] }, new Uint8Array([0x61])),
    ).rejects.toBeInstanceOf(SmtpError);
  });
});

describe('helpers', () => {
  it('prepareData normalizes newlines and terminates', () => {
    expect(decode(prepareData(new TextEncoder().encode('a\r\n.b\rc')))).toBe(
      'a\r\n..b\r\nc\r\n.\r\n',
    );
  });

  it('stripBccHeader removes folded Bcc headers only from the header block', () => {
    const raw = 'From: a@x\r\nBcc: b@x,\r\n c@x\r\nTo: d@x\r\n\r\nBcc: body stays';
    expect(stripBccHeader(raw)).toBe('From: a@x\r\nTo: d@x\r\n\r\nBcc: body stays');
  });
});
