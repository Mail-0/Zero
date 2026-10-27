import { getActiveConnection, getZeroAgent } from './server-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const target = { setupAuth: vi.fn(), getThread: vi.fn(), [Symbol.dispose]: vi.fn() };
  const stub = { setMetaData: vi.fn(async () => target) };
  const dbTarget = { findActiveConnection: vi.fn(), [Symbol.dispose]: vi.fn() };
  const dbStub = { setMetaData: vi.fn(async () => dbTarget) };
  const context = { var: { sessionUser: { id: 'user' } } };
  return { target, stub, dbTarget, dbStub, context };
});

vi.mock('../env', () => ({
  env: {
    ZERO_DRIVER: { idFromName: (name: string) => name, get: () => mocks.stub },
    ZERO_DB: { idFromName: (name: string) => name, get: () => mocks.dbStub },
  },
}));
vi.mock('./driver', () => ({ createDriver: vi.fn() }));
vi.mock('dormroom', () => ({ createClient: vi.fn() }));
vi.mock('hono/context-storage', () => ({ getContext: () => mocks.context }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.target.getThread.mockResolvedValue({ messages: [] });
  mocks.target.setupAuth.mockResolvedValue(undefined);
  mocks.dbTarget.findActiveConnection.mockResolvedValue({ id: 'mailbox', userId: 'user' });
});

describe('mailbox RPC initialization', () => {
  it('does not wait on provider auth or socket setup for an authorized cached read', async () => {
    const client = await getZeroAgent('mailbox', { initializeAuth: false });
    expect(await client.getThread('thread')).toEqual({ messages: [] });
    expect(mocks.stub.setMetaData).toHaveBeenCalledExactlyOnceWith('mailbox', false);
    expect(mocks.target.setupAuth).not.toHaveBeenCalled();
    expect(mocks.target[Symbol.dispose]).toHaveBeenCalledOnce();
  });

  it('still initializes provider operations by default', async () => {
    const client = await getZeroAgent('mailbox');
    await client.getThread('thread');
    expect(mocks.stub.setMetaData).toHaveBeenCalledExactlyOnceWith('mailbox', true);
    expect(mocks.target.setupAuth).toHaveBeenCalledOnce();
    expect(mocks.target.setupAuth.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.target.getThread.mock.invocationCallOrder[0]!,
    );
  });

  it('disposes the target when provider initialization fails', async () => {
    mocks.target.setupAuth.mockRejectedValueOnce(new Error('Disconnected'));
    const client = await getZeroAgent('mailbox');
    await expect(client.getThread('thread')).rejects.toThrow('Disconnected');
    expect(mocks.target.getThread).not.toHaveBeenCalled();
    expect(mocks.target[Symbol.dispose]).toHaveBeenCalledOnce();
  });

  it('resolves the active connection in a single user-scoped RPC', async () => {
    expect(await getActiveConnection()).toEqual({ id: 'mailbox', userId: 'user' });
    expect(mocks.dbStub.setMetaData).toHaveBeenCalledExactlyOnceWith('user');
    expect(mocks.dbTarget.findActiveConnection).toHaveBeenCalledOnce();
    expect(mocks.dbTarget[Symbol.dispose]).toHaveBeenCalledOnce();
  });
});
