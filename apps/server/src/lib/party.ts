import { Server, type Connection, type ConnectionContext } from 'partyserver';
import { createSimpleAuth, type SimpleAuth } from './auth';

const parseHeaders = (token: string) => {
  const headers = new Headers();
  headers.set('Cookie', token);
  return headers;
};

export class DurableMailbox extends Server<Env> {
  auth: SimpleAuth;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.auth = createSimpleAuth();
  }

  private async getSession(token: string) {
    const session = await this.auth.api.getSession({ headers: parseHeaders(token) });
    return session;
  }

  async onConnect(connection: Connection, ctx: ConnectionContext) {
    const url = new URL(ctx.request.url);
    const token = url.searchParams.get('token');
    if (token) {
      const session = await this.getSession(token);
      if (session) {
        await this.ctx.storage.put('email', session.user.email);
      } else {
        console.log('No session', token);
      }
    }
  }
}
