/**
 * Byte-stream abstraction the IMAP and SMTP clients run on. Production uses Cloudflare's
 * `connect()` (see ./cloudflare-socket.ts); tests plug in scripted fakes.
 */
export type TransportSecurity = 'tls' | 'starttls';

export interface MailSocket {
  /** Next chunk from the server, or null once the connection is closed. */
  read(): Promise<Uint8Array | null>;
  write(data: Uint8Array): Promise<void>;
  /** Upgrades a plaintext connection after STARTTLS. Returns the upgraded socket. */
  startTls(): Promise<MailSocket>;
  close(): Promise<void>;
}

export interface SocketOptions {
  host: string;
  port: number;
  security: TransportSecurity;
}

export type SocketFactory = (options: SocketOptions) => Promise<MailSocket>;

export class MailConnectionError extends Error {
  constructor(
    message: string,
    readonly kind: 'host' | 'tls' | 'timeout' | 'closed' | 'protocol',
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'MailConnectionError';
  }
}

const concat = (a: Uint8Array, b: Uint8Array) => {
  if (!a.length) return b;
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
};

const withTimeout = <T>(promise: Promise<T>, ms: number, what: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new MailConnectionError(`Timed out waiting for ${what}`, 'timeout')),
        ms,
      );
    }),
  ]);
};

/** Buffered CRLF line / fixed-length reader over a MailSocket. */
export class ByteReader {
  private buffer: Uint8Array = new Uint8Array(0);
  private ended = false;
  /**
   * The in-flight socket read, shared by every waiter. A wait that times out leaves it
   * running; the next fill reuses it, so no chunk is ever dropped or appended twice.
   */
  private filling: Promise<void> | undefined;

  constructor(
    public socket: MailSocket,
    private timeoutMs = 60_000,
  ) {}

  /** Swap in the upgraded socket after STARTTLS. Any buffered plaintext is discarded. */
  replaceSocket(socket: MailSocket) {
    this.socket = socket;
    this.buffer = new Uint8Array(0);
    this.filling = undefined;
  }

  get hasBuffered() {
    return this.buffer.length > 0;
  }

  private sharedFill() {
    if (this.ended)
      return Promise.reject(new MailConnectionError('Connection closed by server', 'closed'));
    if (!this.filling) {
      const socket = this.socket;
      this.filling = socket
        .read()
        .then((chunk) => {
          if (socket !== this.socket) return;
          if (chunk === null) {
            this.ended = true;
            throw new MailConnectionError('Connection closed by server', 'closed');
          }
          this.buffer = concat(this.buffer, chunk);
        })
        .finally(() => {
          if (this.socket === socket) this.filling = undefined;
        });
    }
    return this.filling;
  }

  private async fill() {
    await withTimeout(this.sharedFill(), this.timeoutMs, 'server response');
  }

  /**
   * Waits up to `ms` for buffered data. Returns false on timeout (the read keeps going in
   * the background); rejects only when the connection closes.
   */
  async waitForData(ms: number): Promise<boolean> {
    if (this.buffer.length) return true;
    try {
      await withTimeout(this.sharedFill(), ms, 'data');
      return true;
    } catch (error) {
      if (error instanceof MailConnectionError && error.kind === 'timeout') return false;
      throw error;
    }
  }

  /** Reads one line, without its trailing CRLF, as raw bytes. */
  async readLineBytes(maxLength = 10 * 1024 * 1024): Promise<Uint8Array> {
    let searchFrom = 0;
    for (;;) {
      for (let i = searchFrom; i < this.buffer.length; i++) {
        if (this.buffer[i] === 0x0a) {
          const end = i > 0 && this.buffer[i - 1] === 0x0d ? i - 1 : i;
          const line = this.buffer.slice(0, end);
          this.buffer = this.buffer.slice(i + 1);
          return line;
        }
      }
      searchFrom = this.buffer.length;
      if (this.buffer.length > maxLength)
        throw new MailConnectionError('Server line too long', 'protocol');
      await this.fill();
    }
  }

  async readLine(): Promise<string> {
    return new TextDecoder().decode(await this.readLineBytes());
  }

  async readBytes(length: number): Promise<Uint8Array> {
    while (this.buffer.length < length) await this.fill();
    const out = this.buffer.slice(0, length);
    this.buffer = this.buffer.slice(length);
    return out;
  }
}

export const encodeUtf8 = (value: string) => new TextEncoder().encode(value);
