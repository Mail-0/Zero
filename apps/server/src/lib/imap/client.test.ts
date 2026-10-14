import { ImapAuthError, ImapClient, findSection } from './client';
import { FakeMailServer } from '../mail-transport/fake-socket';
import { describe, expect, it } from 'vitest';

const CAPS = 'IMAP4rev1 SASL-IR AUTH=PLAIN UIDPLUS MOVE ENABLE QRESYNC CONDSTORE SPECIAL-USE ID';

const tagOf = (line: string) => line.split(' ')[0]!;

const server = (options: { caps?: string; password?: string; starttls?: boolean } = {}) => {
  const caps = options.caps ?? CAPS;
  return new FakeMailServer(
    options.starttls ? '* OK ready\r\n' : `* OK [CAPABILITY ${caps}] ready\r\n`,
    (line, { literals, tls }) => {
      const tag = tagOf(line);
      const command = line.slice(tag.length + 1);
      if (command === 'CAPABILITY')
        return [
          `* CAPABILITY ${tls ? caps : `${caps} STARTTLS LOGINDISABLED`}\r\n`,
          `${tag} OK done\r\n`,
        ];
      if (command === 'STARTTLS') return `${tag} OK begin TLS\r\n`;
      if (command.startsWith('AUTHENTICATE PLAIN ')) {
        const decoded = atob(command.slice('AUTHENTICATE PLAIN '.length));
        return decoded === `\0me@example.com\0${options.password ?? 'pw'}`
          ? `${tag} OK [CAPABILITY ${caps}] Logged in\r\n`
          : `${tag} NO [AUTHENTICATIONFAILED] Invalid credentials\r\n`;
      }
      if (command.startsWith('ID ')) return ['* ID NIL\r\n', `${tag} OK\r\n`];
      if (command.startsWith('ENABLE')) return ['* ENABLED QRESYNC\r\n', `${tag} OK enabled\r\n`];
      if (command.startsWith('LIST'))
        return [
          '* LIST (\\HasNoChildren) "/" INBOX\r\n',
          '* LIST (\\HasNoChildren \\Sent) "/" "Sent Items"\r\n',
          '* LIST (\\Noselect \\HasChildren) "/" "Entw&APw-rfe"\r\n',
          `${tag} OK\r\n`,
        ];
      if (command.startsWith('SELECT "INBOX" (QRESYNC (7 100))'))
        return [
          '* 3 EXISTS\r\n',
          '* OK [UIDVALIDITY 7] ok\r\n',
          '* OK [UIDNEXT 12] ok\r\n',
          '* OK [HIGHESTMODSEQ 120] ok\r\n',
          '* VANISHED (EARLIER) 3:4\r\n',
          '* 2 FETCH (UID 10 FLAGS (\\Seen) MODSEQ (110))\r\n',
          `${tag} OK [READ-WRITE] selected\r\n`,
        ];
      if (command.startsWith('UID FETCH 10:11'))
        return [
          '* 2 FETCH (UID 10 FLAGS (\\Seen) BODY[HEADER.FIELDS (MESSAGE-ID)] {21}\r\nMessage-ID: <a@b>\r\n\r\n)\r\n',
          '* 3 FETCH (UID 11 FLAGS () RFC822.SIZE 42 BODY[HEADER.FIELDS (MESSAGE-ID)] {4}\r\n\r\n\r\n)\r\n',
          `${tag} OK\r\n`,
        ];
      if (command.startsWith('UID MOVE'))
        return ['* OK [COPYUID 9 10:11 500:501] moved\r\n', `${tag} OK done\r\n`];
      if (command.startsWith('APPEND')) {
        expect(new TextDecoder().decode(literals[0])).toBe('Subject: x\r\n\r\nhello\r\n');
        return `${tag} OK [APPENDUID 9 77] appended\r\n`;
      }
      if (command === 'LOGOUT') return ['* BYE\r\n', `${tag} OK\r\n`];
      return `${tag} BAD unknown ${command}\r\n`;
    },
  );
};

const connect = (fake: FakeMailServer, overrides: Partial<{ password: string }> = {}) =>
  ImapClient.connect({
    host: 'imap.example.com',
    port: 993,
    security: 'tls',
    socketFactory: fake.factory,
    auth: { method: 'password', username: 'me@example.com', password: overrides.password ?? 'pw' },
  });

describe('ImapClient', () => {
  it('logs in with SASL-IR PLAIN, enables QRESYNC and lists folders', async () => {
    const fake = server();
    const client = await connect(fake);
    expect(client.has('MOVE')).toBe(true);
    expect(client.enabled.has('QRESYNC')).toBe(true);
    const folders = await client.list();
    expect(fake.received.some((l) => l.includes('RETURN (SPECIAL-USE)'))).toBe(true);
    expect(folders).toEqual([
      { path: 'INBOX', delimiter: '/', flags: ['\\HasNoChildren'] },
      { path: 'Sent Items', delimiter: '/', flags: ['\\HasNoChildren', '\\Sent'] },
      { path: 'Entwürfe', delimiter: '/', flags: ['\\Noselect', '\\HasChildren'] },
    ]);
    await client.logout();
  });

  it('upgrades with STARTTLS before authenticating', async () => {
    const fake = server({ starttls: true });
    const client = await ImapClient.connect({
      host: 'imap.example.com',
      port: 143,
      security: 'starttls',
      socketFactory: fake.factory,
      auth: { method: 'password', username: 'me@example.com', password: 'pw' },
    });
    const commands = fake.received.map((l) => l.split(' ').slice(1).join(' '));
    expect(commands.indexOf('STARTTLS')).toBeLessThan(
      commands.findIndex((c) => c.startsWith('AUTHENTICATE')),
    );
    expect(fake.tls).toBe(true);
    await client.logout();
  });

  it('reports authentication failures', async () => {
    await expect(connect(server(), { password: 'wrong' })).rejects.toBeInstanceOf(ImapAuthError);
  });

  it('selects with QRESYNC and collects vanished + changed flags', async () => {
    const client = await connect(server());
    const info = await client.select('INBOX', { qresync: { uidValidity: 7, modseq: 100 } });
    expect(info).toMatchObject({
      exists: 3,
      uidValidity: 7,
      uidNext: 12,
      highestModseq: 120,
      vanished: [3, 4],
    });
    expect(info.changed[0]).toMatchObject({ uid: 10, flags: ['\\Seen'], modseq: 110 });
  });

  it('fetches header sections and moves with COPYUID', async () => {
    const client = await connect(server());
    const messages = await client.uidFetch('10:11', [
      'UID',
      'FLAGS',
      'BODY.PEEK[HEADER.FIELDS (MESSAGE-ID)]',
    ]);
    expect(messages.map((m) => m.uid)).toEqual([10, 11]);
    expect(new TextDecoder().decode(findSection(messages[0]!, 'BODY[HEADER'))).toContain('<a@b>');
    expect(messages[1]!.size).toBe(42);
    const moved = await client.uidMove('10:11', 'Archive');
    expect(moved?.uidValidity).toBe(9);
    expect([...moved!.map]).toEqual([
      [10, 500],
      [11, 501],
    ]);
  });

  it('appends with a synchronizing literal', async () => {
    const fake = server();
    const client = await connect(fake);
    const result = await client.append(
      'Drafts',
      new TextEncoder().encode('Subject: x\r\n\r\nhello\r\n'),
      ['\\Draft', '\\Seen'],
    );
    expect(result).toEqual({ uidValidity: 9, uid: 77 });
    expect(fake.received.at(-1)).toMatch(/^Z\d+ APPEND "Drafts" \(\\Draft \\Seen\) \{21\}$/);
  });
});
