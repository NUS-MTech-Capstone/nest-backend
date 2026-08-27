import { createClient } from 'redis';
import {
  MonitoringCacheService,
  monitoringMetricCacheKey,
} from './monitoring-cache.service';

jest.mock('redis', () => ({ createClient: jest.fn() }));

describe('MonitoringCacheService', () => {
  const originalEnv = process.env;
  let ready: boolean;
  let open: boolean;
  let redisClient: {
    isReady: boolean;
    isOpen: boolean;
    on: jest.Mock;
    connect: jest.Mock;
    get: jest.Mock;
    set: jest.Mock;
    close: jest.Mock;
    destroy: jest.Mock;
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.REDIS_CACHE_ENABLED;
    delete process.env.REDIS_URL;
    delete process.env.MONITORING_CACHE_TTL_SECONDS;
    jest.clearAllMocks();
    ready = false;
    open = false;
    redisClient = {
      get isReady() {
        return ready;
      },
      get isOpen() {
        return open;
      },
      on: jest.fn().mockReturnThis(),
      connect: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      set: jest.fn().mockResolvedValue('OK'),
      close: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn(),
    };
    (createClient as jest.Mock).mockReturnValue(redisClient);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('stays disabled by default without creating a Redis client', async () => {
    const cache = new MonitoringCacheService();

    cache.onModuleInit();
    expect(createClient).not.toHaveBeenCalled();
    expect(cache.getStatus()).toEqual({
      provider: 'redis',
      enabled: false,
      available: false,
      ttlSeconds: 60,
    });
    await expect(cache.getJSON('key')).resolves.toBeUndefined();
    await expect(cache.setJSON('key', { value: 1 })).resolves.toBe(false);
  });

  it('connects asynchronously and reports availability', () => {
    process.env.REDIS_CACHE_ENABLED = 'true';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.MONITORING_CACHE_TTL_SECONDS = '30';
    const cache = new MonitoringCacheService();

    cache.onModuleInit();
    expect(redisClient.connect).toHaveBeenCalledTimes(1);
    expect(cache.getStatus()).toEqual({
      provider: 'redis',
      enabled: true,
      available: false,
      ttlSeconds: 30,
    });

    ready = true;
    open = true;
    expect(cache.getStatus().available).toBe(true);
  });

  it('reads JSON values, treats misses as undefined, and writes with the configured TTL', async () => {
    process.env.REDIS_CACHE_ENABLED = 'true';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.MONITORING_CACHE_TTL_SECONDS = '45';
    ready = true;
    open = true;
    const cache = new MonitoringCacheService();
    redisClient.get
      .mockResolvedValueOnce('{"value":1}')
      .mockResolvedValueOnce(null);

    await expect(cache.getJSON('hit')).resolves.toEqual({ value: 1 });
    await expect(cache.getJSON('miss')).resolves.toBeUndefined();
    await expect(cache.setJSON('write', { value: 2 })).resolves.toBe(true);
    expect(redisClient.set).toHaveBeenCalledWith('write', '{"value":2}', {
      EX: 45,
    });
  });

  it('falls back on Redis read and write failures', async () => {
    process.env.REDIS_CACHE_ENABLED = 'true';
    process.env.REDIS_URL = 'redis://localhost:6379';
    ready = true;
    open = true;
    const cache = new MonitoringCacheService();
    redisClient.get.mockRejectedValue(new Error('read failed'));
    redisClient.set.mockRejectedValue(new Error('write failed'));

    await expect(cache.getJSON('key')).resolves.toBeUndefined();
    await expect(cache.setJSON('key', { value: 1 })).resolves.toBe(false);
  });

  it('rejects malformed and oversized cached values', async () => {
    process.env.REDIS_CACHE_ENABLED = 'true';
    process.env.REDIS_URL = 'redis://localhost:6379';
    ready = true;
    open = true;
    const cache = new MonitoringCacheService();
    redisClient.get.mockResolvedValue('not-json');

    await expect(cache.getJSON('malformed')).resolves.toBeUndefined();
    await expect(
      cache.setJSON('oversized', 'x'.repeat(256 * 1024)),
    ).resolves.toBe(false);
    expect(redisClient.set).not.toHaveBeenCalled();
  });

  it('creates stable, parameter-specific bounded metric keys', () => {
    const first = monitoringMetricCacheKey(
      'RequestCount',
      'DenDenMushi',
      24,
      3600,
    );
    const same = monitoringMetricCacheKey(
      'RequestCount',
      'DenDenMushi',
      24,
      3600,
    );
    const different = monitoringMetricCacheKey(
      'RequestCount',
      'DenDenMushi',
      6,
      300,
    );

    expect(first).toBe(same);
    expect(first).not.toBe(different);
    expect(first).toMatch(
      /^ddm:nest-backend:monitoring:v1:metrics:[a-f0-9]{64}$/,
    );
  });

  it('closes ready clients and destroys connecting clients on shutdown', async () => {
    process.env.REDIS_CACHE_ENABLED = 'true';
    process.env.REDIS_URL = 'redis://localhost:6379';
    const cache = new MonitoringCacheService();

    ready = true;
    open = true;
    await cache.onApplicationShutdown();
    expect(redisClient.close).toHaveBeenCalled();

    ready = false;
    await cache.onApplicationShutdown();
    expect(redisClient.destroy).toHaveBeenCalled();
  });
});
