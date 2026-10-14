import {
  MailConnectionError,
  type MailSocket,
  type SocketFactory,
  type SocketOptions,
} from './socket';

type CfSocket = ReturnType<(typeof import('cloudflare:sockets'))['connect']>;

class CloudflareMailSocket implements MailSocket {
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private writer: WritableStreamDefaultWriter<Uint8Array>;

  constructor(
    private socket: CfSocket,
    private host: string,
  ) {
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
  }

  async read() {
    const { value, done } = await this.reader.read();
    if (done) return null;
    return value;
  }

  async write(data: Uint8Array) {
    await this.writer.write(data);
  }

  async startTls(): Promise<MailSocket> {
    this.reader.releaseLock();
    this.writer.releaseLock();
    const upgraded = this.socket.startTls({ expectedServerHostname: this.host });
    try {
      await upgraded.opened;
    } catch (cause) {
      throw new MailConnectionError(`TLS negotiation with ${this.host} failed`, 'tls', { cause });
    }
    return new CloudflareMailSocket(upgraded, this.host);
  }

  async close() {
    try {
      await this.writer.close().catch(() => {});
      await this.socket.close();
    } catch {
      // already closed
    }
  }
}

/** Outbound port 25 is blocked on Workers; submission must use 465 or 587. */
const BLOCKED_PORTS = new Set([25]);

export const validateMailHost = (host: string, port: number) => {
  if (!/^[a-z0-9.-]+$/i.test(host) || host.length > 253 || !host.includes('.'))
    throw new MailConnectionError(`Invalid server host "${host}"`, 'host');
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host))
    throw new MailConnectionError('Private server hosts are not supported', 'host');
  if (!Number.isInteger(port) || port <= 0 || port > 65535 || BLOCKED_PORTS.has(port))
    throw new MailConnectionError(`Port ${port} is not supported`, 'host');
};

export const cloudflareSocketFactory: SocketFactory = async ({
  host,
  port,
  security,
}: SocketOptions) => {
  validateMailHost(host, port);
  const { connect } = await import('cloudflare:sockets');
  const socket = connect(
    { hostname: host, port },
    { secureTransport: security === 'tls' ? 'on' : 'starttls', allowHalfOpen: false },
  );
  try {
    await socket.opened;
  } catch (cause) {
    throw new MailConnectionError(
      `Could not connect to ${host}:${port}`,
      security === 'tls' ? 'tls' : 'host',
      { cause },
    );
  }
  return new CloudflareMailSocket(socket, host);
};
