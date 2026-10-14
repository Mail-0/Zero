import { describe, expect, it, vi } from 'vitest';
import { scopedRpc } from './scoped-rpc';

describe('DTO RPC ownership', () => {
  it('copies typed results and disposes both result and target after each call', async () => {
    const disposeTarget = vi.fn();
    const disposeResult = vi.fn();
    const result = Object.assign([{ date: new Date(123), bytes: new Uint8Array([1, 2]) }], {
      [Symbol.dispose]: disposeResult,
    });
    const acquire = vi.fn(async () => ({
      read: async () => result,
      [Symbol.dispose]: disposeTarget,
    }));
    const client = scopedRpc<{ read(): Promise<typeof result> }>(acquire);
    const first = await client.read();
    expect(first).toEqual([{ date: new Date(123), bytes: new Uint8Array([1, 2]) }]);
    expect(first).not.toBe(result);
    expect(Symbol.dispose in first).toBe(false);
    await client.read();
    expect(disposeTarget).toHaveBeenCalledTimes(2);
    expect(disposeResult).toHaveBeenCalledTimes(2);
    expect(acquire).toHaveBeenCalledTimes(2);
    await Promise.resolve(client);
    expect(acquire).toHaveBeenCalledTimes(2);
  });

  it('disposes targets on RPC failure and results on copy failure', async () => {
    const disposeTarget = vi.fn();
    const disposeResult = vi.fn();
    const client = scopedRpc<{ fail(): Promise<void>; badDto(): Promise<void> }>(async () => ({
      fail: async () => {
        throw new Error('reload');
      },
      badDto: async () => ({ callback() {}, [Symbol.dispose]: disposeResult }),
      [Symbol.dispose]: disposeTarget,
    }));
    await expect(client.fail()).rejects.toThrow('reload');
    await expect(client.badDto()).rejects.toThrow();
    expect(disposeResult).toHaveBeenCalledOnce();
    expect(disposeTarget).toHaveBeenCalledTimes(2);
  });
});
