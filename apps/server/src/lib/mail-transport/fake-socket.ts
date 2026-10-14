/**
 * Test double for MailSocket: a scripted line-oriented server. The handler receives each
 * client line (and any literal bytes the client sent with it) and returns server output.
 * Only for tests.
 */
import type { MailSocket, SocketFactory } from './socket';

export type FakeHandler = (
  line: string,
  context: { literals: Uint8Array[]; tls: boolean; send: (data: string) => void },
) => string | string[] | void;

export class FakeMailServer {
  /** Every complete client line, in order (literals excluded). */
  readonly received: string[] = [];
  readonly literals: Uint8Array[] = [];
  tls = false;
  connections = 0;

  constructor(
    private greeting: string | (() => string),
    private handler: FakeHandler,
  ) {}

  factory: SocketFactory = async ({ security }) => {
    this.connections++;
    this.tls = security === 'tls';
    return this.createSocket();
  };

  private createSocket(): MailSocket {
    const outbox: Uint8Array[] = [
      this.encode(typeof this.greeting === 'string' ? this.greeting : this.greeting()),
    ];
    let waiters: ((chunk: Uint8Array | null) => void)[] = [];
    let closed = false;
    let pending = new Uint8Array(0);
    let literalNeeded = 0;
    let literalSync = false;
    let lineSoFar = '';
    const lineLiterals: Uint8Array[] = [];

    const deliver = (data: string) => {
      const chunk = this.encode(data);
      const waiter = waiters.shift();
      if (waiter) waiter(chunk);
      else outbox.push(chunk);
    };

    const processLine = (line: string) => {
      const literal = /\{(\d+)(\+?)\}$/.exec(line);
      if (literal) {
        lineSoFar += line;
        literalNeeded = Number(literal[1]);
        literalSync = literal[2] !== '+';
        if (literalSync) deliver('+ Ready\r\n');
        return;
      }
      const full = lineSoFar + line;
      lineSoFar = '';
      this.received.push(full);
      const out = this.handler(full, {
        literals: lineLiterals.splice(0),
        tls: this.tls,
        send: deliver,
      });
      for (const item of out === undefined ? [] : Array.isArray(out) ? out : [out]) deliver(item);
    };

    const consume = () => {
      for (;;) {
        if (literalNeeded > 0) {
          if (pending.length < literalNeeded) return;
          const bytes = pending.slice(0, literalNeeded);
          pending = pending.slice(literalNeeded);
          lineLiterals.push(bytes);
          this.literals.push(bytes);
          literalNeeded = 0;
          continue;
        }
        const newline = pending.indexOf(0x0a);
        if (newline === -1) return;
        const end = newline > 0 && pending[newline - 1] === 0x0d ? newline - 1 : newline;
        const line = new TextDecoder().decode(pending.slice(0, end));
        pending = pending.slice(newline + 1);
        processLine(line);
      }
    };

    const socket: MailSocket = {
      read: async () => {
        const chunk = outbox.shift();
        if (chunk) return chunk;
        if (closed) return null;
        return new Promise((resolve) => waiters.push(resolve));
      },
      write: async (data) => {
        const merged = new Uint8Array(pending.length + data.length);
        merged.set(pending);
        merged.set(data, pending.length);
        pending = merged;
        consume();
      },
      startTls: async () => {
        this.tls = true;
        return socket;
      },
      close: async () => {
        closed = true;
        for (const waiter of waiters) waiter(null);
        waiters = [];
      },
    };
    return socket;
  }

  private encode(data: string) {
    return new TextEncoder().encode(data);
  }
}
