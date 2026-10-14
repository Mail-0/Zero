/**
 * Minimal SMTP submission client (RFC 5321 / 6409) with STARTTLS (RFC 3207), AUTH PLAIN/LOGIN
 * (RFC 4954) and XOAUTH2. Port 465 uses implicit TLS, 587 uses STARTTLS.
 */
import {
  ByteReader,
  encodeUtf8,
  MailConnectionError,
  type MailSocket,
  type SocketFactory,
  type TransportSecurity,
} from '../mail-transport/socket';

export type SmtpAuth =
  | { method: 'password'; username: string; password: string }
  | { method: 'xoauth2'; username: string; accessToken: string };

export interface SmtpClientOptions {
  host: string;
  port: number;
  security: TransportSecurity;
  auth: SmtpAuth;
  socketFactory: SocketFactory;
  /** Name sent with EHLO. */
  clientHostname?: string;
  timeoutMs?: number;
}

export interface SmtpReply {
  code: number;
  lines: string[];
}

export class SmtpError extends Error {
  constructor(
    readonly command: string,
    readonly reply: SmtpReply,
  ) {
    super(`SMTP ${command} failed: ${reply.code} ${reply.lines.join(' ')}`);
    this.name = 'SmtpError';
  }

  /** 5xx replies are permanent; 4xx may succeed on retry. */
  get permanent() {
    return this.reply.code >= 500;
  }
}

export class SmtpAuthError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SmtpAuthError';
  }
}

const toBase64 = (value: string) => {
  let binary = '';
  for (const byte of encodeUtf8(value)) binary += String.fromCharCode(byte);
  return btoa(binary);
};

/** Normalizes line endings to CRLF and dot-stuffs lines (RFC 5321 §4.5.2). */
export const prepareData = (raw: Uint8Array): Uint8Array => {
  const out: number[] = [];
  let lineStart = true;
  for (let i = 0; i < raw.length; i++) {
    const byte = raw[i]!;
    if (lineStart && byte === 0x2e) out.push(0x2e);
    if (byte === 0x0a && raw[i - 1] !== 0x0d) {
      out.push(0x0d, 0x0a);
      lineStart = true;
      continue;
    }
    if (byte === 0x0d && raw[i + 1] !== 0x0a) {
      out.push(0x0d, 0x0a);
      lineStart = true;
      continue;
    }
    out.push(byte);
    lineStart = byte === 0x0a;
  }
  if (out.length < 2 || out[out.length - 2] !== 0x0d || out[out.length - 1] !== 0x0a)
    out.push(0x0d, 0x0a);
  out.push(0x2e, 0x0d, 0x0a);
  return new Uint8Array(out);
};

/** Removes the Bcc header from a raw RFC 5322 message (recipients get it via RCPT only). */
export const stripBccHeader = (raw: string) => {
  const split = raw.search(/\r?\n\r?\n/);
  if (split === -1) return raw;
  const headers = raw.slice(0, split);
  const body = raw.slice(split);
  const kept = headers
    .split(/\r?\n(?![ \t])/)
    .filter((header) => !/^bcc:/i.test(header))
    .join('\r\n');
  return kept + body;
};

export class SmtpClient {
  extensions = new Map<string, string>();
  private reader!: ByteReader;
  private socket!: MailSocket;

  private constructor(private options: SmtpClientOptions) {}

  static async connect(options: SmtpClientOptions) {
    const client = new SmtpClient(options);
    await client.open();
    return client;
  }

  has(extension: string) {
    return this.extensions.has(extension.toUpperCase());
  }

  private async readReply(): Promise<SmtpReply> {
    const lines: string[] = [];
    for (;;) {
      const line = await this.reader.readLine();
      const code = Number(line.slice(0, 3));
      if (!Number.isFinite(code) || line.length < 3)
        throw new MailConnectionError(`Malformed SMTP reply: ${line.slice(0, 80)}`, 'protocol');
      lines.push(line.slice(4));
      if (line[3] !== '-') return { code, lines };
    }
  }

  private async command(line: string, expect: number[], label = line.split(' ')[0]!) {
    await this.socket.write(encodeUtf8(`${line}\r\n`));
    const reply = await this.readReply();
    if (!expect.includes(reply.code)) throw new SmtpError(label, reply);
    return reply;
  }

  private async ehlo() {
    const name = this.options.clientHostname ?? 'zero.email';
    let reply: SmtpReply;
    try {
      reply = await this.command(`EHLO ${name}`, [250]);
    } catch (error) {
      if (!(error instanceof SmtpError)) throw error;
      reply = await this.command(`HELO ${name}`, [250]);
    }
    this.extensions.clear();
    for (const line of reply.lines.slice(1)) {
      const [keyword, ...rest] = line.split(' ');
      if (keyword) this.extensions.set(keyword.toUpperCase(), rest.join(' '));
    }
  }

  private async open() {
    const { host, port, security, socketFactory, timeoutMs } = this.options;
    this.socket = await socketFactory({ host, port, security });
    this.reader = new ByteReader(this.socket, timeoutMs ?? 60_000);
    const greeting = await this.readReply();
    if (greeting.code !== 220) throw new SmtpError('greeting', greeting);
    await this.ehlo();
    if (security === 'starttls') {
      if (!this.has('STARTTLS'))
        throw new MailConnectionError('SMTP server does not offer STARTTLS', 'tls');
      await this.command('STARTTLS', [220]);
      this.socket = await this.socket.startTls();
      this.reader.replaceSocket(this.socket);
      await this.ehlo();
    }
    await this.authenticate();
  }

  private async authenticate() {
    const { auth } = this.options;
    const mechanisms = new Set((this.extensions.get('AUTH') ?? '').toUpperCase().split(/\s+/));
    try {
      if (auth.method === 'xoauth2') {
        if (!mechanisms.has('XOAUTH2'))
          throw new SmtpAuthError('SMTP server does not support XOAUTH2');
        const token = toBase64(`user=${auth.username}\x01auth=Bearer ${auth.accessToken}\x01\x01`);
        const reply = await this.command(`AUTH XOAUTH2 ${token}`, [235, 334], 'AUTH');
        // 334 carries a base64 error; an empty reply makes the server send the final status.
        if (reply.code === 334) await this.command('', [235], 'AUTH');
        return;
      }
      if (mechanisms.has('PLAIN') || !mechanisms.has('LOGIN')) {
        await this.command(
          `AUTH PLAIN ${toBase64(`\0${auth.username}\0${auth.password}`)}`,
          [235],
          'AUTH',
        );
        return;
      }
      await this.command('AUTH LOGIN', [334], 'AUTH');
      await this.command(toBase64(auth.username), [334], 'AUTH');
      await this.command(toBase64(auth.password), [235], 'AUTH');
    } catch (error) {
      if (error instanceof SmtpError) {
        throw new SmtpAuthError(error.reply.lines.join(' ') || 'SMTP authentication failed', {
          cause: error,
        });
      }
      throw error;
    }
  }

  /** Sends one message. `raw` must already exclude the Bcc header. */
  async send(envelope: { from: string; recipients: string[] }, raw: Uint8Array) {
    if (!envelope.recipients.length) throw new Error('At least one recipient is required');
    const params: string[] = [];
    if (this.has('SIZE')) params.push(`SIZE=${raw.length}`);
    if (this.has('8BITMIME')) params.push('BODY=8BITMIME');
    const needsUtf8 = [envelope.from, ...envelope.recipients].some((a) =>
      [...a].some((ch) => ch.charCodeAt(0) > 0x7f),
    );
    if (needsUtf8 && this.has('SMTPUTF8')) params.push('SMTPUTF8');
    await this.command(
      `MAIL FROM:<${envelope.from}>${params.length ? ` ${params.join(' ')}` : ''}`,
      [250],
      'MAIL',
    );
    const rejected: { address: string; reply: SmtpReply }[] = [];
    for (const recipient of envelope.recipients) {
      try {
        await this.command(`RCPT TO:<${recipient}>`, [250, 251], 'RCPT');
      } catch (error) {
        if (!(error instanceof SmtpError)) throw error;
        rejected.push({ address: recipient, reply: error.reply });
      }
    }
    if (rejected.length === envelope.recipients.length) {
      await this.command('RSET', [250]).catch(() => {});
      throw new SmtpError('RCPT', rejected[0]!.reply);
    }
    await this.command('DATA', [354]);
    await this.socket.write(prepareData(raw));
    const reply = await this.readReply();
    if (reply.code !== 250) throw new SmtpError('DATA', reply);
    return { accepted: envelope.recipients.length - rejected.length, rejected, reply };
  }

  async quit() {
    try {
      await this.command('QUIT', [221]);
    } catch {
      // ignore
    } finally {
      await this.socket.close().catch(() => {});
    }
  }
}
