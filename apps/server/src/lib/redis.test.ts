import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRedis } from './redis';

const mocks = vi.hoisted(() => {
  const pipeline = { call: vi.fn(), exec: vi.fn() };
  const client = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    call: vi.fn(),
    pipeline: vi.fn(() => pipeline),
    multi: vi.fn(() => pipeline),
  };
  return { client, pipeline, constructor: vi.fn(() => client) };
});

vi.mock('ioredis', () => ({ Redis: mocks.constructor }));

describe('TCP Redis adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.client.connect.mockResolvedValue(undefined);
    mocks.client.call.mockResolvedValue('PONG');
    mocks.pipeline.exec.mockResolvedValue([[null, 'OK']]);
  });

  it('preserves HTTP Redis without opening a TCP connection', () => {
    createRedis('https://redis.example.com', 'token');
    expect(mocks.constructor).not.toHaveBeenCalled();
  });

  it('opens and closes a connection for each command', async () => {
    const redis = createRedis('redis://localhost:6379');
    expect(mocks.constructor).not.toHaveBeenCalled();
    expect(await redis.ping()).toBe('PONG');
    expect(await redis.ping()).toBe('PONG');
    expect(mocks.client.connect).toHaveBeenCalledTimes(2);
    expect(mocks.client.disconnect).toHaveBeenCalledTimes(2);
  });

  it('preserves JSON serialization and expirations', async () => {
    const redis = createRedis('rediss://localhost:6379');
    await redis.set('key', { value: 'Unicode ✓' }, { ex: 60 });
    expect(mocks.client.call).toHaveBeenCalledWith('set', 'key', '{"value":"Unicode ✓"}', 'ex', 60);
    mocks.client.call.mockResolvedValue('{"value":"Unicode ✓"}');
    expect(await redis.get('key')).toEqual({ value: 'Unicode ✓' });
  });

  it('supports pipelines and transactions', async () => {
    const redis = createRedis('redis://localhost:6379');
    mocks.pipeline.exec.mockResolvedValue([
      [null, '{"value":1}'],
      [null, 42],
    ]);
    expect(await redis.pipeline().get('key').ttl('key').exec()).toEqual([{ value: 1 }, 42]);
    expect(mocks.pipeline.call).toHaveBeenCalledWith('get', 'key');
    expect(await redis.multi().get('key').ttl('key').exec()).toEqual([{ value: 1 }, 42]);
    expect(mocks.client.multi).toHaveBeenCalled();
  });

  it('propagates pipeline command errors', async () => {
    mocks.pipeline.exec.mockResolvedValue([[new Error('WRONGTYPE'), null]]);
    await expect(
      createRedis('redis://localhost:6379').pipeline().get('key').exec(),
    ).rejects.toThrow('WRONGTYPE');
    expect(mocks.client.disconnect).toHaveBeenCalled();
  });

  it('rejects aborted transactions', async () => {
    mocks.pipeline.exec.mockResolvedValue(null);
    await expect(createRedis('redis://localhost:6379').multi().get('key').exec()).rejects.toThrow(
      'aborted',
    );
    expect(mocks.client.disconnect).toHaveBeenCalled();
  });

  it('closes connections even when connection or command execution fails', async () => {
    const redis = createRedis('redis://localhost:6379');
    mocks.client.connect.mockRejectedValueOnce(new Error('connection failed'));
    await expect(redis.ping()).rejects.toThrow('connection failed');
    mocks.client.call.mockRejectedValueOnce(new Error('command failed'));
    await expect(redis.ping()).rejects.toThrow('command failed');
    expect(mocks.client.disconnect).toHaveBeenCalledTimes(2);
  });
});
